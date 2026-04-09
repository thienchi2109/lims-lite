-- Migration 131: Harden SECURITY DEFINER RPC privileges
-- Security Impact: High
-- Changes:
--   - Prevent anonymous execution of SECURITY DEFINER RPCs that bypass RLS
--   - Add explicit role checks to sample accession RPCs
--   - Fix missing search_path on current sample accession RPC signatures
--   - Extend run_security_tests() to cover RPC EXECUTE privileges and search_path

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.create_sample_atomic(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_received_by UUID,
    p_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role := public.get_user_role();
    v_sample_id TEXT;
    v_sample JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;

    v_sample_id := public.generate_next_sample_id();

    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        type,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_type,
        COALESCE(p_received_at, NOW()),
        v_user_id,
        'received'
    )
    RETURNING jsonb_build_object(
        'id', id,
        'sample_id', sample_id,
        'client_id', client_id,
        'client_name', client_name,
        'type', type,
        'status', status,
        'received_at', received_at,
        'created_at', created_at
    ) INTO v_sample;

    RETURN v_sample;
END;
$$;

CREATE OR REPLACE FUNCTION public.accession_and_assign_tests(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_tests JSONB,
    p_type TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role := public.get_user_role();
    v_sample_id TEXT;
    v_sample_uuid UUID;
    v_result JSONB;
    v_test JSONB;
    v_results JSONB := '[]'::JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501';
    END IF;

    IF v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions' USING ERRCODE = '42501';
    END IF;

    v_sample_id := public.generate_next_sample_id();

    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        type,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_type,
        COALESCE(p_received_at, NOW()),
        v_user_id,
        'assigned'
    )
    RETURNING id INTO v_sample_uuid;

    FOR v_test IN SELECT * FROM jsonb_array_elements(p_tests)
    LOOP
        INSERT INTO public.results (
            sample_id,
            assay_id,
            method_id,
            status
        ) VALUES (
            v_sample_uuid,
            (v_test->>'assayId')::UUID,
            NULLIF(v_test->>'methodId', '')::UUID,
            'pending'
        )
        RETURNING jsonb_build_object(
            'id', id,
            'sample_id', sample_id,
            'assay_id', assay_id,
            'method_id', method_id,
            'status', status
        ) INTO v_result;

        v_results := v_results || jsonb_build_array(v_result);
    END LOOP;

    RETURN jsonb_build_object(
        'sample', jsonb_build_object(
            'id', v_sample_uuid,
            'sample_id', v_sample_id,
            'client_id', p_client_id,
            'client_name', p_client_name,
            'type', p_type,
            'status', 'assigned'
        ),
        'results', v_results
    );
END;
$$;

ALTER FUNCTION public.log_methodless_assignment() SET search_path = public;

