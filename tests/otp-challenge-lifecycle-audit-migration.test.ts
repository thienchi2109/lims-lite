import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/152_audit_otp_challenge_lifecycle.sql',
  'utf8',
)

describe('OTP challenge lifecycle audit migration', () => {
  it('audits challenge lifecycle without copying OTP verifier material', () => {
    expect(migration).toContain('audit_manager_otp_challenge_lifecycle')
    expect(migration).toContain('session_id_hash')
    expect(migration).not.toContain('to_jsonb(NEW)')
    expect(migration).not.toContain('to_jsonb(OLD)')
    expect(migration).not.toContain('\'code_hash\', NEW.code_hash')
    expect(migration).not.toContain('\'code_hash\', OLD.code_hash')
  })

  it('adds a security test for lifecycle audit coverage', () => {
    expect(migration).toContain('test_otp_challenge_lifecycle_audit')
    expect(migration).toContain('manager_otp_challenges')
  })
})
