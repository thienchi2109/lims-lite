import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/219_guard_client_lifecycle_mutations.sql',
  'utf8',
)
const normalized = migration.replace(/--.*$/gm, ' ').replace(/\s+/g, ' ')

describe('client lifecycle guard migration', () => {
  it('keeps the applied lifecycle migrations immutable', () => {
    expect(
      createHash('sha256')
        .update(readFileSync('supabase/migrations/216_add_client_lifecycle_rpcs.sql'))
        .digest('hex'),
    ).toBe('6c6776a3684ea38cacc806a8465b6999f82b53e3fb0d50082e4edca45c515325')
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            'supabase/migrations/217_add_client_collision_adjudications_deny_policy.sql',
          ),
        )
        .digest('hex'),
    ).toBe('bd8c268568d4c936d67be73e86c7130881cf14fb4c71cd899ee6b83af3bce965')
    expect(
      createHash('sha256')
        .update(
          readFileSync(
            'supabase/migrations/218_guard_client_lifecycle_mutations.sql',
          ),
        )
        .digest('hex'),
    ).toBe('114c3d16ec0cc81e8bc2fc0877011b522429ca8740fa32989d01b79d4d8bee3c')
  })

  it('removes destructive and broad update privileges', () => {
    expect(normalized).toContain(
      'REVOKE DELETE, TRUNCATE, UPDATE ON TABLE public.clients FROM authenticated;',
    )
    expect(normalized).toContain(
      "has_table_privilege( 'authenticated', 'public.clients', 'UPDATE,DELETE,TRUNCATE' )",
    )
  })

  it('preserves only legacy identity and approved profile updates', () => {
    expect(normalized).toMatch(
      /GRANT UPDATE \( id_card_num, name, date_of_birth, gender, phone, address, health_insurance_num, expiry_date \) ON public\.clients TO authenticated;/,
    )
    for (const field of [
      'deleted_at',
      'deleted_by',
      'deletion_reason',
      'government_identity_type',
      'government_identity_value',
      'government_identity_trusted',
    ]) {
      expect(normalized).toContain(`'${field}'`)
    }
  })
})
