import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/216_add_client_lifecycle_rpcs.sql',
)
const migration215Path = join(
  process.cwd(),
  'supabase/migrations/215_add_client_canonical_foundation.sql',
)

function normalizeSql(sql: string) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/--.*$/gm, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

describe('client lifecycle RPC migration', () => {
  it('keeps applied migration 215 immutable and adds migration 216', () => {
    const migration215 = readFileSync(migration215Path, 'utf8')

    expect(createHash('sha256').update(migration215).digest('hex')).toBe(
      'd4aae749da2ddfb873dbd9994c7da0d9567d370df6f56ab0c58a6beadc159659',
    )
    expect(existsSync(migrationPath)).toBe(true)
  })

  it('defines manager-only lifecycle and adjudication RPCs', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))
    const functions = [
      'get_client_lifecycle_manager_v1',
      'get_client_lifecycle_detail_manager_v1',
      'deactivate_client_v1',
      'restore_client_v1',
      'correct_client_identity_v1',
      'adjudicate_client_collision_v1',
    ]

    for (const functionName of functions) {
      expect(normalized).toMatch(
        new RegExp(
          `CREATE FUNCTION public\\.${functionName}\\b[\\s\\S]*?SECURITY DEFINER[\\s\\S]*?SET search_path = public, extensions`,
          'i',
        ),
      )
      expect(normalized).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]+\\) FROM PUBLIC, anon, authenticated, service_role`,
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

    expect(normalized.match(/get_user_role\(\) IS DISTINCT FROM 'manager'/g))
      .toHaveLength(6)
  })

  it('uses stable SQLSTATEs, optimistic locking, and atomic reason-bearing audit', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    for (const sqlState of [
      'P1110',
      'P1111',
      'P1112',
      'P1113',
      'P1114',
      'P1115',
      'P1116',
      'P1117',
    ]) {
      expect(normalized).toContain(`ERRCODE = '${sqlState}'`)
    }

    expect(normalized).toContain('p_expected_updated_at')
    expect(normalized).toContain(
      'client.updated_at IS DISTINCT FROM p_expected_updated_at',
    )
    expect(normalized).toContain('FOR UPDATE')
    expect(normalized).toContain("'CLIENT_DEACTIVATED'")
    expect(normalized).toContain("'CLIENT_RESTORED'")
    expect(normalized).toContain("'CLIENT_IDENTITY_CORRECTED'")
    expect(normalized).toContain("'CLIENT_COLLISION_ADJUDICATED'")
    expect(normalized).toContain("'reason', v_reason")
    expect(normalized).toContain("'corrected_fields'")
    expect(normalized).toContain('v_corrected_fields TEXT[]')
    expect(normalized).toContain('cardinality(v_corrected_fields) = 0')
    expect(normalized).toContain('to_jsonb(v_corrected_fields)')
    expect(normalized).toContain('changed_by')
    expect(normalized).toContain('auth.uid()')
    expect(
      normalized.match(
        /LOCK TABLE public\.clients IN SHARE ROW EXCLUSIVE MODE/g,
      ),
    ).toHaveLength(4)
    expect(normalized).toContain('p_collision_type IS NULL')
    expect(normalized).toContain('p_disposition IS NULL')
  })

  it('reserves phone and name/date-of-birth evidence across inactive clients', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).not.toContain('other_client.deleted_at IS NULL')
    expect(normalized).toContain(
      'btrim(other_client.id_card_num) = btrim(p_id_card_num)',
    )
  })

  it('adds immutable adjudication records and non-disclosing collision evidence', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).toContain(
      'CREATE TABLE public.client_collision_adjudications',
    )
    expect(normalized).toContain(
      'ALTER TABLE public.client_collision_adjudications ENABLE ROW LEVEL SECURITY',
    )
    expect(normalized).toContain(
      'CREATE TRIGGER audit_client_collision_adjudications',
    )
    expect(normalized).toContain("'legacy_identity'")
    expect(normalized).toContain("'restricted'")
    expect(normalized).toContain(
      "candidate.evidence_level <> 'restricted'",
    )
    expect(normalized).toContain("'collisionCandidates'")
    expect(normalized).toContain("'confirmed_distinct'")
    expect(normalized).toContain("'correction_required'")
    expect(normalized).toContain(
      "v_collision_evidence_level = 'trusted'",
    )
    expect(normalized).not.toMatch(
      /GRANT (SELECT|INSERT|UPDATE|DELETE|TRUNCATE) ON (TABLE )?public\.client_collision_adjudications/i,
    )
  })

  it('requires the exact client audit, projection, search, and timestamp triggers', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    for (const [triggerName, functionName] of [
      ['audit_clients_changes', 'trigger_audit_log'],
      ['clients_maintain_identity_projections', 'maintain_client_identity_projections'],
      ['clients_search_update', 'update_search_vector_clients'],
      ['update_clients_updated_at', 'update_updated_at_column'],
    ]) {
      expect(normalized).toContain(`tgname = '${triggerName}'`)
      expect(normalized).toContain(
        `tgfoid = 'public.${functionName}()'::REGPROCEDURE`,
      )
      expect(normalized).toContain("tgenabled = 'O'")
    }
  })

  it('keeps UUID/history links stable and exposes only masked list evidence', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).toContain('UPDATE public.clients')
    expect(normalized).not.toMatch(/UPDATE public\.(samples|results)\b/i)
    expect(normalized).not.toMatch(/DELETE FROM public\.(clients|samples|results)\b/i)
    expect(normalized).toContain("'maskedIdentity'")
    expect(normalized).toContain("'maskedPhone'")
    expect(normalized).toContain("'collisionReasons'")
    expect(normalized).toContain("'sampleCount'")
  })

  it('remains additive before the Phase 2.7 guard gate', () => {
    if (!existsSync(migrationPath)) return
    const normalized = normalizeSql(readFileSync(migrationPath, 'utf8'))

    expect(normalized).not.toMatch(/DROP POLICY/i)
    expect(normalized).not.toMatch(/REVOKE (DELETE|TRUNCATE|UPDATE) ON TABLE/i)
    expect(normalized).not.toMatch(/ALTER TABLE public\.clients DROP/i)
  })
})
