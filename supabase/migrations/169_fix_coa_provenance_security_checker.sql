-- Migration 169: Fix CoA provenance security checker after legacy RPC removal
-- Security Impact: LOW
-- Changes:
--   - Replaces the missing-function to_regprocedure() check with pg_proc lookup.
--   - Leaves migration 167 schema, privileges, triggers, and queue RPC unchanged.

BEGIN;

SET search_path TO public, extensions;

DO $$
DECLARE
    v_checker_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.test_coa_report_provenance_guard()'::regprocedure
    )
    INTO v_checker_definition;

    IF v_checker_definition NOT ILIKE
       '%to_regprocedure(''public.trigger_generate_coa()'') IS NULL%' THEN
        RAISE EXCEPTION
            'Migration 169 expected the migration 168 legacy-function checker baseline';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_coa_report_provenance_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_queue_function_oid OID;
    v_queue_definition TEXT;
BEGIN
    SELECT to_regprocedure(
        'public.queue_coa_report_for_generation(uuid,integer)'
    )::OID
    INTO v_queue_function_oid;

    SELECT pg_get_functiondef(v_queue_function_oid)
    INTO v_queue_definition;

    RETURN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'source_submission_id'
          AND data_type = 'uuid'
          AND is_nullable = 'YES'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_source_submission_sample_fkey'
          AND confdeltype = 'r'
          AND pg_get_constraintdef(oid) ILIKE
              '%FOREIGN KEY (source_submission_id, sample_id)%sample_submissions(id, sample_id)%ON DELETE RESTRICT%'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = 'coa_reports'
          AND indexname = 'idx_coa_reports_source_submission_id'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.coa_reports'::regclass
          AND tgname = 'prevent_coa_report_source_rebinding'
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE
              '%BEFORE INSERT OR UPDATE OF source_submission_id%'
          AND pg_get_triggerdef(oid) ILIKE
              '%prevent_coa_report_source_rebinding%'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid = v_queue_function_oid
          AND prosecdef
          AND EXISTS (
              SELECT 1
              FROM unnest(proconfig) AS cfg
              WHERE cfg = 'search_path=public, extensions'
          )
    )
    AND has_function_privilege(
        'authenticated',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'EXECUTE'
    )
    AND NOT has_function_privilege(
        'anon',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'EXECUTE'
    )
    AND NOT has_function_privilege(
        'service_role',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'EXECUTE'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_proc
        CROSS JOIN LATERAL aclexplode(proacl) AS privilege
        WHERE oid = v_queue_function_oid
          AND privilege.grantee = 0
          AND privilege.privilege_type = 'EXECUTE'
    )
    AND v_queue_definition ILIKE '%v_user_role NOT IN%'
    AND v_queue_definition ILIKE '%FOR UPDATE%'
    AND v_queue_definition ILIKE '%superseded_by IS NULL%'
    AND v_queue_definition ILIKE '%FOR SHARE%'
    AND v_queue_definition ILIKE '%v_snapshot_count <> v_result_count%'
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'INSERT'
    )
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'DELETE'
    )
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'TRUNCATE'
    )
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'TRIGGER'
    )
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'REFERENCES'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
          AND polcmd = 'a'
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_proc
        JOIN pg_namespace ON pg_namespace.oid = pg_proc.pronamespace
        WHERE pg_namespace.nspname = 'public'
          AND pg_proc.proname = 'trigger_generate_coa'
          AND pg_proc.pronargs = 0
    )
    AND NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'trigger_generate_coa_on_approval'
          AND NOT tgisinternal
    )
    AND EXISTS (
        SELECT 1
        FROM pg_class
        WHERE oid = 'public.coa_reports'::regclass
          AND relrowsecurity
    );
END;
$$;

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard() THEN
        RAISE EXCEPTION 'Migration 169 CoA provenance security verification failed';
    END IF;
END;
$$;

COMMIT;
