import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const originalMigrationPath = join(
  process.cwd(),
  'supabase/migrations/201_add_stable_assay_import_codes.sql',
)
const recoveryMigrationPath = join(
  process.cwd(),
  'supabase/migrations/203_recover_stable_assay_import_code_core.sql',
)

function readMigration(path: string) {
  return readFileSync(path, 'utf8')
}

describe('stable assay import-code core recovery migration', () => {
  it('adds a forward-only recovery migration without editing migration 201', () => {
    expect(existsSync(originalMigrationPath)).toBe(true)
    expect(existsSync(recoveryMigrationPath)).toBe(true)
  })

  it('preserves the migration 201 contract with the PostgreSQL regtype fix', () => {
    const originalMigration = readMigration(originalMigrationPath)
    const recoveryMigration = readMigration(recoveryMigrationPath)
    const expectedRecovery = originalMigration
      .replaceAll('Migration 201', 'Migration 203')
      .replace(
        '-- Migration 203: Add stable assay import codes.',
        [
          '-- Migration 203: Recover stable assay import-code core.',
          '--',
          '-- Migration 201 rolled back atomically on PostgreSQL 15 because its',
          "-- pg_sequences.data_type check compared regtype to the bare 'integer'",
          '-- literal. This forward-only recovery preserves the original contract',
          '-- and uses an explicit regtype cast in that verification.',
        ].join('\n'),
      )
      .replace(
        "AND data_type = 'integer'",
        "AND data_type = 'integer'::REGTYPE",
      )

    expect(recoveryMigration).toBe(expectedRecovery)
  })
})
