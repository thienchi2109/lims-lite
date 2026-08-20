import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const originalMigrationPath = join(
  process.cwd(),
  'supabase/migrations/204_add_sample_type_master_data.sql',
)
const recoveryMigrationPath = join(
  process.cwd(),
  'supabase/migrations/205_recover_sample_type_master_data.sql',
)
const compatibilityMigrationPath = join(
  process.cwd(),
  'supabase/migrations/206_add_assay_sample_type_compatibility_revision_core.sql',
)
const supersededCompatibilityPath = join(
  process.cwd(),
  'supabase/migrations/205_add_assay_sample_type_compatibility_revision_core.sql',
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

describe('sample-type master-data recovery migration', () => {
  it('keeps executed migration 204 immutable and advances compatibility to 206', () => {
    const originalMigration = readMigration(originalMigrationPath)
    const checksum = createHash('sha256')
      .update(originalMigration)
      .digest('hex')

    expect(checksum).toBe(
      'e6bebc77449e3a4afeee278cf7c45823872c5245ff41b53eaf22896577fcb492',
    )
    expect(existsSync(recoveryMigrationPath)).toBe(true)
    expect(existsSync(compatibilityMigrationPath)).toBe(true)
    expect(existsSync(supersededCompatibilityPath)).toBe(false)

    const compatibilityMigration = readMigration(compatibilityMigrationPath)
    expect(compatibilityMigration).toContain('Migration 206')
    expect(compatibilityMigration).not.toContain('Migration 205')
  })

  it('recovers only an absent foundation and rejects partial bootstrap state', () => {
    const migration = readMigration(recoveryMigrationPath)
    const normalized = normalizeSql(migration)

    expect(migration).toContain('\\gset')
    expect(migration).toContain('\\if :lims_sample_type_foundation_absent')
    expect(migration).toContain('\\elif :lims_sample_type_foundation_present')
    expect(migration).toContain('\\else')
    expect(migration).toContain('\\endif')
    expect(normalized).toMatch(
      /to_regclass\('public\.sample_types'\) IS NULL[\s\S]*to_regclass\('public\.sample_type_import_code_seq'\) IS NULL[\s\S]*column_name = 'sample_type_id'/i,
    )
    expect(normalized).toMatch(
      /to_regclass\('public\.sample_types'\) IS NOT NULL[\s\S]*to_regclass\('public\.sample_type_import_code_seq'\) IS NOT NULL[\s\S]*column_name = 'sample_type_id'/i,
    )
    expect(normalized).toContain(
      'Migration 205 found a partial sample-type master-data foundation',
    )
  })

  it('disables only receiver and timestamp triggers during historical backfill', () => {
    const normalized = normalizeSql(readMigration(recoveryMigrationPath))
    const backfillStart = normalized.indexOf(
      'ALTER TABLE public.samples DISABLE TRIGGER update_samples_updated_at',
    )
    const receiverDisable = normalized.indexOf(
      'ALTER TABLE public.samples DISABLE TRIGGER samples_enforce_analyst_receiver',
      backfillStart,
    )
    const sampleUpdate = normalized.indexOf(
      'UPDATE public.samples AS sample SET sample_type_id = sample_type.id',
      receiverDisable,
    )
    const receiverEnable = normalized.indexOf(
      'ALTER TABLE public.samples ENABLE TRIGGER samples_enforce_analyst_receiver',
      sampleUpdate,
    )
    const timestampEnable = normalized.indexOf(
      'ALTER TABLE public.samples ENABLE TRIGGER update_samples_updated_at',
      receiverEnable,
    )

    expect(backfillStart).toBeGreaterThan(-1)
    expect(receiverDisable).toBeGreaterThan(backfillStart)
    expect(sampleUpdate).toBeGreaterThan(receiverDisable)
    expect(receiverEnable).toBeGreaterThan(sampleUpdate)
    expect(timestampEnable).toBeGreaterThan(receiverEnable)
    expect(normalized).not.toMatch(
      /ALTER TABLE public\.samples DISABLE TRIGGER (?:ALL|USER|audit_samples_trigger)/i,
    )
  })

  it('pins and verifies the exact receiver trigger contract', () => {
    const normalized = normalizeSql(readMigration(recoveryMigrationPath))

    expect(normalized).toContain(
      "tgname = 'samples_enforce_analyst_receiver'",
    )
    expect(normalized).toContain(
      "tgfoid = 'public.enforce_analyst_sample_receiver()'::REGPROCEDURE",
    )
    expect(normalized).toContain("tgenabled = 'O'")
    expect(normalized).toContain(
      "tgname = 'audit_samples_trigger'",
    )
    expect(normalized).toContain(
      "tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE",
    )
  })
})
