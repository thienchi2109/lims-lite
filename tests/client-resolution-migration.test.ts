import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/221_add_deterministic_client_resolver_v2.sql',
)
const resolverTestPath = join(
  process.cwd(),
  'tests/client-resolution.test.sql',
)
const securityTestPath = join(
  process.cwd(),
  'tests/client-resolution-security.test.sql',
)
const concurrencyTestPath = join(
  process.cwd(),
  'tests/client-resolution-concurrency.test.sql',
)

const immutableMigrations = [
  [
    '215_add_client_canonical_foundation.sql',
    'd4aae749da2ddfb873dbd9994c7da0d9567d370df6f56ab0c58a6beadc159659',
  ],
  [
    '216_add_client_lifecycle_rpcs.sql',
    '6c6776a3684ea38cacc806a8465b6999f82b53e3fb0d50082e4edca45c515325',
  ],
  [
    '217_add_client_collision_adjudications_deny_policy.sql',
    'bd8c268568d4c936d67be73e86c7130881cf14fb4c71cd899ee6b83af3bce965',
  ],
  [
    '218_guard_client_lifecycle_mutations.sql',
    '114c3d16ec0cc81e8bc2fc0877011b522429ca8740fa32989d01b79d4d8bee3c',
  ],
  [
    '219_guard_client_lifecycle_mutations.sql',
    'bbc988b4b521fa86f12c3521a4e263410c6269e2f8c6717fba1183c18f9b0738',
  ],
  [
    '220_classify_legacy_client_identity.sql',
    'c5431a6f0b03324feba8bd52bd65f10d829a2da1022b56d97e7ca973cc472a7a',
  ],
] as const

