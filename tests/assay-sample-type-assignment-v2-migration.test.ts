import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/212_recover_assay_sample_type_assignment_v2.sql',
)
const runtimeTestPath = join(
  process.cwd(),
  'tests/assay-sample-type-assignment-v2.test.sql',
)

const immutableMigrationHashes = new Map([
  ['204_add_sample_type_master_data.sql', 'e6bebc77449e3a4afeee278cf7c45823872c5245ff41b53eaf22896577fcb492'],
  ['205_recover_sample_type_master_data.sql', 'bfabbf645e4424f5e21fada5651ef1aa55a59b26af38464ea393e59d350c5de9'],
  ['206_add_assay_sample_type_compatibility_revision_core.sql', 'b8715e71762bde41b39ea5a441298adfd8c121e9816a9cdda79c56c2eadc3892'],
  ['207_add_compatibility_catalog_service_role_policies.sql', 'dff8e0ffc3f00ef66a4b5b4d858e15b480335d729c65115b2ea154222bbf9e7f'],
  ['208_add_assay_sample_type_catalog_rpcs.sql', 'd187066f5484875b2336de4e62b15c59c459076b22172f99e6c9c7e25bc08cd0'],
  ['209_expose_compatibility_catalog_stale_state.sql', 'f567ef736755cba2b1354827f04a8c0e7018f17720dfa55a7920d323894785e9'],
  ['210_allow_reviewed_compatibility_draft_hash.sql', '11f6dc8bb8d05c20b6b1456ca6c51cfb29508941a558ae271ff119305b2eeb42'],
  ['211_add_assay_sample_type_assignment_v2.sql', '221eedf69644e5c42749b35c029c6936a9cf777c2843a4e48db7e90fc03394a0'],
])

function readMigration() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
}

function normalizeSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

function extractFunction(sql: string, name: string) {
  const normalized = normalizeSql(sql)
  const pattern = new RegExp(
    `CREATE (?:OR REPLACE )?FUNCTION public\\.${name}\\b[\\s\\S]*?\\$\\$;`,
    'i',
  )
  return normalized.match(pattern)?.[0]
}

