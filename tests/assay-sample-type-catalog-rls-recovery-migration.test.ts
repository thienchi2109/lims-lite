import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const compatibilityMigrationPath = join(
  process.cwd(),
  'supabase/migrations/206_add_assay_sample_type_compatibility_revision_core.sql',
)
const recoveryMigrationPath = join(
  process.cwd(),
  'supabase/migrations/207_add_compatibility_catalog_service_role_policies.sql',
)

function readMigration(path: string) {
  return readFileSync(path, 'utf8')
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

const catalogTables = [
  'assay_sample_type_catalog_revisions',
  'assay_sample_type_reviews',
  'assay_sample_type_compatibilities',
  'assay_sample_type_candidates',
] as const

describe('compatibility catalog RLS recovery migration', () => {
  it('keeps executed migration 206 immutable and adds migration 207', () => {
    const compatibilityMigration = readMigration(compatibilityMigrationPath)
    const checksum = createHash('sha256')
      .update(compatibilityMigration)
      .digest('hex')

    expect(checksum).toBe(
      'b8715e71762bde41b39ea5a441298adfd8c121e9816a9cdda79c56c2eadc3892',
    )
    expect(existsSync(recoveryMigrationPath)).toBe(true)
  })

  it('adds one explicit service-role SELECT policy per internal table', () => {
    const migration = readMigration(recoveryMigrationPath)
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)

    for (const tableName of catalogTables) {
      expect(normalized).toContain(
        `to_regclass('public.${tableName}') IS NULL`,
      )
      expect(normalized).toMatch(
        new RegExp(
          `DROP POLICY IF EXISTS "[^"]+" ON public\\.${tableName}; CREATE POLICY "[^"]+" ON public\\.${tableName} FOR SELECT TO service_role USING \\(\\(\\(SELECT auth\\.jwt\\(\\)\\) ->> 'role'\\) = 'service_role'\\)`,
          'i',
        ),
      )
    }
  })

  it('keeps anonymous and authenticated access fully revoked', () => {
    const normalized = normalizeSql(readMigration(recoveryMigrationPath))

    expect(normalized).not.toMatch(
      /CREATE POLICY [^;]+ TO (?:anon|authenticated)/i,
    )
    expect(normalized).not.toMatch(
      /GRANT [^;]+ TO (?:anon|authenticated)/i,
    )
    expect(normalized).toContain(
      "polroles = ARRAY['service_role'::REGROLE::OID]",
    )
    expect(normalized).toContain(
      "has_table_privilege('service_role', v_qualified_table, 'SELECT')",
    )
    expect(normalized).toContain(
      "has_table_privilege('authenticated', v_qualified_table, 'SELECT')",
    )
    expect(normalized).toContain(
      "has_table_privilege('anon', v_qualified_table, 'SELECT')",
    )
  })
})
