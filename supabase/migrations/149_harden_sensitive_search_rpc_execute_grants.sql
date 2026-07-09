-- Migration 149: Harden sensitive search RPC execute grants
-- Security Impact: Medium
-- Changes:
--   - Revokes anonymous/PUBLIC EXECUTE from sample page and search RPCs that return sample/result/client/assay metadata
--   - Keeps authenticated EXECUTE for normal dashboard workflows
--   - Extends run_security_tests() so grant drift is detected after future migrations
-- Compliance:
--   - Reduces unauthenticated attack surface around confidential sample/result discovery paths
--   - Keeps RLS and RPC predicates as the final authorization gate for authenticated users

SET search_path TO public, extensions;

REVOKE ALL ON FUNCTION public.get_samples_page(
    text,
    text,
    public.sample_status,
    boolean,
    timestamp with time zone,
    timestamp with time zone,
    uuid,
    uuid[],
    text,
    text,
    integer,
    integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.global_search(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_assays(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_clients(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_results(text, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_samples(text, integer) FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_samples_page(
    text,
    text,
    public.sample_status,
    boolean,
    timestamp with time zone,
    timestamp with time zone,
    uuid,
    uuid[],
    text,
    text,
    integer,
    integer
) FROM anon;
REVOKE ALL ON FUNCTION public.global_search(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.search_assays(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.search_clients(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.search_results(text, integer) FROM anon;
REVOKE ALL ON FUNCTION public.search_samples(text, integer) FROM anon;

GRANT EXECUTE ON FUNCTION public.get_samples_page(
    text,
    text,
    public.sample_status,
    boolean,
    timestamp with time zone,
    timestamp with time zone,
    uuid,
    uuid[],
    text,
    text,
    integer,
    integer
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.global_search(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_assays(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_clients(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_results(text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_samples(text, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.test_sensitive_search_rpc_execute_privileges()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_anon_executable TEXT;
    v_authenticated_missing TEXT;
BEGIN
    WITH protected_functions(function_name, signature) AS (
        VALUES
            ('get_samples_page', 'public.get_samples_page(text, text, sample_status, boolean, timestamp with time zone, timestamp with time zone, uuid, uuid[], text, text, integer, integer)'),
            ('global_search', 'public.global_search(text, integer)'),
            ('search_assays', 'public.search_assays(text, integer)'),
            ('search_clients', 'public.search_clients(text, integer)'),
            ('search_results', 'public.search_results(text, integer)'),
            ('search_samples', 'public.search_samples(text, integer)')
    )
    SELECT string_agg(function_name, ', ' ORDER BY function_name)
    INTO v_anon_executable
    FROM protected_functions
    WHERE has_function_privilege('anon', signature, 'EXECUTE');

    IF v_anon_executable IS NOT NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: anon can execute sensitive search/page RPCs: %', v_anon_executable;
        RETURN FALSE;
    END IF;

    WITH protected_functions(function_name, signature) AS (
        VALUES
            ('get_samples_page', 'public.get_samples_page(text, text, sample_status, boolean, timestamp with time zone, timestamp with time zone, uuid, uuid[], text, text, integer, integer)'),
            ('global_search', 'public.global_search(text, integer)'),
            ('search_assays', 'public.search_assays(text, integer)'),
            ('search_clients', 'public.search_clients(text, integer)'),
            ('search_results', 'public.search_results(text, integer)'),
            ('search_samples', 'public.search_samples(text, integer)')
    )
    SELECT string_agg(function_name, ', ' ORDER BY function_name)
    INTO v_authenticated_missing
    FROM protected_functions
    WHERE NOT has_function_privilege('authenticated', signature, 'EXECUTE');

    IF v_authenticated_missing IS NOT NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: authenticated cannot execute required search/page RPCs: %', v_authenticated_missing;
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
        ('Doctor Excluded From Operational Policies'::TEXT, test_doctor_not_in_operational_policies(), 'Verifies doctor is not present in write/operational policy branches'::TEXT),
        ('Manager User Write Boundary Guard'::TEXT, test_manager_user_write_boundary_guard(), 'Verifies public.users manager write guard covers manager rows, confidential flag changes, and trusted service_role administration'::TEXT),
        ('Sensitive Search RPC Execute Privileges'::TEXT, test_sensitive_search_rpc_execute_privileges(), 'Verifies anon cannot execute sensitive sample/result search RPCs and authenticated users retain access'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.test_sensitive_search_rpc_execute_privileges() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_tests() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.test_sensitive_search_rpc_execute_privileges() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_tests() TO authenticated;

COMMENT ON FUNCTION public.test_sensitive_search_rpc_execute_privileges()
IS 'Verifies anon cannot execute sensitive sample/result search RPCs and authenticated users retain the required dashboard access.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including confidential access guards, doctor visibility guards, user write boundaries, and sensitive search RPC execute grants.';

NOTIFY pgrst, 'reload schema';
