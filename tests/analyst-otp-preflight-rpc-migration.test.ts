import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const migrationPath = 'supabase/migrations/191_harden_analyst_otp_preflight_rpc.sql'

function readMigration(): string {
  expect(existsSync(migrationPath), `Missing ${migrationPath}`).toBe(true)
  return readFileSync(migrationPath, 'utf8')
}

describe('analyst OTP preflight RPC hardening migration', () => {
  it('uses an atomic forward-only migration with baseline verification', () => {
    const migration = readMigration()

    expect(migration).toContain('BEGIN;')
    expect(migration).toContain('SET LOCAL search_path TO public, extensions;')
    expect(migration).toContain(
      "to_regprocedure('public.get_confidential_analysts_missing_otp_email()')",
    )
    expect(migration).toContain('Migration 191 found an unexpected')
    expect(migration).toContain('COMMIT;')
  })

  it('keeps the RPC signature while enforcing manager or service-role access', () => {
    const migration = readMigration()

    expect(migration).toContain(
      'CREATE OR REPLACE FUNCTION public.get_confidential_analysts_missing_otp_email()',
    )
    expect(migration).toContain('LANGUAGE plpgsql')
    expect(migration).toContain('SECURITY DEFINER')
    expect(migration).toContain("SET search_path TO 'public', 'extensions'")
    expect(migration).toContain('auth.role()')
    expect(migration).toContain('auth.uid()')
    expect(migration).toContain('public.get_user_role()')
    expect(migration).toContain("'service_role'")
    expect(migration).toContain("'manager'::public.user_role")
    expect(migration).toContain("ERRCODE = '42501'")
    expect(migration).toContain(
      'REVOKE ALL ON FUNCTION public.get_confidential_analysts_missing_otp_email()',
    )
    expect(migration).toContain('FROM PUBLIC, anon;')
    expect(migration).toContain(
      'GRANT EXECUTE ON FUNCTION public.get_confidential_analysts_missing_otp_email()',
    )
    expect(migration).toContain('TO authenticated, service_role;')
  })

  it('registers a dedicated authorization checker in the security runner', () => {
    const migration = readMigration()

    expect(migration).toContain(
      'public.test_analyst_otp_preflight_rpc_authorization()',
    )
    expect(migration).toContain('pg_get_functiondef')
    expect(migration).toContain('prosecdef')
    expect(migration).toContain('proconfig')
    expect(migration).toContain('has_function_privilege')
    expect(migration).toContain('Analyst OTP Preflight RPC Authorization')
    expect(migration).toContain('Sample Quality Enforcement')
    expect(migration).toContain("NOTIFY pgrst, 'reload schema';")
  })

  it('does not change manager OTP settings table or policy contracts', () => {
    const migration = readMigration()

    expect(migration).not.toMatch(
      /(?:ALTER TABLE|CREATE POLICY|DROP POLICY)\s+(?:IF EXISTS\s+)?(?:public\.)?manager_otp_settings/i,
    )
    expect(migration).not.toMatch(
      /(?:GRANT|REVOKE).+ON\s+(?:TABLE\s+)?(?:public\.)?manager_otp_settings/i,
    )
  })
})