REVOKE ALL ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_assay_definitions(TEXT, UUID, UUID, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_assay_definition_by_id(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_active_qc_session(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.check_qc_approval_status(UUID[]) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_user_email_by_username(TEXT) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.get_active_signature(UUID) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.calculate_z_score() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.log_methodless_assignment() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trigger_audit_log() FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.trigger_generate_coa() FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assay_definitions(TEXT, UUID, UUID, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_assay_definition_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_active_qc_session(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_qc_approval_status(UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_email_by_username(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_signature(UUID) TO service_role;

COMMENT ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT)
IS 'Creates a sample with atomic sample_id generation. SECURITY DEFINER with explicit auth/role checks; caller-supplied received_by is ignored.';
COMMENT ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT)
IS 'Creates a sample and assigns tests in one transaction. SECURITY DEFINER with explicit auth/role checks.';
COMMENT ON FUNCTION public.get_user_email_by_username(TEXT)
IS 'Service-role-only helper for resolving login email from public.users under RLS (server-side username login).';

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
        'public.trigger_generate_coa()'
    ];
    v_authenticated_functions TEXT[] := ARRAY[
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)',
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)',
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)',
        'public.get_assay_definition_by_id(uuid)',
        'public.get_active_qc_session(uuid)',
        'public.check_qc_approval_status(uuid[])'
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
            RAISE WARNING 'SECURITY TEST FAILED: anon can execute %', v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_functions
    LOOP
        IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
            RAISE WARNING 'SECURITY TEST FAILED: authenticated cannot execute %', v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_service_role_functions
    LOOP
        IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
            RAISE WARNING 'SECURITY TEST FAILED: service_role cannot execute %', v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    FOREACH v_function IN ARRAY v_authenticated_denied_functions
    LOOP
        IF has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
            RAISE WARNING 'SECURITY TEST FAILED: authenticated can execute service-only function %', v_function;
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_security_definer_rpc_search_path()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_missing_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_missing_count
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.oid::regprocedure::TEXT IN (
          'create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)',
          'accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS cfg
          WHERE cfg = 'search_path=public, extensions'
      );

    IF v_missing_count <> 0 THEN
        RAISE WARNING 'SECURITY TEST FAILED: % sample accession SECURITY DEFINER RPC(s) lack fixed search_path', v_missing_count;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_security_tests()
RETURNS TABLE(
    test_name TEXT,
    passed BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    RAISE NOTICE '=== Running Security Verification Tests ===';
    RAISE NOTICE '';

    RETURN QUERY VALUES
        ('Results INSERT Policy Count'::TEXT, test_results_insert_policy_count(), 'Verifies only one INSERT policy exists on results table'::TEXT),
        ('Results INSERT Role Check'::TEXT, test_results_insert_has_role_check(), 'Verifies INSERT policy includes get_user_role() check'::TEXT),
        ('No Orphaned Vulnerable Policies'::TEXT, test_no_orphaned_vulnerable_policies(), 'Verifies old vulnerable policies have been removed'::TEXT),
        ('All RLS Tables Have Policies'::TEXT, test_all_rls_tables_have_policies(), 'Verifies all tables with RLS have at least one policy'::TEXT),
        ('Critical Policies Have Access Control'::TEXT, test_critical_policies_have_role_checks(), 'Verifies critical policies have role or ownership checks'::TEXT),
        ('Confidential Schema Columns Exist'::TEXT, test_confidential_schema_columns_exist(), 'Verifies confidential schema columns exist as non-null booleans with safe defaults'::TEXT),
        ('Confidential Access Helper Security'::TEXT, test_confidential_access_helper_security(), 'Verifies user_can_access_confidential() stays boolean, STABLE, SECURITY DEFINER, and executable by authenticated users'::TEXT),
        ('Results Confidential Policy Guards'::TEXT, test_results_confidential_policy_guards(), 'Verifies results SELECT/INSERT/UPDATE policies keep the confidential assay guard tied to user_can_access_confidential()'::TEXT),
        ('Security Definer RPC Execute Privileges'::TEXT, test_security_definer_rpc_execute_privileges(), 'Verifies anonymous users cannot execute hardened SECURITY DEFINER RPCs and required roles retain access'::TEXT),
        ('Security Definer RPC Search Path'::TEXT, test_security_definer_rpc_search_path(), 'Verifies hardened sample accession SECURITY DEFINER RPCs pin search_path'::TEXT);

    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.test_security_definer_rpc_execute_privileges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_security_definer_rpc_search_path() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_tests() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.test_security_definer_rpc_execute_privileges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_security_definer_rpc_search_path() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_tests() TO authenticated;

COMMENT ON FUNCTION public.test_security_definer_rpc_execute_privileges()
IS 'Verifies hardened SECURITY DEFINER RPCs use least-privilege EXECUTE grants.';
COMMENT ON FUNCTION public.test_security_definer_rpc_search_path()
IS 'Verifies hardened sample accession SECURITY DEFINER RPCs pin search_path.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including confidential controls and hardened SECURITY DEFINER RPC privilege checks.';

NOTIFY pgrst, 'reload schema';
