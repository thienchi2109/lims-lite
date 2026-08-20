import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/208_add_assay_sample_type_catalog_rpcs.sql',
)

const immutableMigrations = [
  ['204_add_sample_type_master_data.sql', 'e6bebc77449e3a4afeee278cf7c45823872c5245ff41b53eaf22896577fcb492'],
  ['205_recover_sample_type_master_data.sql', 'bfabbf645e4424f5e21fada5651ef1aa55a59b26af38464ea393e59d350c5de9'],
  ['206_add_assay_sample_type_compatibility_revision_core.sql', 'b8715e71762bde41b39ea5a441298adfd8c121e9816a9cdda79c56c2eadc3892'],
  ['207_add_compatibility_catalog_service_role_policies.sql', 'dff8e0ffc3f00ef66a4b5b4d858e15b480335d729c65115b2ea154222bbf9e7f'],
] as const

function normalizeSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractFunction(sql: string, functionName: string) {
  const normalized = normalizeSql(sql)
  const start = normalized.indexOf(`CREATE FUNCTION public.${functionName}`)
  const end = normalized.indexOf('$$;', start)

  expect(start).toBeGreaterThanOrEqual(0)
  expect(end).toBeGreaterThan(start)
  return normalized.slice(start, end + 3)
}

describe('assay sample-type catalog RPC migration', () => {
  it('keeps applied migrations 204-207 immutable and adds migration 208', () => {
    for (const [fileName, expectedHash] of immutableMigrations) {
      const content = readFileSync(
        join(process.cwd(), 'supabase/migrations', fileName),
        'utf8',
      )
      expect(createHash('sha256').update(content).digest('hex')).toBe(expectedHash)
    }

    expect(existsSync(migrationPath)).toBe(true)
  })

  it('defines manager-only clone, update, review, publish, and manager read RPCs', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))
    const managerFunctions = [
      'clone_assay_sample_type_catalog_revision',
      'update_assay_sample_type_catalog_review',
      'review_assay_sample_type_catalog_revision',
      'publish_assay_sample_type_catalog_revision',
      'get_assay_sample_type_catalog_manager',
    ]

    for (const functionName of managerFunctions) {
      expect(normalized).toMatch(
        new RegExp(
          `CREATE (?:OR REPLACE )?FUNCTION public\\.${functionName}\\b[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = public, extensions`,
          'i',
        ),
      )
      expect(normalized).toContain(`get_user_role() IS DISTINCT FROM 'manager'`)
      expect(normalized).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]+\\) FROM PUBLIC, anon, authenticated, service_role`,
          'i',
        ),
      )
      expect(normalized).toMatch(
        new RegExp(
          `GRANT EXECUTE ON FUNCTION public\\.${functionName}\\([^;]+\\) TO authenticated`,
          'i',
        ),
      )
    }
  })

  it('exposes only the minimal published catalog to analysts and managers', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).toMatch(
      /CREATE (?:OR REPLACE )?FUNCTION public\.get_published_assay_sample_type_catalog\b[\s\S]*?SECURITY DEFINER[\s\S]*?SET search_path = public, extensions/i,
    )
    expect(normalized).toMatch(
      /get_user_role\(\) IS NULL OR public\.get_user_role\(\) NOT IN \('analyst', 'manager'\)/i,
    )
    expect(normalized).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.get_published_assay_sample_type_catalog\([^;]+\) TO authenticated/i,
    )
    expect(normalized).not.toMatch(
      /GRANT SELECT ON TABLE public\.assay_sample_type_[a-z_]+ TO authenticated/i,
    )
    expect(normalized).not.toMatch(
      /CREATE POLICY [^;]+ TO authenticated/i,
    )
  })

  it('keeps compatibility-referenced retired sample types visible to managers', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).toMatch(
      /WHERE sample_type\.deleted_at IS NULL OR EXISTS \( SELECT 1 FROM public\.assay_sample_type_candidates AS candidate WHERE candidate\.revision_id = v_revision_id AND candidate\.sample_type_id = sample_type\.id \) OR EXISTS \( SELECT 1 FROM public\.assay_sample_type_compatibilities AS compatibility WHERE compatibility\.revision_id = v_revision_id AND compatibility\.sample_type_id = sample_type\.id AND compatibility\.removed_at IS NULL \)/i,
    )
    expect(normalized).toContain(
      "'isActive', sample_type.deleted_at IS NULL",
    )
  })

  it('enforces optimistic review, full coverage, content hashing, and audited reasons', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).toContain('p_expected_revision_updated_at')
    expect(normalized).toContain(
      'revision.updated_at IS DISTINCT FROM p_expected_revision_updated_at',
    )
    expect(normalized).toContain('FOR UPDATE')
    expect(normalized).toContain('content_hash = NULL')
    expect(normalized).toMatch(
      /encode\(\s*digest\([^;]+?'sha256'/i,
    )
    expect(normalized).toContain('assay_definition.deleted_at IS NULL')
    expect(normalized).toContain('candidate.decision IS NULL')
    expect(normalized).toContain('review.disposition = \'configured\'')
    expect(normalized).toContain('review.disposition = \'not_assignable\'')
    expect(normalized).toContain('auth.uid()')
    expect(normalized).toContain('p_creation_reason')
    expect(normalized).toContain('p_review_reason')
    expect(normalized).toContain('p_publish_reason')
    expect(normalized).toMatch(
      /publish_assay_sample_type_catalog_revision[\s\S]*?LOCK TABLE public\.assay_definitions IN SHARE MODE[\s\S]*?LOCK TABLE public\.sample_types IN SHARE MODE[\s\S]*?assert_assay_sample_type_catalog_publishable/i,
    )
  })

  it('records server-owned actors and permits same-manager publication', () => {
    if (!existsSync(migrationPath)) return
    const migration = readFileSync(migrationPath, 'utf8')
    const cloneFunction = extractFunction(
      migration,
      'clone_assay_sample_type_catalog_revision',
    )
    const updateFunction = extractFunction(
      migration,
      'update_assay_sample_type_catalog_review',
    )
    const publishFunction = extractFunction(
      migration,
      'publish_assay_sample_type_catalog_revision',
    )

    expect(cloneFunction).toContain('v_user_id')
    expect(cloneFunction).toContain("'manager'")
    expect(cloneFunction).toContain('btrim(p_creation_reason)')
    expect(updateFunction).toContain('reviewed_by = EXCLUDED.reviewed_by')
    expect(updateFunction).toContain('decided_by = v_user_id')
    expect(updateFunction).toContain('btrim(p_review_reason)')
    expect(publishFunction).toContain('published_by = v_user_id')
    expect(publishFunction).toContain('publish_reason = btrim(p_publish_reason)')
    expect(publishFunction).not.toMatch(
      /created_by\s+IS\s+DISTINCT\s+FROM\s+v_user_id/i,
    )
  })

  it('does not change legacy assignment RPCs', () => {
    if (!existsSync(migrationPath)) return
    const migration = readFileSync(migrationPath, 'utf8')

    expect(migration).not.toMatch(
      /\b(?:create_sample_atomic|accession_and_assign_tests|assign_tests_to_sample)\b/i,
    )
  })
})
