-- Migration 136: Fix anon RLS evaluation for confidential helper
-- Security Impact: Medium
-- Changes:
--   - Grants anon EXECUTE on public.user_can_access_confidential()
--   - Extends confidential helper security tests to require anon-safe execution
-- Context:
--   - Anonymous requests should fail closed with zero visible rows, not raise permission errors
--   - results/audit_logs RLS predicates may evaluate the helper before auth-only guards short-circuit

SET search_path TO public, storage, extensions;

REVOKE ALL ON FUNCTION public.user_can_access_confidential() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.user_can_access_confidential() TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_confidential() TO anon;

CREATE OR REPLACE FUNCTION public.test_confidential_access_helper_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_helper_exists BOOLEAN;
    v_security_definer BOOLEAN;
    v_volatility "char";
    v_returns_boolean BOOLEAN;
    v_has_authenticated_execute BOOLEAN;
    v_has_anon_execute BOOLEAN;
BEGIN
    SELECT
        TRUE,
        p.prosecdef,
        p.provolatile,
        pg_catalog.pg_get_function_result(p.oid) = 'boolean',
        has_function_privilege('authenticated', 'public.user_can_access_confidential()', 'EXECUTE'),
        has_function_privilege('anon', 'public.user_can_access_confidential()', 'EXECUTE')
    INTO
        v_helper_exists,
        v_security_definer,
        v_volatility,
        v_returns_boolean,
        v_has_authenticated_execute,
        v_has_anon_execute
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'user_can_access_confidential';

    IF NOT COALESCE(v_helper_exists, FALSE) THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() is missing';
        RETURN FALSE;
    END IF;

    IF NOT v_security_definer THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() must be SECURITY DEFINER';
        RETURN FALSE;
    END IF;

    IF v_volatility <> 's' THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() should remain STABLE, got volatility=%', v_volatility;
        RETURN FALSE;
    END IF;

    IF NOT v_returns_boolean THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() must return boolean';
        RETURN FALSE;
    END IF;

    IF NOT v_has_authenticated_execute THEN
        RAISE WARNING 'SECURITY TEST FAILED: authenticated role lost EXECUTE on public.user_can_access_confidential()';
        RETURN FALSE;
    END IF;

    IF NOT v_has_anon_execute THEN
        RAISE WARNING 'SECURITY TEST FAILED: anon role lost EXECUTE on public.user_can_access_confidential(), causing fail-open RLS errors';
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
        ('Confidential Access Helper Security'::TEXT, test_confidential_access_helper_security(), 'Verifies user_can_access_confidential() stays boolean, STABLE, SECURITY DEFINER, and executable by authenticated and anon roles'::TEXT),
        ('Results Confidential Policy Guards'::TEXT, test_results_confidential_policy_guards(), 'Verifies results SELECT/INSERT/UPDATE policies keep the confidential assay guard tied to user_can_access_confidential()'::TEXT),
        ('Security Definer RPC Execute Privileges'::TEXT, test_security_definer_rpc_execute_privileges(), 'Verifies anonymous users cannot execute hardened SECURITY DEFINER RPCs and required roles retain access'::TEXT),
        ('Security Definer RPC Search Path'::TEXT, test_security_definer_rpc_search_path(), 'Verifies hardened sample accession SECURITY DEFINER RPCs pin search_path'::TEXT),
        ('Samples INSERT Analyst Receiver Policy'::TEXT, test_samples_insert_policy_requires_analyst_receiver(), 'Verifies sample INSERT policy is analyst-only and requires received_by = auth.uid()'::TEXT),
        ('Sample Receiver Trigger Guard'::TEXT, test_sample_receiver_guard(), 'Verifies public.samples receiver trigger enforces analyst-only inserts and immutable receivers'::TEXT),
        ('Sample Accession RPC Analyst Role Guard'::TEXT, test_sample_accession_rpcs_require_analyst_role(), 'Verifies sample accession SECURITY DEFINER RPCs reject manager role branches'::TEXT),
        ('Doctor Role Enum Exists'::TEXT, test_doctor_role_enum_exists(), 'Verifies public.user_role includes doctor'::TEXT),
        ('Doctor Samples SELECT Policy Guard'::TEXT, test_doctor_samples_select_policy_guard(), 'Verifies doctor samples visibility is completed-only and confidential-aware'::TEXT),
        ('Doctor CoA SELECT Policy Guard'::TEXT, test_doctor_coa_select_policy_guard(), 'Verifies doctor CoA metadata visibility is ready/completed/confidential-aware'::TEXT),
        ('Doctor CoA Storage Policy Guard'::TEXT, test_doctor_coa_storage_policy_guard(), 'Verifies doctor CoA storage visibility is ready/completed/confidential-aware'::TEXT),
        ('CoA Storage Service Role Policy Guard'::TEXT, test_coa_storage_service_role_policy_guard(), 'Verifies coa-reports storage keeps explicit service_role policies for maintenance access'::TEXT),
        ('CoA Reports Service Role UPDATE Grant'::TEXT, test_coa_reports_service_role_update_grant(), 'Verifies service_role keeps UPDATE on public.coa_reports for maintenance hash sync'::TEXT),
        ('Doctor Excluded From Operational Policies'::TEXT, test_doctor_not_in_operational_policies(), 'Verifies doctor is not present in write/operational policy branches'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

COMMENT ON FUNCTION public.test_confidential_access_helper_security()
IS 'Verifies user_can_access_confidential() remains a STABLE SECURITY DEFINER boolean helper executable by authenticated and anon roles so RLS fails closed.';

COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including anon-safe confidential helper execution and CoA report maintenance grants.';

NOTIFY pgrst, 'reload schema';
