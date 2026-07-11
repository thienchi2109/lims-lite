-- Migration 176: Register confidential CoA claim authorization
-- Security Impact: Low
-- Changes:
--   - Extends the existing CoA security checker for queue and regeneration.
--   - Fails closed if either claim RPC loses its confidential authorization.
--   - Verifies authorization runs before report reads or state transitions.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_checker_definition TEXT;
    v_queue_definition TEXT;
    v_regeneration_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.test_coa_report_provenance_guard()'::regprocedure
    )
    INTO v_checker_definition;

    SELECT pg_get_functiondef(
        'public.queue_coa_report_for_generation(uuid,integer)'::regprocedure
    )
    INTO v_queue_definition;

    SELECT pg_get_functiondef(
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure
    )
    INTO v_regeneration_definition;

    IF v_checker_definition NOT ILIKE
       '%generation_previous_status IS DISTINCT FROM ''''ready''''%' THEN
        RAISE EXCEPTION
            'Migration 176 found an unexpected CoA checker baseline';
    END IF;

    IF v_checker_definition ILIKE
       '%public.user_can_access_confidential()%' THEN
        RAISE EXCEPTION
            'Migration 176 expected the checker to lack confidential authorization';
    END IF;

    IF v_queue_definition NOT ILIKE
       '%public.user_can_access_confidential()%'
       OR v_regeneration_definition NOT ILIKE
       '%public.user_can_access_confidential()%' THEN
        RAISE EXCEPTION
            'Migration 176 requires migrations 174 and 175';
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
    v_queue_oid OID;
    v_regeneration_oid OID;
    v_complete_oid OID;
    v_fail_oid OID;
    v_queue_definition TEXT;
    v_regeneration_definition TEXT;
    v_complete_definition TEXT;
    v_fail_definition TEXT;
