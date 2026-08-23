import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const additiveMigrationPath =
  'supabase/migrations/228_add_transactional_client_sample_cutover.sql'
const rollbackTestPath = 'tests/client-resolution-caller-cutover.test.sql'
const concurrencyTestPath =
  'tests/client-resolution-caller-cutover-concurrency.test.sql'

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

describe('Phase 6 deterministic client caller cutover additive migration', () => {
  it('ships only the reversible transaction gate artifacts', () => {
    expect(existsSync(additiveMigrationPath)).toBe(true)
    expect(existsSync(rollbackTestPath)).toBe(true)
    expect(existsSync(concurrencyTestPath)).toBe(true)
  })

  it('adds atomic client resolution with locked sample creation and accession', () => {
    const migration = read(additiveMigrationPath)
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toContain(
      'CREATE FUNCTION public.create_sample_with_client_resolution_v2',
    )
    expect(normalized).toContain(
      'CREATE FUNCTION public.accession_and_assign_tests_with_client_resolution_v2',
    )
    expect(normalized).toContain('resolve_or_create_client_v2')
    expect(normalized).toContain('resolve_client_identity_v2')
    expect(normalized).toContain('FOR UPDATE')
    expect(normalized).toContain('deleted_at IS NULL')
    expect(normalized).toContain('client_name')
    expect(normalized).toContain('SECURITY DEFINER')
    expect(normalized).toContain('SET search_path = public, extensions')
    expect(normalized).toContain(
      "get_user_role()::TEXT IS DISTINCT FROM 'analyst'",
    )
  })

  it('keeps public grants minimal for the additive RPCs', () => {
    const normalized = normalizeSql(read(additiveMigrationPath))

    for (const functionName of [
      'create_sample_with_client_resolution_v2',
      'accession_and_assign_tests_with_client_resolution_v2',
    ]) {
      expect(normalized).toMatch(
        new RegExp(
          `REVOKE ALL ON FUNCTION public\\.${functionName}\\([^;]+\\) FROM PUBLIC`,
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
  })

  it('returns stable non-disclosing outcomes after client revalidation', () => {
    const normalized = normalizeSql(read(additiveMigrationPath))

    expect(normalized).toContain(
      "IF NOT FOUND THEN RETURN QUERY SELECT 'conflict'::TEXT, 'inactive_candidate'::TEXT, NULL::UUID, FALSE::BOOLEAN, NULL::TEXT",
    )
    expect(normalized).toContain(
      "IF v_revalidated.outcome IS DISTINCT FROM 'matched' THEN RETURN QUERY SELECT v_revalidated.outcome::TEXT, v_revalidated.reason_code::TEXT, v_revalidated.client_id::UUID, v_revalidated.created::BOOLEAN, NULL::TEXT",
    )
    expect(normalized).toContain(
      "RAISE EXCEPTION 'Client resolution target changed during accession' USING ERRCODE = '40001'",
    )
    expect(normalized).not.toContain('initial_client_id=')
    expect(normalized).not.toContain('revalidated_client_id=')
  })

  it('requires every registered security test to pass before commit', () => {
    const normalized = normalizeSql(read(additiveMigrationPath))

    expect(normalized).toContain('bool_and(passed)')
    expect(normalized).toContain(
      "bool_or(test_name = 'Client Resolution Sample Cutover Security' AND passed)",
    )
  })

  it('covers ambiguous, audit, and two-session revalidation behavior', () => {
    const rollback = normalizeSql(read(rollbackTestPath))
    const concurrencySql = read(concurrencyTestPath)
    const concurrency = normalizeSql(concurrencySql)

    expect(rollback).toContain("'{resolution,outcome}' = 'ambiguous'")
    expect(rollback).toContain('FROM public.audit_logs')
    expect(rollback).toContain("table_name = 'clients'")
    expect(rollback).toContain("table_name = 'samples'")
    expect(concurrencySql).toContain('pg_sleep(1)')
    expect(concurrency).toContain("'{resolution,outcome}' = 'conflict'")
    expect(concurrency).toContain("'{resolution,reason_code}' = 'inactive_candidate'")
  })

  it('keeps the irreversible retirement gate closed', () => {
    const normalized = normalizeSql(read(additiveMigrationPath))

    expect(normalized).toContain(
      'CREATE FUNCTION public.resolve_and_lock_accession_client_v2_228',
    )
    expect(normalized).toContain(
      'REVOKE ALL ON FUNCTION public.resolve_and_lock_accession_client_v2_228',
    )
    expect(normalized).toContain(
      'test_client_resolution_sample_cutover_security',
    )
    expect(normalized).toContain('clients_unique_identity')
    expect(normalized).not.toContain(
      'DROP CONSTRAINT clients_unique_identity',
    )
    expect(normalized).not.toContain(
      'REVOKE UPDATE (id_card_num, name, date_of_birth, gender, phone)',
    )
  })
})
