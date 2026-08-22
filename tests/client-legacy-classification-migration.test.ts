import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/220_classify_legacy_client_identity.sql',
)
const rollbackTestPath = join(
  process.cwd(),
  'tests/client-legacy-classification.test.sql',
)
const checkpointPath = join(
  process.cwd(),
  'tests/client-identity-cleanup-checkpoint.sql',
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
] as const

function readFile(path: string) {
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

describe('legacy client identity classification migration', () => {
  it('keeps applied migrations 215-219 immutable and adds migration 220', () => {
    for (const [fileName, expectedHash] of immutableMigrations) {
      const path = join(process.cwd(), 'supabase/migrations', fileName)
      const actualHash = createHash('sha256')
        .update(readFileSync(path, 'utf8'))
        .digest('hex')

      expect(actualHash, fileName).toBe(expectedHash)
    }

    expect(existsSync(migrationPath)).toBe(true)
  })

  it('classifies existing rows without changing legacy identity evidence', () => {
    const migration = readFile(migrationPath)
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toContain(
      'LOCK TABLE public.clients IN ACCESS EXCLUSIVE MODE',
    )
    expect(normalized).toContain('phase3_client_snapshot')
    expect(normalized).toContain('phase3_sample_link_snapshot')
    expect(normalized).toContain('phase3_client_policy_snapshot')
    expect(normalized).toContain('phase3_client_acl_snapshot')
    expect(normalized).toContain('phase3_audit_snapshot')
    expect(normalized).toMatch(
      /UPDATE public\.clients SET government_identity_type = public\.classify_client_government_identity_v1\(id_card_num\), government_identity_value = public\.normalize_client_government_identity_v1\(id_card_num\), government_identity_trusted = public\.normalize_client_government_identity_v1\(id_card_num\) IS NOT NULL, normalized_name = public\.normalize_client_name_v1\(name\), normalized_phone = public\.normalize_client_phone_v1\(phone\)/i,
    )
    expect(normalized).toContain(
      'public.normalize_client_phone_v1(phone) IS DISTINCT FROM normalized_phone',
    )
    expect(normalized).toContain(
      'public.normalize_client_government_identity_v1(id_card_num) IS DISTINCT FROM government_identity_value',
    )
    expect(normalized).toContain(
      'public.classify_client_government_identity_v1(id_card_num) IS DISTINCT FROM government_identity_type',
    )
    expect(normalized).not.toMatch(
      /SET (?:id_card_num|name|date_of_birth|phone|address)\s*=/i,
    )
    expect(normalized).not.toMatch(
      /UPDATE public\.(?:samples|results|audit_logs)\b/i,
    )
    expect(normalized).not.toMatch(
      /DELETE FROM public\.(?:clients|samples|results)\b/i,
    )
  })

  it('fails closed unless canonical projections and history remain reconciled', () => {
    const normalized = normalizeSql(readFile(migrationPath))

    for (const requiredObject of [
      'public.normalize_client_name_v1(text)',
      'public.normalize_client_phone_v1(text)',
      'public.normalize_client_government_identity_v1(text)',
      'public.classify_client_government_identity_v1(text)',
      'public.maintain_client_identity_projections()',
      'public.adjudicate_client_collision_v1(uuid,uuid,timestamp with time zone,timestamp with time zone,text,text,text)',
      'public.client_collision_adjudications',
    ]) {
      expect(normalized).toContain(requiredObject)
    }

    for (const triggerName of [
      'audit_clients_changes',
      'clients_maintain_identity_projections',
      'clients_search_update',
      'update_clients_updated_at',
    ]) {
      expect(normalized).toContain(`'${triggerName}'`)
    }
    expect(normalized).toContain('tgname = v_required_trigger')

    expect(normalized).toContain('client raw evidence changed')
    expect(normalized).toContain('client UUID set changed')
    expect(normalized).toContain('sample history links changed')
    expect(normalized).toContain('client RLS policy contract changed')
    expect(normalized).toContain('client grant contract changed')
    expect(normalized).toContain('classification audit coverage is incomplete')
    expect(normalized).toContain('client canonical projection reconciliation failed')
    expect(normalized).toContain(
      "id_card_num LIKE 'BACKFILL-%' AND government_identity_trusted",
    )
    expect(normalized).toContain(
      "phone = '0000000000' AND normalized_phone IS NOT NULL",
    )
  })

  it('does not introduce resolver, uniqueness, merge, or relink behavior', () => {
    const normalized = normalizeSql(readFile(migrationPath))

    expect(normalized).not.toMatch(
      /CREATE UNIQUE INDEX(?: IF NOT EXISTS)? \S+ ON public\.clients/i,
    )
    expect(normalized).not.toMatch(
      /CREATE(?: OR REPLACE)? FUNCTION public\.resolve_client/i,
    )
    expect(normalized).not.toMatch(/DROP (?:POLICY|INDEX|CONSTRAINT|COLUMN)/i)
    expect(normalized).not.toMatch(/ALTER TABLE public\.clients DROP/i)
    expect(normalized).not.toMatch(/\bmerge(?:d|s|_into)?\b/i)
    expect(normalized).not.toMatch(/\brelink\b/i)
    expect(normalized).not.toMatch(
      /INSERT INTO public\.client_collision_adjudications/i,
    )
  })

  it('ships rollback-only runtime coverage for legacy classification', () => {
    const rollbackSql = normalizeSql(readFile(rollbackTestPath))

    expect(existsSync(rollbackTestPath)).toBe(true)
    expect(rollbackSql).toContain('BEGIN;')
    expect(rollbackSql).toMatch(/ROLLBACK;$/i)
    expect(rollbackSql).toContain('SET LOCAL statement_timeout')
    expect(rollbackSql).toContain('BACKFILL-PHASE3')
    expect(rollbackSql).toContain('0000000000')
    expect(rollbackSql).toContain('client-normalization-v1')
    expect(rollbackSql).toContain('classification preserves raw identity evidence')
    expect(rollbackSql).toContain('classification preserves sample links')
    expect(rollbackSql).toContain('classification emits client audit evidence')
    expect(rollbackSql).toContain(
      'legacy client identity classification rollback tests passed',
    )
  })

  it('ships a read-only, aggregate-only cleanup checkpoint', () => {
    const checkpoint = readFile(checkpointPath)
    const normalized = normalizeSql(checkpoint)

    expect(existsSync(checkpointPath)).toBe(true)
    expect(normalized).toContain('BEGIN READ ONLY;')
    expect(normalized).toMatch(/ROLLBACK;$/i)
    expect(checkpoint).toContain('\\if :{?expected_unresolved_pairs}')
    expect(checkpoint).toContain('\\set expected_unresolved_pairs')

    for (const aggregateKey of [
      'client_rows',
      'trusted_government_identity_rows',
      'untrusted_government_identity_rows',
      'missing_phone_projection_rows',
      'projection_mismatch_rows',
      'government_identity_pairs',
      'phone_pairs',
      'name_date_of_birth_pairs',
      'inactive_history_pairs',
      'unresolved_pair_total',
      'sample_link_rows',
      'adjudication_rows',
    ]) {
      expect(checkpoint).toContain(`'${aggregateKey}'`)
    }

    expect(normalized).toContain("evidence_level = 'legacy_identity'")
    expect(normalized).toContain('first_client.deleted_at IS NOT NULL')
    expect(normalized).toContain('second_client.deleted_at IS NOT NULL')
    expect(normalized).toContain(
      'unresolved_pair_total = :expected_unresolved_pairs',
    )
    expect(normalized).not.toMatch(/array_agg\s*\([^)]*\bid\b/i)
    expect(normalized).not.toMatch(/jsonb_agg\s*\([^)]*\bid\b/i)
    expect(normalized).not.toMatch(/\b(email|address|full_name)\b/i)
  })
})
