import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migration = readFileSync(
  'supabase/migrations/150_add_analyst_otp_management_prerequisites.sql',
  'utf8',
)

function extractFunction(name: string) {
  const start = migration.indexOf(`CREATE OR REPLACE FUNCTION public.${name}()`)
  const next = migration.indexOf('\nCREATE OR REPLACE FUNCTION public.', start + 1)
  const end = next === -1 ? migration.length : next
  return migration.slice(start, end)
}

describe('analyst email OTP Phase 1 migration', () => {
  it('allows manager confidential-access changes only for analyst rows', () => {
    expect(migration).toContain('OLD.role <> \'analyst\' OR NEW.role <> \'analyst\'')
    expect(migration).toContain('Managers can only change confidential access for analyst accounts')
    expect(migration).toContain('NEW.can_access_confidential IS DISTINCT FROM OLD.can_access_confidential')
  })

  it('adds manager-managed analyst OTP settings access without manager env flag controls', () => {
    expect(migration).toContain('manager_otp_settings')
    expect(migration).toContain('role = \'analyst\'')
    expect(migration).toContain('Managers can insert analyst OTP settings')
    expect(migration).not.toContain('ANALYST_HIV_EMAIL_OTP_ENABLED')
  })

  it('audits OTP destination changes without storing plaintext email values', () => {
    const auditFunction = extractFunction('audit_manager_otp_settings_changes')

    expect(auditFunction).toContain('audit_manager_otp_settings_changes')
    expect(auditFunction).toContain('otp_email_hash')
    expect(auditFunction).not.toContain('to_jsonb(NEW)')
    expect(auditFunction).not.toContain('to_jsonb(OLD)')
  })

  it('adds a preflight RPC for confidential analysts missing OTP email settings', () => {
    expect(migration).toContain('get_confidential_analysts_missing_otp_email')
    expect(migration).toContain('can_access_confidential IS TRUE')
    expect(migration).toContain('manager_otp_settings')
  })
})
