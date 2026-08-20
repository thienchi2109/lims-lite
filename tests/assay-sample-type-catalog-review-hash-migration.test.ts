import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/210_allow_reviewed_compatibility_draft_hash.sql',
)

function readMigration() {
  expect(existsSync(migrationPath)).toBe(true)
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
}

describe('migration 210 reviewed compatibility draft hash', () => {
  it('allows a draft review hash without weakening published state fields', () => {
    const sql = readMigration()

    expect(sql).toContain(
      'DROP CONSTRAINT assay_sample_type_catalog_status_fields',
    )
    expect(sql).toMatch(
      /status = 'draft'[\s\S]*published_by IS NULL[\s\S]*superseded_at IS NULL/,
    )
    expect(sql).not.toMatch(
      /status = 'draft'\s+AND content_hash IS NULL/,
    )
    expect(sql).toMatch(
      /status = 'published'[\s\S]*content_hash IS NOT NULL[\s\S]*publish_reason IS NOT NULL/,
    )
    expect(sql).toMatch(
      /status = 'superseded'[\s\S]*content_hash IS NOT NULL[\s\S]*superseded_by IS NOT NULL/,
    )
  })

  it('proves the reviewed draft hash transition and rolls back test data', () => {
    const sql = readMigration()

    expect(sql).toContain("SET content_hash = repeat('0', 64)")
    expect(sql).toContain("RAISE EXCEPTION 'ROLLBACK_REVIEW_HASH_TEST'")
    expect(sql).toContain(
      "SQLERRM IS DISTINCT FROM 'ROLLBACK_REVIEW_HASH_TEST'",
    )
    expect(sql).toContain(
      'Migration 210 verification left a draft review hash behind',
    )
  })
})
