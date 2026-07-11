-- Migration 173: Register the claim-bound CoA generation security contract
-- Security Impact: Low. Security tests now fail closed if claim ownership,
-- transition RPC grants, immutable identity, or direct-update revocation drift.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_provenance_checker TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.test_coa_report_provenance_guard()'::regprocedure
    )
    INTO v_provenance_checker;

    IF v_provenance_checker NOT ILIKE
       '%prevent_coa_report_source_rebinding%' THEN
        RAISE EXCEPTION
            'Migration 173 expected the pre-claim provenance checker';
    END IF;
END;
$$;

DROP TRIGGER IF EXISTS prevent_coa_report_source_rebinding
ON public.coa_reports;

DROP FUNCTION IF EXISTS public.prevent_coa_report_source_rebinding();

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
    AND v_regeneration_definition ILIKE '%generation_claimed_at%'
    AND v_regeneration_definition ILIKE '%15 minutes%'
    AND v_regeneration_definition ILIKE '%generation_previous_status%'
    AND v_regeneration_definition ILIKE
        '%WHEN v_report.status = ''pending''%THEN v_report.generation_previous_status%'
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

CREATE OR REPLACE FUNCTION public.test_security_definer_rpc_execute_privileges()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_function TEXT;
    v_anon_denied_functions TEXT[] := ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)',
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)',
        'public.get_assay_definition_by_id(uuid)',
        'public.get_active_qc_session(uuid)',
        'public.check_qc_approval_status(uuid[])',
        'public.get_user_email_by_username(text)',
        'public.get_active_signature(uuid)',
        'public.calculate_z_score()',
        'public.log_methodless_assignment()',
        'public.trigger_audit_log()',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'public.claim_coa_report_regeneration(uuid,integer)',
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)',
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    ];
    v_authenticated_functions TEXT[] := ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)',
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)',
        'public.get_assay_definition_by_id(uuid)',
        'public.get_active_qc_session(uuid)',
        'public.check_qc_approval_status(uuid[])',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'public.claim_coa_report_regeneration(uuid,integer)',
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)',
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    ];
    v_service_role_functions TEXT[] := ARRAY[
        'public.get_user_email_by_username(text)',
        'public.get_active_signature(uuid)'
    ];
    v_authenticated_denied_functions TEXT[] := ARRAY[
        'public.get_user_email_by_username(text)',
        'public.get_active_signature(uuid)'
    ];
BEGIN
    FOREACH v_function IN ARRAY v_anon_denied_functions LOOP
        IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_functions LOOP
        IF NOT has_function_privilege(
            'authenticated',
            v_function,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_service_role_functions LOOP
        IF NOT has_function_privilege(
            'service_role',
            v_function,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_denied_functions LOOP
        IF has_function_privilege(
            'authenticated',
            v_function,
            'EXECUTE'
        ) THEN
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Verifies immutable CoA source identity, single-worker generation claims, least-privilege transitions, and retired legacy trigger state.';

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard()
       OR NOT public.test_security_definer_rpc_execute_privileges() THEN
        RAISE EXCEPTION
            'Migration 173 failed the CoA generation claim security contract';
    END IF;
END;
$$;

COMMIT;