function read(path: string) {
  return existsSync(path) ? readFileSync(path, 'utf8') : ''
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

function extractSqlStatement(sql: string, pattern: RegExp) {
  const statement = normalizeSql(sql).match(pattern)?.[0]

  expect(statement).toBeDefined()
  return statement ?? ''
}

describe('deterministic client resolver v2 migration', () => {
  it('keeps migrations 215-220 immutable and adds forward-only migration 221', () => {
    for (const [fileName, expectedHash] of immutableMigrations) {
      const path = join(process.cwd(), 'supabase/migrations', fileName)
      const actualHash = createHash('sha256')
        .update(readFileSync(path, 'utf8'))
        .digest('hex')

      expect(actualHash, fileName).toBe(expectedHash)
    }

    expect(existsSync(migrationPath)).toBe(true)
  })

  it('fails closed on the Phase 3 checkpoint before trusted uniqueness', () => {
    const migration = read(migrationPath)
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toContain('LOCK TABLE public.clients')
    expect(normalized).toContain('projection mismatches')
    expect(normalized).toContain('unresolved canonical collisions')
    expect(normalized).toContain(
      'public.is_client_collision_confirmed_distinct_v1',
    )
  })

  it('adds trusted typed identity uniqueness across active and inactive clients', () => {
    const migration = read(migrationPath)
    const indexStatement = extractSqlStatement(
      migration,
      /CREATE UNIQUE INDEX clients_unique_trusted_government_identity\b[^;]+;/i,
    )

    expect(indexStatement).toContain(
      'CREATE UNIQUE INDEX clients_unique_trusted_government_identity',
    )
    expect(indexStatement).toContain(
      'ON public.clients (government_identity_type, government_identity_value)',
    )
    expect(indexStatement).toContain(
      'WHERE government_identity_trusted AND government_identity_value IS NOT NULL',
    )
    expect(indexStatement).not.toContain('deleted_at IS NULL')
  })

  it('adds additive resolver and transactional resolve-or-create RPCs', () => {
    const normalized = normalizeSql(read(migrationPath))

    expect(normalized).toContain(
      'CREATE FUNCTION public.resolve_client_identity_v2',
    )
    expect(normalized).toContain(
      'CREATE FUNCTION public.resolve_or_create_client_v2',
    )
    expect(normalized).toContain(
      'RETURNS TABLE (outcome TEXT, reason_code TEXT, client_id UUID, created BOOLEAN)',
    )
    expect(normalized).toContain('pg_advisory_xact_lock')
    expect(normalized).toContain(
      "'client-resolution-v2:accent-name-dob:%s:%s'",
    )
    expect(normalized).toContain(
      'hashtextextended(candidate.lock_key, 0) AS lock_id',
    )
    expect(normalized).toContain('ORDER BY lock_id')
    expect(normalized).toContain('WHEN unique_violation THEN')
    expect(normalized).toContain("'CLIENT_CREATED_V2'")
    expect(normalized).toContain("'client_created'")
  })

  it('uses fixed security boundaries and minimal grants', () => {
    const normalized = normalizeSql(read(migrationPath))

    expect(normalized.match(/SECURITY DEFINER/g)?.length).toBeGreaterThanOrEqual(2)
    expect(normalized).toContain('SET search_path = public, extensions')
    expect(normalized).toContain(
      "get_user_role() NOT IN ('analyst', 'manager')",
    )

    for (const functionName of [
      'resolve_client_identity_v2',
      'resolve_or_create_client_v2',
    ]) {
      expect(normalized).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]+\\) FROM PUBLIC`,
          'i',
        ),
      )
      expect(normalized).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]+\\) FROM service_role`,
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

    expect(normalized).not.toMatch(
      /GRANT (SELECT|INSERT|UPDATE|DELETE|TRUNCATE) ON (TABLE )?public\.clients/i,
    )
  })

  it('does not merge clients or mutate sample and history links', () => {
    const normalized = normalizeSql(read(migrationPath))

    expect(normalized).not.toMatch(
      /UPDATE public\.(samples|results|client_collision_adjudications)\b/i,
    )
    expect(normalized).not.toMatch(
      /DELETE FROM public\.(clients|samples|results)\b/i,
    )
    expect(normalized).not.toMatch(/\bmerge(?:d|s|_into)?\b/i)
    expect(normalized).not.toMatch(/\brelink\b/i)
  })

  it('snapshots every existing client column before asserting no migration rewrite', () => {
    const migration = read(migrationPath)
    const snapshotStatement = extractSqlStatement(
      migration,
      /CREATE TEMP TABLE phase4_client_snapshot\b[^;]+;/i,
    )

    expect(snapshotStatement).toContain('updated_at, search_vector,')
    expect(snapshotStatement).toContain('FROM public.clients;')
  })

  it('ships rollback, security, and concurrency coverage for every resolver outcome', () => {
    const resolverSql = normalizeSql(read(resolverTestPath))
    const securitySql = normalizeSql(read(securityTestPath))
    const concurrencyScript = read(concurrencyTestPath)
    const concurrencySql = normalizeSql(concurrencyScript)

    for (const path of [
      resolverTestPath,
      securityTestPath,
      concurrencyTestPath,
    ]) {
      expect(existsSync(path), path).toBe(true)
    }

    for (const outcome of ['matched', 'not_found', 'ambiguous', 'conflict']) {
      expect(resolverSql).toContain(`'${outcome}'`)
    }

    for (const reasonCode of [
      'trusted_identity_match',
      'trusted_identity_not_found',
      'trusted_identity_ambiguous',
      'trusted_identity_disagreement',
      'name_dob_match',
      'name_dob_ambiguous',
      'inactive_candidate',
      'accent_only_conflict',
      'phone_conflict',
      'cross_key_conflict',
      'restricted_candidate',
      'invalid_identity_input',
      'client_created',
    ]) {
      expect(`${resolverSql} ${securitySql}`).toContain(`'${reasonCode}'`)
    }

    expect(resolverSql).toMatch(/ROLLBACK;$/i)
    expect(securitySql).toMatch(/ROLLBACK;$/i)
    expect(concurrencySql).toContain("current_database() = 'postgres'")
    expect(concurrencySql).toContain('\\setenv PGDATABASE :concurrency_database')
    expect(concurrencyScript).not.toContain('-d postgres')
    expect(concurrencyScript).toContain('pg_sleep')
    expect(concurrencyScript).toContain('deadlock detected')
  })
})
