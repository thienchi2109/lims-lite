import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/204_add_sample_type_master_data.sql',
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

describe('sample type master data migration', () => {
  it('pins the expected baseline and aborts unsafe historical mappings', () => {
    const migration = readMigration()
    const normalized = normalizeSql(migration)

    expect(existsSync(migrationPath)).toBe(true)
    expect(migration).toContain('Security impact:')
    expect(migration).toContain('Historical data impact:')
    expect(normalized).toMatch(/^BEGIN;/i)
    expect(normalized).toMatch(/COMMIT;$/i)
    expect(normalized).toMatch(
      /LOCK TABLE public\.samples IN ACCESS EXCLUSIVE MODE/i,
    )
    expect(normalized).toContain(
      "to_regclass('public.sample_types') IS NOT NULL",
    )
    expect(normalized).toContain(
      "to_regclass('public.sample_type_import_code_seq') IS NOT NULL",
    )
    expect(normalized).toMatch(
      /column_name = 'sample_type_id'[\s\S]*RAISE EXCEPTION/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) FILTER \(WHERE type IS NULL OR btrim\(type\) = ''\)/i,
    )
    expect(normalized).toMatch(
      /GROUP BY public\.normalize_sample_type_name\(type\) HAVING count\(DISTINCT type\) > 1/i,
    )
    expect(normalized).toMatch(
      /IF v_blank_count <> 0 OR v_collision_count <> 0/i,
    )
    expect(normalized).toMatch(/IF v_sample_type_count > 999999/i)
  })

  it('creates immutable bounded LM import codes without API sequence access', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE SEQUENCE public\.sample_type_import_code_seq AS INTEGER INCREMENT BY 1 MINVALUE 1 MAXVALUE 999999 START WITH 1 NO CYCLE/i,
    )
    expect(normalized).toContain(
      'REVOKE ALL ON SEQUENCE public.sample_type_import_code_seq FROM PUBLIC, anon, authenticated, service_role',
    )
    expect(normalized).not.toMatch(
      /GRANT [^;]* ON SEQUENCE public\.sample_type_import_code_seq/i,
    )
    expect(normalized).toMatch(
      /import_code TEXT NOT NULL DEFAULT '__DATABASE_GENERATED__'/i,
    )
    expect(normalized).toMatch(
      /CHECK \(import_code ~ '\^LM-\[0-9\]\{6\}\$'\)/i,
    )
    expect(normalized).toMatch(/UNIQUE \(import_code\)/i)
    expect(normalized).toMatch(
      /CREATE FUNCTION public\.allocate_sample_type_import_code\(\) RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp/i,
    )
    expect(normalized).toMatch(
      /IF NEW\.import_code IS DISTINCT FROM '__DATABASE_GENERATED__' THEN RAISE EXCEPTION 'Sample type import code must be database generated'/i,
    )
    expect(normalized).toMatch(
      /NEW\.import_code := 'LM-' \|\| lpad\(nextval\('public\.sample_type_import_code_seq'::REGCLASS\)::TEXT, 6, '0'\)/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER sample_types_allocate_import_code BEFORE INSERT ON public\.sample_types FOR EACH ROW EXECUTE FUNCTION public\.allocate_sample_type_import_code\(\)/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER sample_types_import_code_immutable BEFORE UPDATE OF import_code ON public\.sample_types FOR EACH ROW EXECUTE FUNCTION public\.prevent_sample_type_import_code_update\(\)/i,
    )
  })

  it('stores normalized lifecycle state and advances compatibility generation', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE FUNCTION public\.normalize_sample_type_name\(p_name TEXT\) RETURNS TEXT LANGUAGE sql IMMUTABLE STRICT/i,
    )
    expect(normalized).toMatch(
      /name TEXT NOT NULL[\s\S]*normalized_name TEXT NOT NULL[\s\S]*compatibility_generation BIGINT NOT NULL DEFAULT 1/i,
    )
    expect(normalized).toMatch(/UNIQUE \(normalized_name\)/i)
    expect(normalized).toMatch(
      /CHECK \(compatibility_generation >= 1\)/i,
    )
    expect(normalized).toMatch(
      /IF NEW\.normalized_name IS DISTINCT FROM OLD\.normalized_name OR \(NEW\.deleted_at IS NULL\) IS DISTINCT FROM \(OLD\.deleted_at IS NULL\) THEN NEW\.compatibility_generation := OLD\.compatibility_generation \+ 1/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER sample_types_maintain_lifecycle BEFORE INSERT OR UPDATE OF name, normalized_name, deleted_at, compatibility_generation ON public\.sample_types FOR EACH ROW EXECUTE FUNCTION public\.maintain_sample_type_lifecycle\(\)/i,
    )
  })

  it('backfills master data and sample references deterministically', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /row_number\(\) OVER \(ORDER BY normalized_name, display_name\)/i,
    )
    expect(normalized).toMatch(
      /'LM-' \|\| lpad\(ordered_type\.sequence_value::TEXT, 6, '0'\)/i,
    )
    expect(normalized).toMatch(
      /ALTER TABLE public\.samples ADD COLUMN sample_type_id UUID/i,
    )
    expect(normalized).toContain(
      'ALTER TABLE public.samples DISABLE TRIGGER update_samples_updated_at',
    )
    expect(normalized).toMatch(
      /UPDATE public\.samples AS sample SET sample_type_id = sample_type\.id, type = sample_type\.name FROM public\.sample_types AS sample_type WHERE sample_type\.normalized_name = public\.normalize_sample_type_name\(sample\.type\)/i,
    )
    expect(normalized).toContain(
      'ALTER TABLE public.samples ENABLE TRIGGER update_samples_updated_at',
    )
    expect(normalized).toMatch(
      /ALTER TABLE public\.samples ALTER COLUMN sample_type_id SET NOT NULL/i,
    )
    expect(normalized).toMatch(
      /ADD CONSTRAINT samples_sample_type_fk FOREIGN KEY \(sample_type_id\) REFERENCES public\.sample_types\(id\) ON DELETE RESTRICT/i,
    )
    expect(normalized).toContain(
      'ALTER TABLE public.samples DROP CONSTRAINT samples_type_check',
    )
    expect(normalized).toMatch(
      /CREATE INDEX idx_samples_sample_type_id ON public\.samples \(sample_type_id\)/i,
    )
  })

  it('keeps samples.type as a canonical compatibility projection', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toMatch(
      /CREATE FUNCTION public\.sync_sample_type_projection\(\) RETURNS TRIGGER/i,
    )
    expect(normalized).toMatch(
      /WHERE sample_type\.id = NEW\.sample_type_id AND sample_type\.deleted_at IS NULL/i,
    )
    expect(normalized).toMatch(
      /WHERE sample_type\.normalized_name = public\.normalize_sample_type_name\(NEW\.type\) AND sample_type\.deleted_at IS NULL/i,
    )
    expect(normalized).toMatch(
      /NEW\.sample_type_id := v_sample_type_id[\s\S]*NEW\.type := v_sample_type_name/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER samples_apply_sample_type_projection BEFORE INSERT OR UPDATE OF sample_type_id, type ON public\.samples FOR EACH ROW EXECUTE FUNCTION public\.sync_sample_type_projection\(\)/i,
    )
    expect(
      'samples_apply_sample_type_projection'.localeCompare(
        'samples_search_update',
      ),
    ).toBeLessThan(0)
    expect(normalized).toMatch(
      /CREATE TRIGGER sample_types_sync_sample_projection AFTER UPDATE OF name ON public\.sample_types FOR EACH ROW WHEN \(NEW\.name IS DISTINCT FROM OLD\.name\) EXECUTE FUNCTION public\.sync_sample_type_name_to_samples\(\)/i,
    )
  })

  it('uses manager-only mutations, active reads, and exact audit bindings', () => {
    const normalized = normalizeSql(readMigration())

    expect(normalized).toContain(
      'ALTER TABLE public.sample_types ENABLE ROW LEVEL SECURITY',
    )
    expect(normalized).toMatch(
      /CREATE POLICY "Authenticated users can read sample types" ON public\.sample_types FOR SELECT TO authenticated USING \(\(SELECT public\.get_user_role\(\)\) IN \('analyst', 'manager'\)[\s\S]*deleted_at IS NULL[\s\S]*\(SELECT public\.get_user_role\(\)\) = 'manager'\)/i,
    )
    expect(normalized).toMatch(
      /CREATE POLICY "Managers can insert sample types" ON public\.sample_types FOR INSERT TO authenticated WITH CHECK \(\(SELECT public\.get_user_role\(\)\) = 'manager'\)/i,
    )
    expect(normalized).toMatch(
      /CREATE POLICY "Managers can update sample types" ON public\.sample_types FOR UPDATE TO authenticated USING \(\(SELECT public\.get_user_role\(\)\) = 'manager'\) WITH CHECK \(\(SELECT public\.get_user_role\(\)\) = 'manager'\)/i,
    )
    expect(normalized).not.toMatch(
      /CREATE POLICY [^;]* FOR DELETE TO authenticated/i,
    )
    expect(normalized).toContain(
      'GRANT SELECT ON TABLE public.sample_types TO authenticated',
    )
    expect(normalized).toContain(
      'GRANT INSERT (name), UPDATE (name, deleted_at) ON TABLE public.sample_types TO authenticated',
    )
    expect(normalized).toContain(
      'GRANT SELECT ON TABLE public.sample_types TO service_role',
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER update_sample_types_updated_at BEFORE UPDATE ON public\.sample_types FOR EACH ROW EXECUTE FUNCTION public\.update_updated_at_column\(\)/i,
    )
    expect(normalized).toMatch(
      /CREATE TRIGGER audit_sample_types_trigger AFTER INSERT OR UPDATE OR DELETE ON public\.sample_types FOR EACH ROW EXECUTE FUNCTION public\.trigger_audit_log\(\)/i,
    )
    expect(normalized).toContain(
      "tgfoid = 'public.trigger_audit_log()'::REGPROCEDURE",
    )
    expect(normalized).toContain(
      "tgfoid = 'public.update_updated_at_column()'::REGPROCEDURE",
    )
  })

  it('verifies postconditions without changing assignment contracts', () => {
    const normalized = normalizeSql(readMigration())
    const createdFunctions = Array.from(
      normalized.matchAll(
        /CREATE(?: OR REPLACE)? FUNCTION public\.([a-z0-9_]+)\(/gi,
      ),
      (match) => match[1],
    )

    expect(createdFunctions).toEqual([
      'normalize_sample_type_name',
      'allocate_sample_type_import_code',
      'prevent_sample_type_import_code_update',
      'maintain_sample_type_lifecycle',
      'sync_sample_type_projection',
      'sync_sample_type_name_to_samples',
    ])
    expect(normalized).toMatch(
      /count\(\*\) FILTER \(WHERE sample_type_id IS NULL\)/i,
    )
    expect(normalized).toMatch(
      /count\(\*\) FILTER \(WHERE sample\.type IS DISTINCT FROM sample_type\.name\)/i,
    )
    expect(normalized).toMatch(
      /IF v_unlinked_sample_count <> 0 OR v_projection_mismatch_count <> 0/i,
    )
    expect(normalized).not.toMatch(
      /CREATE(?: OR REPLACE)? FUNCTION public\.(?:accession_and_assign_tests|assign_tests_to_sample|create_sample_atomic)\(/i,
    )
    expect(normalized).not.toMatch(
      /DROP FUNCTION [^;]*(?:accession_and_assign_tests|assign_tests_to_sample|create_sample_atomic)/i,
    )
    expect(normalized).not.toMatch(/\bALTER TABLE public\.results\b/i)
  })
})
