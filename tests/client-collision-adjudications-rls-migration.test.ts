import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const lifecycleMigrationPath = join(
  process.cwd(),
  'supabase/migrations/216_add_client_lifecycle_rpcs.sql',
)
const policyMigrationPath = join(
  process.cwd(),
  'supabase/migrations/217_add_client_collision_adjudications_deny_policy.sql',
)

function normalizeSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .trim()
}

describe('client collision adjudications RLS correction migration', () => {
  it('keeps migration 216 immutable and adds migration 217', () => {
    const checksum = createHash('sha256')
      .update(readFileSync(lifecycleMigrationPath))
      .digest('hex')

    expect(checksum).toBe(
      '6c6776a3684ea38cacc806a8465b6999f82b53e3fb0d50082e4edca45c515325',
    )
    expect(existsSync(policyMigrationPath)).toBe(true)
  })

  it('adds one explicit restrictive deny-all policy without new grants', () => {
    const migration = readFileSync(policyMigrationPath, 'utf8')
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toContain(
      "to_regclass('public.client_collision_adjudications') IS NULL",
    )
    expect(normalized).toContain(
      'DROP POLICY IF EXISTS "No direct access to client collision adjudications" ON public.client_collision_adjudications;',
    )
    expect(normalized).toMatch(
      /CREATE POLICY "No direct access to client collision adjudications" ON public\.client_collision_adjudications AS RESTRICTIVE FOR ALL TO PUBLIC USING \(false\) WITH CHECK \(false\);/i,
    )
    expect(normalized).not.toMatch(/\bGRANT\b/i)
  })

  it('verifies the exact policy catalog and existing privilege boundary', () => {
    const normalized = normalizeSql(
      readFileSync(policyMigrationPath, 'utf8'),
    )

    expect(normalized).toContain("policy.polpermissive IS FALSE")
    expect(normalized).toContain("policy.polroles = ARRAY[0::OID]")
    expect(normalized).toContain("policy.polcmd = '*'")
    expect(normalized).toContain(
      "pg_get_expr(policy.polqual, policy.polrelid) = 'false'",
    )
    expect(normalized).toContain(
      "pg_get_expr(policy.polwithcheck, policy.polrelid) = 'false'",
    )
    expect(normalized).toMatch(
      /has_table_privilege\('(?:anon|authenticated|service_role)', 'public\.client_collision_adjudications', 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE'\)/i,
    )
  })
})
