import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/154_allow_analyst_otp_self_read.sql',
  'utf8',
)

describe('analyst email OTP Phase 2 migration', () => {
  it('allows confidential analysts to read only their own OTP destination metadata', () => {
    expect(migration).toContain('DROP POLICY IF EXISTS "Analysts can read own OTP settings"')
    expect(migration).toContain('CREATE POLICY "Analysts can read own OTP settings"')
    expect(migration).toContain("ON public.manager_otp_settings FOR SELECT")
    expect(migration).toContain("target_user.id = manager_otp_settings.user_id")
    expect(migration).toContain("target_user.id = auth.uid()")
    expect(migration).toContain("target_user.role = 'analyst'::public.user_role")
    expect(migration).toContain('target_user.can_access_confidential IS TRUE')
    expect(migration).toContain('target_user.deleted_at IS NULL')
  })

  it('extends the analyst OTP security test to cover analyst self-read policy', () => {
    expect(migration).toContain('test_analyst_otp_management_prerequisites')
    expect(migration).toContain('Analysts can read own OTP settings')
  })
})
