-- Migration 170: Update the SECURITY DEFINER RPC privilege contract for CoA queueing
-- Security Impact: Low. The security test now covers the authenticated-only
-- queue RPC introduced by migration 167 and stops resolving the retired legacy
-- CoA trigger function. No grants or policies are changed.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_checker_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.test_security_definer_rpc_execute_privileges()'::regprocedure
    )
    INTO v_checker_definition;

    IF v_checker_definition NOT ILIKE
       '%public.trigger_generate_coa()%' THEN
        RAISE EXCEPTION
            'Migration 170 expected the legacy CoA trigger privilege contract';
    END IF;

    IF to_regprocedure(
        'public.queue_coa_report_for_generation(uuid,integer)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Migration 170 requires queue_coa_report_for_generation(uuid,integer)';
    END IF;
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
        'public.queue_coa_report_for_generation(uuid,integer)'
    ];
    v_authenticated_functions TEXT[] := ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)',
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)',
        'public.get_assay_definition_by_id(uuid)',
        'public.get_active_qc_session(uuid)',
        'public.check_qc_approval_status(uuid[])',
        'public.queue_coa_report_for_generation(uuid,integer)'
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
    FOREACH v_function IN ARRAY v_anon_denied_functions
    LOOP
        IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
            RAISE WARNING
                'SECURITY TEST FAILED: anon can execute %',
                v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_functions
    LOOP
        IF NOT has_function_privilege(
            'authenticated',
            v_function,
            'EXECUTE'
        ) THEN
            RAISE WARNING
                'SECURITY TEST FAILED: authenticated cannot execute %',
                v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_service_role_functions
    LOOP
        IF NOT has_function_privilege(
            'service_role',
            v_function,
            'EXECUTE'
        ) THEN
            RAISE WARNING
                'SECURITY TEST FAILED: service_role cannot execute %',
                v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_denied_functions
    LOOP
        IF has_function_privilege(
            'authenticated',
            v_function,
            'EXECUTE'
        ) THEN
            RAISE WARNING
                'SECURITY TEST FAILED: authenticated can execute service-only function %',
                v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.test_security_definer_rpc_execute_privileges()
IS 'Verifies required SECURITY DEFINER RPC execute grants, including authenticated-only CoA queueing.';

DO $$
BEGIN
    IF NOT public.test_security_definer_rpc_execute_privileges() THEN
        RAISE EXCEPTION
            'Migration 170 failed the SECURITY DEFINER RPC privilege contract';
    END IF;
END;
$$;

COMMIT;
