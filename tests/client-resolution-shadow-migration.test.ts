import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/226_add_client_resolution_shadow_telemetry.sql',
)
const correctionMigrationPath = path.join(
  process.cwd(),
  'supabase/migrations/227_fix_client_resolution_shadow_expiry_pruning.sql',
)
const immutableMigration224Path = path.join(
  process.cwd(),
  'supabase/migrations/224_add_client_resolution_shadow_telemetry.sql',
)
const immutableMigration225Path = path.join(
  process.cwd(),
  'supabase/migrations/225_add_client_resolution_shadow_telemetry.sql',
)
const immutableMigration226Path = migrationPath

describe('client resolution shadow telemetry migration', () => {
  it('keeps failed rehearsal migration 224 byte-for-byte immutable', () => {
    const migration = fs.readFileSync(immutableMigration224Path)

    expect(createHash('sha256').update(migration).digest('hex')).toBe(
      '1e5a5f619d39b6cd07bcaa458cc97bfe6727c970152759d80a6813d3132c1cf0',
    )
  })

  it('keeps failed rehearsal migration 225 byte-for-byte immutable', () => {
    const migration = fs.readFileSync(immutableMigration225Path)

    expect(createHash('sha256').update(migration).digest('hex')).toBe(
      '78fec17a15f11e404c3957a38ef37d54e4a650082132f1ff096560d09125f395',
    )
  })

  it('keeps applied rehearsal migration 226 byte-for-byte immutable', () => {
    const migration = fs.readFileSync(immutableMigration226Path)

    expect(createHash('sha256').update(migration).digest('hex')).toBe(
      '71a91358705a80975e651fb193e28c5dcc43aac65c3adf517b8c67939072ed7d',
    )
  })

  it('qualifies expiry pruning in a forward-only correction', () => {
    const migration = fs.readFileSync(correctionMigrationPath, 'utf8')
    const functionBody = migration.match(
      /CREATE OR REPLACE FUNCTION public\.record_client_resolution_shadow_v1[\s\S]*?AS \$\$([\s\S]*?)\$\$;/,
    )?.[1]

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.record_client_resolution_shadow_v1',
    )
    expect(functionBody).toContain(
      'DELETE FROM public.client_resolution_shadow_events AS event',
    )
    expect(functionBody).toContain(
      'WHERE event.expires_at <= clock_timestamp()',
    )
    expect(functionBody).not.toContain(
      'WHERE expires_at <= clock_timestamp()',
    )
  })

  it('creates a PII-free, retention-bounded telemetry store', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8')
    const tableDefinition = migration.match(
      /CREATE TABLE public\.client_resolution_shadow_events \(([\s\S]*?)\n\);/,
    )?.[1]

    expect(tableDefinition).toBeDefined()
    expect(tableDefinition).toContain('caller_category')
    expect(tableDefinition).toContain('legacy_outcome')
    expect(tableDefinition).toContain('legacy_reason_code')
    expect(tableDefinition).toContain('v2_outcome')
    expect(tableDefinition).toContain('v2_reason_code')
    expect(tableDefinition).toContain('correlation_id')
    expect(tableDefinition).toContain('observed_at')
    expect(tableDefinition).toContain('expires_at TIMESTAMPTZ NOT NULL')
    expect(migration).toContain("v_observed_at + INTERVAL '30 days'")
    expect(tableDefinition).not.toMatch(
      /\b(client_id|actor_id|name|phone|government_identity|date_of_birth|hash|fingerprint|source|payload|jsonb)\b/i,
    )
    expect(migration).toContain(
      'DELETE FROM public.client_resolution_shadow_events',
    )
    expect(migration).toContain('WHERE expires_at <= clock_timestamp()')
  })

  it('keeps direct access denied and records only through a service-role RPC', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8')

    expect(migration).toContain(
      'ALTER TABLE public.client_resolution_shadow_events ENABLE ROW LEVEL SECURITY',
    )
    expect(migration).toContain(
      'ALTER TABLE public.client_resolution_shadow_events FORCE ROW LEVEL SECURITY',
    )
    expect(migration).toContain(
      'DROP POLICY IF EXISTS "Deny direct shadow telemetry access"',
    )
    expect(migration).toContain(
      'CREATE POLICY "Deny direct shadow telemetry access"',
    )
    expect(migration).toMatch(
      /get_user_role\(\).*IN \('analyst', 'manager'\)[\s\S]*FALSE/i,
    )
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.record_client_resolution_shadow_v1',
    )
    expect(migration).toContain('TO service_role')
    expect(migration).toMatch(
      /REVOKE ALL ON FUNCTION public\.record_client_resolution_shadow_v1[\s\S]*FROM authenticated/,
    )
  })

  it('evaluates legacy and v2 before inserting one aggregate event', () => {
    const migration = fs.readFileSync(migrationPath, 'utf8')
    const functionBody = migration.match(
      /CREATE FUNCTION public\.record_client_resolution_shadow_v1[\s\S]*?AS \$\$([\s\S]*?)\$\$;/,
    )?.[1]

    expect(functionBody).toBeDefined()
    expect(functionBody).toContain(
      'public.resolve_client_identity_internal_v2(',
    )
    expect(functionBody).toContain(
      'INSERT INTO public.client_resolution_shadow_events',
    )
    expect(functionBody?.indexOf('resolve_client_identity_internal_v2')).toBeLessThan(
      functionBody?.indexOf(
        'INSERT INTO public.client_resolution_shadow_events',
      ) ?? -1,
    )
    expect(functionBody).not.toMatch(
      /\b(INSERT INTO|UPDATE|DELETE FROM) public\.(clients|samples)\b/i,
    )
  })
})
