import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/209_expose_compatibility_catalog_stale_state.sql',
)

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true)
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
}

describe('migration 209 compatibility stale state', () => {
  it('replaces only the manager read RPC with a server-calculated stale flag', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'CREATE OR REPLACE FUNCTION public.get_assay_sample_type_catalog_manager',
    )
    expect(sql).toContain("'isStale'")
    expect(sql).toContain("'reviewCompatibilityGeneration'")
    expect(sql).toContain('review.assay_compatibility_generation')
    expect(sql).toContain('compatibility.assay_compatibility_generation')
    expect(sql).toContain('compatibility.sample_type_compatibility_generation')
  })

  it('preserves manager-only SECURITY DEFINER boundaries', () => {
    const sql = readMigration()

    expect(sql).toContain('SECURITY DEFINER')
    expect(sql).toContain('SET search_path = public, extensions')
    expect(sql).toContain(
      "public.get_user_role() IS DISTINCT FROM 'manager'",
    )
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION\s+public\.get_assay_sample_type_catalog_manager\(UUID\)[\s\S]*FROM PUBLIC, anon, authenticated, service_role;/,
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION\s+public\.get_assay_sample_type_catalog_manager\(UUID\)[\s\S]*TO authenticated;/,
    )
  })
})
