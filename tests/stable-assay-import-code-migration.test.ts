import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/201_add_stable_assay_import_codes.sql',
)

function readMigration() {
  return existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : ''
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

describe('stable assay import code migration', () => {
  it('pins the expected schema baseline inside one transaction', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(existsSync(migrationPath)).toBe(true)
    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toMatch(
      /LOCK TABLE public\.assay_definitions IN ACCESS EXCLUSIVE MODE/i,
    )
    expect(normalized).toMatch(
      /to_regclass\('public\.assay_definitions'\) IS NULL/i,
    )
    expect(normalized).toMatch(
      /to_regclass\('public\.assay_import_code_seq'\) IS NOT NULL/i,
    )
    expect(normalized).toMatch(
      /information_schema\.columns[\s\S]*table_name = 'assay_definitions'[\s\S]*column_name = 'import_code'/i,
    )
  })

  it('creates a bounded global non-cycling sequence without API-role access', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE SEQUENCE public\.assay_import_code_seq AS INTEGER INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 START WITH 1 NO CYCLE/i,
    )
    expect(normalized).toContain(
      'REVOKE ALL ON SEQUENCE public.assay_import_code_seq FROM PUBLIC, anon, authenticated, service_role',
    )
    expect(normalized).not.toMatch(
      /GRANT [^;]* ON SEQUENCE public\.assay_import_code_seq/i,
    )

    for (const role of ['anon', 'authenticated', 'service_role']) {
      for (const privilege of ['USAGE', 'SELECT', 'UPDATE']) {
        expect(normalized).toContain(
          `has_sequence_privilege('${role}', 'public.assay_import_code_seq', '${privilege}')`,
        )
      }
    }
  })

  it('backfills every assay deterministically, including soft-deleted rows', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /ALTER TABLE public\.assay_definitions ADD COLUMN import_code TEXT/i,
    )
    expect(normalized).toMatch(
      /row_number\(\) OVER \(ORDER BY assay\.created_at, assay\.id\)/i,
    )
    expect(normalized).toMatch(
      /UPDATE public\.assay_definitions AS assay SET import_code = 'CT-' \|\| lpad\(ordered_assay\.sequence_value::TEXT, 6, '0'\) FROM ordered_assays AS ordered_assay WHERE assay\.id = ordered_assay\.id/i,
    )
    expect(normalized).toContain(
      'ALTER TABLE public.assay_definitions DISABLE TRIGGER update_assay_definitions_updated_at',
    )
    expect(normalized).toContain(
      'ALTER TABLE public.assay_definitions ENABLE TRIGGER update_assay_definitions_updated_at',
    )
    expect(normalized).not.toMatch(
      /DISABLE TRIGGER (?:audit_log_trigger|ALL|USER)/i,
    )
    expect(normalized).not.toMatch(
      /UPDATE public\.assay_definitions[\s\S]*WHERE[\s\S]*deleted_at IS NULL/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) FILTER \(WHERE deleted_at IS NOT NULL AND import_code IS NULL\)/i,
    )
    expect(normalized).toMatch(
      /setval\('public\.assay_import_code_seq'::REGCLASS, GREATEST\(v_assay_count, 1\), v_assay_count > 0\)/i,
    )
  })

  it('enforces generated format, presence, and uniqueness', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /ALTER COLUMN import_code SET DEFAULT '__DATABASE_GENERATED__'/i,
    )
    expect(normalized).toMatch(/ALTER COLUMN import_code SET NOT NULL/i)
    expect(normalized).toMatch(
      /ADD CONSTRAINT assay_definitions_import_code_format CHECK \(import_code ~ '\^CT-\[0-9\]\{6\}\$'\)/i,
    )
    expect(normalized).toMatch(
      /ADD CONSTRAINT assay_definitions_import_code_key UNIQUE \(import_code\)/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) FILTER \(WHERE import_code !~ '\^CT-\[0-9\]\{6\}\$'\)/i,
    )
    expect(normalized).toMatch(
      /GROUP BY import_code HAVING count\(\*\) > 1/i,
    )
  })

  it('preserves manager inserts while rejecting client-supplied codes', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE FUNCTION public\.allocate_assay_import_code\(\) RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp/i,
    )
    expect(normalized).toMatch(
      /IF NEW\.import_code IS DISTINCT FROM '__DATABASE_GENERATED__' THEN RAISE EXCEPTION 'Assay import code must be database generated'/i,
    )
    expect(normalized).toMatch(
      /NEW\.import_code := 'CT-' \|\| lpad\(nextval\('public\.assay_import_code_seq'::REGCLASS\)::TEXT, 6, '0'\)/i,
    )
    expect(normalized).toContain(
      'REVOKE ALL ON FUNCTION public.allocate_assay_import_code() FROM PUBLIC, anon, authenticated, service_role',
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER assay_definitions_allocate_import_code BEFORE INSERT ON public\.assay_definitions FOR EACH ROW EXECUTE FUNCTION public\.allocate_assay_import_code\(\)/i,
    )
  })

  it('rejects changing an assigned import code at the database boundary', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE FUNCTION public\.prevent_assay_import_code_update\(\) RETURNS TRIGGER/i,
    )
    expect(normalized).toMatch(
      /SET search_path = public, pg_temp AS \$\$ BEGIN IF NEW\.import_code IS DISTINCT FROM OLD\.import_code THEN RAISE EXCEPTION/i,
    )
    expect(normalized).toMatch(/USING ERRCODE = '23514'/i)
    expect(normalized).toMatch(
      /CREATE TRIGGER assay_definitions_import_code_immutable BEFORE UPDATE OF import_code ON public\.assay_definitions FOR EACH ROW EXECUTE FUNCTION public\.prevent_assay_import_code_update\(\)/i,
    )
  })

  it('does not change RPC, RLS, method, or application contracts', () => {
    const normalized = normalizeSql(readMigration())
    const functions = Array.from(
      normalized.matchAll(
        /CREATE(?: OR REPLACE)? FUNCTION public\.([a-z0-9_]+)\(/gi,
      ),
      (match) => match[1],
    )

    expect(functions).toEqual([
      'allocate_assay_import_code',
      'prevent_assay_import_code_update',
    ])
    expect(normalized).not.toMatch(/\b(?:CREATE|DROP|ALTER) POLICY\b/i)
    expect(normalized).not.toMatch(/\bmethod_(?:id|name)\b/i)
    expect(normalized).not.toMatch(
      /\b(?:get|create|update)_assay_definition(?:s|_by_id)?\b/i,
    )
  })

  it('verifies sequence position and existing trigger functions', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /SELECT last_value, is_called INTO v_sequence_last_value, v_sequence_is_called FROM public\.assay_import_code_seq/i,
    )
    expect(normalized).toMatch(
      /v_assay_count = 0 AND \(v_sequence_last_value <> 1 OR v_sequence_is_called\)/i,
    )
    expect(normalized).toMatch(
      /v_assay_count > 0 AND \(v_sequence_last_value <> v_assay_count OR NOT v_sequence_is_called\)/i,
    )
    expect(normalized).toContain(
      "tgfoid = 'public.update_updated_at_column()'::REGPROCEDURE",
    )
    expect(normalized).toContain(
      "tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE",
    )
    expect(normalized).toMatch(
      /tgname = 'update_assay_definitions_updated_at'[\s\S]*tgtype = 19[\s\S]*tgattr = ''::INT2VECTOR/i,
    )
    expect(normalized).toMatch(
      /tgname = 'audit_log_trigger'[\s\S]*tgtype = 29[\s\S]*tgattr = ''::INT2VECTOR/i,
    )
    expect(normalized).toMatch(
      /tgname = 'assay_definitions_allocate_import_code'[\s\S]*tgtype = 7[\s\S]*tgattr = ''::INT2VECTOR/i,
    )
    expect(normalized).toMatch(
      /tgname = 'assay_definitions_import_code_immutable'[\s\S]*tgtype = 19[\s\S]*tgattr::TEXT = \(\s*SELECT attnum::TEXT[\s\S]*attname = 'import_code'/i,
    )
  })
})