BEGIN
    v_queue_oid := to_regprocedure(
        'public.queue_coa_report_for_generation(uuid,integer)'
    )::OID;
    v_regeneration_oid := to_regprocedure(
        'public.claim_coa_report_regeneration(uuid,integer)'
    )::OID;
    v_complete_oid := to_regprocedure(
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'
    )::OID;
    v_fail_oid := to_regprocedure(
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    )::OID;

    IF v_queue_oid IS NULL
       OR v_regeneration_oid IS NULL
       OR v_complete_oid IS NULL
       OR v_fail_oid IS NULL THEN
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(v_queue_oid)
    INTO v_queue_definition;

    SELECT pg_get_functiondef(v_regeneration_oid)
    INTO v_regeneration_definition;

    SELECT pg_get_functiondef(v_complete_oid)
    INTO v_complete_definition;

    SELECT pg_get_functiondef(v_fail_oid)
    INTO v_fail_definition;

    RETURN EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'source_submission_id'
          AND data_type = 'uuid'
          AND is_nullable = 'YES'
    )
    AND (
        SELECT COUNT(*) = 4
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name IN (
              'generation_claim_id',
              'generation_claimed_by',
              'generation_claimed_at',
              'generation_previous_status'
          )
    )
    AND EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_source_submission_sample_fkey'
          AND confdeltype = 'r'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_generation_claim_state_check'
    )
    AND EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.coa_reports'::regclass
          AND tgname = 'prevent_coa_report_identity_change'
          AND NOT tgisinternal
          AND pg_get_triggerdef(oid) ILIKE
              '%UPDATE OF sample_id, version, source_submission_id%'
    )
    AND NOT has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'INSERT,UPDATE,DELETE,TRUNCATE,TRIGGER,REFERENCES'
    )
    AND has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'SELECT'
    )
    AND (
        SELECT BOOL_AND(
            prosecdef
            AND EXISTS (
                SELECT 1
                FROM unnest(proconfig) AS cfg
                WHERE cfg = 'search_path=public, extensions'
            )
        )
        FROM pg_proc
        WHERE oid IN (
            v_queue_oid,
            v_regeneration_oid,
            v_complete_oid,
            v_fail_oid
        )
    )
    AND has_function_privilege(
        'authenticated',
        v_queue_oid,
        'EXECUTE'
    )
    AND has_function_privilege(
        'authenticated',
        v_regeneration_oid,
        'EXECUTE'
    )
    AND has_function_privilege(
        'authenticated',
        v_complete_oid,
        'EXECUTE'
    )
    AND has_function_privilege(
        'authenticated',
        v_fail_oid,
        'EXECUTE'
    )
    AND NOT has_function_privilege('anon', v_queue_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_regeneration_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_complete_oid, 'EXECUTE')
    AND NOT has_function_privilege('anon', v_fail_oid, 'EXECUTE')
    AND NOT has_function_privilege('service_role', v_queue_oid, 'EXECUTE')
    AND NOT has_function_privilege(
        'service_role',
        v_regeneration_oid,
        'EXECUTE'
    )
    AND NOT has_function_privilege('service_role', v_complete_oid, 'EXECUTE')
    AND NOT has_function_privilege('service_role', v_fail_oid, 'EXECUTE')
    AND v_queue_definition ILIKE '%v_user_role IS NULL%'
    AND v_queue_definition ILIKE '%generation_claim_id%'
    AND v_queue_definition ILIKE '%generation_claimed_at%'
    AND v_queue_definition ILIKE '%15 minutes%'
    AND v_queue_definition ILIKE '%generation_previous_status%'
    AND v_queue_definition ILIKE
        '%WHEN v_report.status = ''pending''%THEN v_report.generation_previous_status%'
    AND v_queue_definition ILIKE '%v_snapshot_count <> v_result_count%'
    AND v_queue_definition ILIKE
        '%assay_definition.is_confidential = TRUE%'
    AND v_queue_definition ILIKE
        '%NOT public.user_can_access_confidential()%'
    AND v_queue_definition ILIKE
        '%RAISE EXCEPTION ''Sample not found''%ERRCODE = ''42501''%'
    AND STRPOS(
        LOWER(v_queue_definition),
        'public.user_can_access_confidential()'
    ) < STRPOS(
        LOWER(v_queue_definition),
        'from public.coa_reports'
    )
    AND v_regeneration_definition ILIKE '%generation_claimed_at%'
    AND v_regeneration_definition ILIKE '%15 minutes%'
    AND v_regeneration_definition ILIKE '%generation_previous_status%'
    AND v_regeneration_definition ILIKE
        '%WHEN v_report.status = ''pending''%THEN v_report.generation_previous_status%'
    AND v_regeneration_definition ILIKE
        '%assay_definition.is_confidential = TRUE%'
    AND v_regeneration_definition ILIKE
        '%NOT public.user_can_access_confidential()%'
    AND v_regeneration_definition ILIKE
        '%RAISE EXCEPTION ''Sample not found''%ERRCODE = ''42501''%'
    AND STRPOS(
        LOWER(v_regeneration_definition),
        'public.user_can_access_confidential()'
    ) < STRPOS(
        LOWER(v_regeneration_definition),
        'from public.coa_reports'
    )
    AND v_complete_definition ILIKE '%generation_claimed_by = v_user_id%'
    AND v_complete_definition ILIKE '%generation_claim_id = p_generation_claim_id%'
    AND v_complete_definition ILIKE '%generation_claimed_at >%'
    AND v_complete_definition ILIKE '%15 minutes%'
    AND v_complete_definition ILIKE '%signature.user_id = v_approver_id%'
    AND v_complete_definition ILIKE '%signature.is_active%'
    AND v_complete_definition ILIKE '%signature.deleted_at IS NULL%'
    AND v_complete_definition ILIKE '%result.status = ''approved''%'
    AND v_complete_definition ILIKE '%result.approved_by IS NOT NULL%'
    AND v_complete_definition ILIKE
        '%result.approved_at DESC NULLS LAST, result.id DESC%'
    AND v_fail_definition ILIKE '%generation_claimed_by = v_user_id%'
    AND v_fail_definition ILIKE '%generation_claim_id = p_generation_claim_id%'
    AND v_fail_definition ILIKE '%generation_claimed_at >%'
    AND v_fail_definition ILIKE '%15 minutes%'
    AND v_fail_definition ILIKE '%generation_previous_status%'
    AND v_fail_definition ILIKE '%p_restore_ready IS NULL%'
    AND v_fail_definition ILIKE
        '%generation_previous_status IS DISTINCT FROM ''ready''%'
    AND v_fail_definition ILIKE
        '%NOT p_restore_ready%generation_previous_status = ''ready''%'
    AND NOT EXISTS (
        SELECT 1
        FROM pg_proc
        JOIN pg_namespace
          ON pg_namespace.oid = pg_proc.pronamespace
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

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates CoA provenance, claim ownership, RPC grants, and confidential authorization.';

COMMIT;
