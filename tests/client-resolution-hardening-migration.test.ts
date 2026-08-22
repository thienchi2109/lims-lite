import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration221Path =
  'supabase/migrations/221_add_deterministic_client_resolver_v2.sql'
const migration222Path =
  'supabase/migrations/222_harden_deterministic_client_resolver_v2.sql'

describe('client resolver v2 forward-only hardening migration', () => {
  it('keeps applied migration 221 byte-for-byte immutable', () => {
    const digest = createHash('sha256')
      .update(readFileSync(migration221Path))
      .digest('hex')

    expect(digest).toBe(
      '8e0058aeeb3987f24466acac7b89af884b8e89a40cf0a5c19c4250b761a26783',
    )
  })

  it('fails closed for missing roles and exact-plus-accent candidates', () => {
    const sql = readFileSync(migration222Path, 'utf8')

    expect(sql).toMatch(
      /COALESCE\s*\(\s*public\.get_user_role\(\)\s*,\s*''\s*\)\s+NOT IN\s*\(\s*'analyst'\s*,\s*'manager'\s*\)/i,
    )
    expect(sql).toContain('resolve_client_identity_internal_v2_221')
    expect(sql).toContain('accent_only_conflict')
    expect(sql).toContain('is_client_collision_confirmed_distinct_v1')
  })

  it('re-resolves only named client uniqueness conflicts', () => {
    const sql = readFileSync(migration222Path, 'utf8')

    expect(sql).toMatch(
      /GET STACKED DIAGNOSTICS\s+v_constraint_name\s*=\s*CONSTRAINT_NAME/i,
    )
    expect(sql).toContain('clients_unique_trusted_government_identity')
    expect(sql).toContain('clients_unique_identity')
    expect(sql).toContain('CLIENT_RESOLUTION_CREATE_FAILED')
  })

  it('reasserts least-privilege grants after replacing resolver functions', () => {
    const sql = readFileSync(migration222Path, 'utf8')

    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.resolve_client_identity_internal_v2[\s\S]+FROM authenticated/i,
    )
    expect(sql).toMatch(
      /REVOKE ALL ON FUNCTION public\.resolve_client_identity_v2[\s\S]+FROM service_role/i,
    )
    expect(sql).toMatch(
      /GRANT EXECUTE ON FUNCTION public\.resolve_or_create_client_v2[\s\S]+TO authenticated/i,
    )
  })
})