describe('assay sample-type assignment v2 migration', () => {
  it('adds only migration 212 and preserves the executed migration history', async () => {
    expect(existsSync(migrationPath)).toBe(true)
    const { createHash } = await import('node:crypto')

    for (const [fileName, expectedHash] of immutableMigrationHashes) {
      const contents = readFileSync(
        join(process.cwd(), 'supabase/migrations', fileName),
      )
      expect(
        createHash('sha256').update(contents).digest('hex'),
        fileName,
      ).toBe(expectedHash)
    }
  })

  it('defines a fail-closed resolver with stable compatibility SQLSTATEs', () => {
    const revisionResolver = extractFunction(
      readMigration(),
      'resolve_sample_type_compatibility_revision',
    )
    const resolver = extractFunction(
      readMigration(),
      'resolve_assay_sample_type_compatibility',
    )

    expect(revisionResolver).toBeDefined()
    expect(resolver).toBeDefined()
    expect(resolver).toMatch(
      /p_sample_type_id UUID, p_assay_definition_id UUID, p_expected_revision_number BIGINT DEFAULT NULL/i,
    )
    expect(resolver).toMatch(/RETURNS BIGINT/i)
    expect(revisionResolver).toContain("revision.status = 'published'")
    expect(revisionResolver).toContain('FOR SHARE')
    expect(resolver).toContain('p_expected_revision_number')
    expect(resolver).toContain('sample_type.deleted_at IS NULL')
    expect(resolver).toContain('assay_definition.deleted_at IS NULL')
    expect(resolver).toContain("review.disposition = 'configured'")
    expect(resolver).toContain('compatibility.removed_at IS NULL')
    expect(resolver).toContain('assay_compatibility_generation')
    expect(resolver).toContain('sample_type_compatibility_generation')
    expect(resolver?.match(/FOR SHARE/g)).toHaveLength(2)

    for (const sqlstate of ['P1100', 'P1101', 'P1102']) {
      expect(revisionResolver).toContain(`ERRCODE = '${sqlstate}'`)
    }
    for (const sqlstate of ['P1102', 'P1103', 'P1104', 'P1105', 'P1106']) {
      expect(resolver).toContain(`ERRCODE = '${sqlstate}'`)
    }
  })

  it('adds create, accession, and supplemental assignment v2 signatures', () => {
    const normalized = normalizeSql(readMigration())
    const signatures = [
      'public.create_sample_atomic_v2(UUID, TEXT, TIMESTAMPTZ, UUID, UUID, BOOLEAN, BIGINT)',
      'public.accession_and_assign_tests_v2(UUID, TEXT, TIMESTAMPTZ, JSONB, UUID, BOOLEAN, BIGINT)',
      'public.assign_tests_to_sample_v2(UUID, UUID, JSONB, BIGINT)',
    ]

    for (const signature of signatures) {
      expect(normalized).toContain(`REVOKE ALL ON FUNCTION ${signature}`)
      expect(normalized).toContain(
        `GRANT EXECUTE ON FUNCTION ${signature} TO authenticated`,
      )
    }

    for (const name of [
      'create_sample_atomic_v2',
      'accession_and_assign_tests_v2',
      'assign_tests_to_sample_v2',
    ]) {
      const definition = extractFunction(readMigration(), name)
      expect(definition, name).toMatch(/SECURITY DEFINER/i)
      expect(definition, name).toContain('SET search_path = public, extensions')
      expect(definition, name).toContain("'compatibility_revision_number'")
    }
    expect(readMigration()).toContain("'sample_type_code'")
  })

  it('preserves authorization, quality, status, method, duplicate, and audit paths', () => {
    const createFunction = extractFunction(readMigration(), 'create_sample_atomic_v2')
    const accessionFunction = extractFunction(
      readMigration(),
      'accession_and_assign_tests_v2',
    )
    const assignFunction = extractFunction(
      readMigration(),
      'assign_tests_to_sample_v2',
    )

    expect(createFunction).toContain(
      "v_user_role IS DISTINCT FROM 'analyst'",
    )
    expect(accessionFunction).toContain(
      "v_user_role IS DISTINCT FROM 'analyst'",
    )
    expect(assignFunction).toContain(
      "v_user_role IS NULL OR v_user_role NOT IN ('analyst', 'manager')",
    )
    expect(createFunction).toContain('p_sample_quality IS NULL')
    expect(accessionFunction).toContain('p_sample_quality IS NULL')
    expect(createFunction).toContain("'received'")
    expect(accessionFunction).toContain("'assigned'")
    expect(assignFunction).toContain("v_sample_status NOT IN ('received', 'assigned')")
    expect(accessionFunction).toContain("NULLIF(v_test->>'methodId', '')::UUID")
    expect(assignFunction).toContain("NULLIF(test->>'methodId', '')::UUID")
    expect(assignFunction).toContain('SELECT DISTINCT assay_id, method_id')
    expect(assignFunction).toContain('v_zero_uuid')
    expect(
      assignFunction!.indexOf('LEFT JOIN public.results AS existing'),
    ).toBeLessThan(
      assignFunction!.indexOf(
        'resolve_assay_sample_type_compatibility',
      ),
    )
    expect(readMigration()).toContain('audit_samples_trigger')
    expect(readMigration()).toContain('audit_results_trigger')
  })

  it('validates every accession pair before inserting sample, result, or audit rows', () => {
    const accessionFunction = extractFunction(
      readMigration(),
      'accession_and_assign_tests_v2',
    )
    expect(accessionFunction).toBeDefined()

    const lastResolver = accessionFunction!.lastIndexOf(
      'resolve_assay_sample_type_compatibility',
    )
    const sampleInsert = accessionFunction!.indexOf('INSERT INTO public.samples')
    const resultInsert = accessionFunction!.indexOf('INSERT INTO public.results')

    expect(lastResolver).toBeGreaterThan(-1)
    expect(lastResolver).toBeLessThan(sampleInsert)
    expect(sampleInsert).toBeLessThan(resultInsert)
  })

  it('pins assign v2 to the stored sample type and validates before inserts', () => {
    const assignFunction = extractFunction(
      readMigration(),
      'assign_tests_to_sample_v2',
    )
    expect(assignFunction).toBeDefined()
    expect(assignFunction).toContain('sample_type_id')
    expect(assignFunction).toContain('FOR UPDATE')
    expect(assignFunction).toContain('IS DISTINCT FROM p_sample_type_id')
    expect(assignFunction).toContain("ERRCODE = 'P1102'")
    expect(
      assignFunction!.indexOf('resolve_assay_sample_type_compatibility'),
    ).toBeLessThan(assignFunction!.indexOf('INSERT INTO public.results'))
  })

  it('keeps legacy RPCs and Phase 8 enforcement untouched', () => {
    const migration = readMigration()

    expect(migration).not.toMatch(
      /DROP FUNCTION public\.(?:create_sample_atomic|accession_and_assign_tests|assign_tests_to_sample)\(/i,
    )
    expect(migration).not.toMatch(
      /CREATE OR REPLACE FUNCTION public\.(?:create_sample_atomic|accession_and_assign_tests|assign_tests_to_sample)\(/i,
    )
    expect(migration).not.toMatch(/CREATE TRIGGER[\s\S]*BEFORE INSERT ON public\.results/i)
    expect(migration).not.toMatch(
      /ALTER TABLE public\.samples[\s\S]*sample_type_id[\s\S]*(?:IMMUTABLE|TRIGGER)/i,
    )
  })

  it('ships rollback, lifecycle, history, and security runtime coverage', () => {
    expect(existsSync(runtimeTestPath)).toBe(true)
    const runtimeTest = readFileSync(runtimeTestPath, 'utf8')

    expect(runtimeTest).toContain('BEGIN;')
    expect(runtimeTest).toContain('ROLLBACK;')
    expect(runtimeTest).toContain('accession_and_assign_tests_v2')
    expect(runtimeTest).toContain('assign_tests_to_sample_v2')
    expect(runtimeTest).toContain('resolve_assay_sample_type_compatibility')
    expect(runtimeTest).toContain('SQLSTATE')
    expect(runtimeTest).toContain("'P1100'")
    expect(runtimeTest).toContain('method_name')
    expect(runtimeTest).toContain('deleted_at')
    expect(runtimeTest).toContain('compatibility_generation')
    expect(runtimeTest).toContain('audit_logs')
    expect(runtimeTest).toContain('authenticated user without application role')
    expect(runtimeTest).toContain('result audit')
    expect(runtimeTest).toContain('historical result remains unchanged')
  })
})
