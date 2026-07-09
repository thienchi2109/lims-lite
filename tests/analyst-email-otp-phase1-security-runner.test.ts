import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/153_register_otp_lifecycle_security_test.sql',
  'utf8',
)

describe('analyst email OTP Phase 1 security runner registration', () => {
  it('adds analyst OTP prerequisites to run_security_tests', () => {
    expect(migration).toContain('CREATE OR REPLACE FUNCTION public.run_security_tests()')
    expect(migration).toContain('Analyst OTP Management Prerequisites')
    expect(migration).toContain('test_analyst_otp_management_prerequisites()')
    expect(migration).toContain('OTP Challenge Lifecycle Audit')
    expect(migration).toContain('test_otp_challenge_lifecycle_audit()')
  })
})
