import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const migrationPath =
  'supabase/migrations/230_remove_clients_unique_identity.sql'

function readMigration() {
  return readFileSync(migrationPath, 'utf8')
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

function readDoBlock(blockName: string) {
  const migration = readMigration()
  const startToken = `DO $${blockName}$`
  const endToken = `$${blockName}$;`
  const start = migration.indexOf(startToken)
  const end = migration.indexOf(endToken, start)

  if (start === -1 || end === -1) {
    throw new Error(`Missing ${startToken} migration block`)
  }

  return migration.slice(start, end + endToken.length)
}

describe('client retirement gate migration', () => {
  it('ships as one bounded transaction with explicit operational limits', () => {
    expect(existsSync(migrationPath)).toBe(true)

    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(migration).toContain('Irreversible:')
    expect(migration).toContain('Zero intended row mutation')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toContain("SET LOCAL lock_timeout = '5s';")
    expect(normalized).toContain("SET LOCAL statement_timeout = '60s';")
    expect(normalized).toContain(
      'SET LOCAL search_path TO public, extensions;',
    )
    expect(normalized).toMatch(/COMMIT;$/i)
  })

  it('requires the exact legacy gate and v2 resolver signatures', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain('DO $baseline$')
    expect(normalized).toContain(
      "constraint_record.conname = 'clients_unique_identity'",
    )
    expect(normalized).toContain("constraint_record.contype = 'u'")
    expect(normalized).toContain(
      "pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (name, date_of_birth)'",
    )

    for (const signature of [
      'public.resolve_client_identity_v2(text,text,text,date,text)',
      'public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)',
    ]) {
      expect(normalized).toContain(`'${signature}'`)
      expect(normalized).toContain('to_regprocedure(v_signature)')
    }
  })

  it('reuses the canonical projection and snapshot trigger drift checks', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      'client.normalized_name IS DISTINCT FROM public.normalize_client_name_v1(client.name)',
    )
    expect(normalized).toContain(
      'client.normalized_phone IS DISTINCT FROM public.normalize_client_phone_v1(client.phone)',
    )
    expect(normalized).toContain(
      'client.government_identity_value IS DISTINCT FROM public.normalize_client_government_identity_v1(client.id_card_num)',
    )
    expect(normalized).toContain(
      'client.government_identity_type IS DISTINCT FROM public.classify_client_government_identity_v1(client.id_card_num)',
    )

    expect(normalized).toContain(
      "trigger_record.tgrelid = 'public.samples'::REGCLASS",
    )
    expect(normalized).toContain(
      "trigger_record.tgname = 'sync_samples_client_name'",
    )
    expect(normalized).toContain(
      "trigger_record.tgfoid = 'public.sync_client_name_snapshot()'::REGPROCEDURE",
    )
    expect(normalized).toContain('NOT trigger_record.tgisinternal')
    expect(normalized).toContain("trigger_record.tgenabled = 'O'")
    expect(normalized).toContain(
      "pg_get_triggerdef(trigger_record.oid) ILIKE '%BEFORE INSERT OR UPDATE OF client_id ON public.samples%'",
    )
  })

  it('requires all eight pre-gate column grants without broad update', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      "has_table_privilege('authenticated', 'public.clients', 'UPDATE')",
    )
    expect(normalized).toContain(
      "'id_card_num', 'name', 'date_of_birth', 'gender', 'phone', 'address', 'health_insurance_num', 'expiry_date'",
    )
    expect(normalized).toMatch(
      /IF NOT has_column_privilege\('authenticated', 'public\.clients', v_column, 'UPDATE'\) THEN RAISE EXCEPTION 'Migration 230 requires pre-gate authenticated UPDATE on %'/,
    )
  })

  it('drops only the legacy gate and removes direct identity updates', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      'ALTER TABLE public.clients DROP CONSTRAINT clients_unique_identity;',
    )
    expect(normalized.match(/DROP CONSTRAINT/gi)).toHaveLength(1)
    expect(normalized).toContain(
      'REVOKE UPDATE (id_card_num, name, date_of_birth) ON public.clients FROM authenticated;',
    )
  })

  it('replaces the security test with post-retirement grant and RPC checks', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      'CREATE OR REPLACE FUNCTION public.test_client_resolution_sample_cutover_security()',
    )
    expect(normalized).toContain('RETURNS BOOLEAN LANGUAGE plpgsql STABLE')
    expect(normalized).toContain('SET search_path = public, extensions')
    expect(normalized).toContain(
      "set_config('lims.migration230_security_test_owner'",
    )
    expect(normalized).toContain(
      "current_setting('lims.migration230_security_test_owner')",
    )
    expect(normalized).toMatch(
      /FOREACH v_column IN ARRAY ARRAY\[\s*'id_card_num', 'name', 'date_of_birth'\s*\] LOOP IF has_column_privilege\('authenticated', 'public\.clients', v_column, 'UPDATE'\) THEN RETURN FALSE;/,
    )
    expect(normalized).toMatch(
      /FOREACH v_column IN ARRAY ARRAY\[\s*'gender', 'phone', 'address', 'health_insurance_num', 'expiry_date'\s*\] LOOP IF NOT has_column_privilege\('authenticated', 'public\.clients', v_column, 'UPDATE'\) THEN RETURN FALSE;/,
    )

    for (const signature of [
      'public.create_sample_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,uuid,boolean,bigint)',
      'public.accession_and_assign_tests_with_client_resolution_v2(boolean,text,text,text,date,text,text,text,text,date,timestamp with time zone,jsonb,uuid,boolean,bigint)',
    ]) {
      expect(normalized).toContain(`'${signature}'`)
    }

    expect(normalized).toContain(
      'REVOKE ALL ON FUNCTION public.test_client_resolution_sample_cutover_security() FROM PUBLIC, anon, service_role;',
    )
    expect(normalized).toContain(
      'GRANT EXECUTE ON FUNCTION public.test_client_resolution_sample_cutover_security() TO authenticated;',
    )
  })

  it('updates the runner and function comment to post-retirement semantics', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)
    const runnerUpdate = normalizeSql(readDoBlock('update_security_test'))
    const verification = normalizeSql(readDoBlock('verify'))
    const oldDescription =
      'Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, and reversible legacy gate preservation'
    const newDescription =
      'Verifies analyst-only transactional client/sample RPCs, minimal grants, fixed search_path, locked client-name snapshot, post-retirement identity-column protection and legacy constraint removal'

    expect(normalized).toContain(
      "pg_get_functiondef('public.run_security_tests()'::REGPROCEDURE)",
    )
    expect(runnerUpdate).toContain(
      `v_old_description TEXT := '${oldDescription}';`,
    )
    expect(runnerUpdate).toContain(
      `v_new_description TEXT := '${newDescription}';`,
    )
    expect(runnerUpdate).toContain(
      "IF v_definition NOT LIKE '%' || v_old_description || '%' OR v_definition LIKE '%' || v_new_description || '%' THEN",
    )
    expect(runnerUpdate).toContain(
      'EXECUTE replace(v_definition, v_old_description, v_new_description);',
    )
    expect(verification).toContain(
      `v_new_description TEXT := '${newDescription}';`,
    )
    expect(verification).toContain(
      `v_old_description TEXT := '${oldDescription}';`,
    )
    expect(verification).toContain(
      "v_runner_definition NOT LIKE '%' || v_new_description || '%' OR v_runner_definition LIKE '%' || v_old_description || '%'",
    )
    expect(normalized).toContain(
      'COMMENT ON FUNCTION public.test_client_resolution_sample_cutover_security()',
    )
    expect(normalized).toContain(
      'public.test_client_resolution_sample_cutover_security()',
    )
    expect(normalized).toContain('FROM public.run_security_tests()')
  })

  it('verifies the final gate without changing client rows or rebuilding uniqueness', () => {
    const normalized = normalizeSql(readMigration())
    const verification = normalizeSql(readDoBlock('verify'))
    const clientsTable = String.raw`(?:(?:public|"public")\s*\.\s*)?(?:clients|"clients")`
    const sqlAlias = String.raw`(?:"(?:[^"]|"")*"|[a-z_][a-z0-9_$]*)`

    expect(verification).toContain('DO $verify$')
    expect(verification).toContain(
      'SELECT public.test_client_resolution_sample_cutover_security() INTO v_security_test_passed;',
    )
    expect(normalized).toMatch(
      /RETURN NOT EXISTS \(SELECT 1 FROM pg_constraint AS constraint_record WHERE constraint_record\.conrelid = 'public\.clients'::REGCLASS AND constraint_record\.conname = 'clients_unique_identity'\)/,
    )
    expect(verification).toMatch(
      /IF EXISTS \(SELECT 1 FROM pg_constraint AS constraint_record WHERE constraint_record\.conrelid = 'public\.clients'::REGCLASS AND constraint_record\.conname = 'clients_unique_identity'\) THEN RAISE EXCEPTION 'Migration 230 failed to remove the legacy client identity gate'/,
    )
    expect(verification).toMatch(
      /FOREACH v_column IN ARRAY ARRAY\[\s*'id_card_num', 'name', 'date_of_birth'\s*\] LOOP IF has_column_privilege\('authenticated', 'public\.clients', v_column, 'UPDATE'\) THEN RAISE EXCEPTION 'Migration 230 left protected authenticated UPDATE on %'/,
    )
    expect(verification).toMatch(
      /FOREACH v_column IN ARRAY ARRAY\[\s*'gender', 'phone', 'address', 'health_insurance_num', 'expiry_date'\s*\] LOOP IF NOT has_column_privilege\('authenticated', 'public\.clients', v_column, 'UPDATE'\) THEN RAISE EXCEPTION 'Migration 230 removed approved authenticated UPDATE on %'/,
    )
    expect(normalized).not.toMatch(
      new RegExp(
        String.raw`\bDELETE\s+FROM\s+(?:ONLY\s+)?${clientsTable}(?:\s*\*)?(?=\s|;|$)`,
        'i',
      ),
    )
    expect(normalized).not.toMatch(
      new RegExp(
        String.raw`\bTRUNCATE\b[^;]*${clientsTable}(?=\s|,|;|$)`,
        'i',
      ),
    )
    expect(normalized).not.toMatch(
      new RegExp(
        String.raw`\bUPDATE\s+(?:ONLY\s+)?${clientsTable}(?:\s*\*)?(?:\s+(?:AS\s+)?${sqlAlias})?\s+SET\b`,
        'i',
      ),
    )
    expect(normalized).not.toMatch(/CREATE\s+UNIQUE/i)
    expect(normalized).not.toMatch(/ADD\s+CONSTRAINT/i)
  })
})
