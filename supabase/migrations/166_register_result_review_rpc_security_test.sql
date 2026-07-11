-- Migration 166: Register the result-review submission RPC security contract.
-- Security Impact: Verification-only.
-- Ensures the legacy bypass RPC stays absent and the assessment-aware RPC
-- retains least-privilege execution in the mandatory security suite.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.test_result_review_submission_rpc_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    IF to_regprocedure('public.submit_sample_for_review(uuid)') IS NOT NULL THEN
        RAISE WARNING
            'SECURITY TEST FAILED: legacy result-review submission RPC still exists';
        RETURN FALSE;
    END IF;

    IF to_regprocedure(
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)'
    ) IS NULL THEN
        RAISE WARNING
            'SECURITY TEST FAILED: assessment-aware result-review submission RPC is missing';
        RETURN FALSE;
    END IF;

    IF has_function_privilege(
        'anon',
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)',
        'EXECUTE'
    ) THEN
        RAISE WARNING
            'SECURITY TEST FAILED: anon can execute the assessment-aware result-review submission RPC';
        RETURN FALSE;
    END IF;

    IF NOT has_function_privilege(
        'authenticated',
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)',
        'EXECUTE'
    ) THEN
        RAISE WARNING
            'SECURITY TEST FAILED: authenticated cannot execute the assessment-aware result-review submission RPC';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

DO $$
BEGIN
    IF NOT public.test_result_review_submission_rpc_guard() THEN
        RAISE EXCEPTION
            'Result-review submission RPC security contract verification failed';
    END IF;
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
        ('Samples Page Confidential-only RPC Guard'::TEXT, test_samples_page_confidential_only_rpc_guard(), 'Verifies get_samples_page keeps confidential-only filtering fail-closed before counts and pagination'::TEXT),
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
        ('Manager User Write Boundary Guard'::TEXT, test_manager_user_write_boundary_guard(), 'Verifies public.users manager write guard covers manager rows, analyst-only confidential flag changes, and trusted service_role administration'::TEXT),
        ('Analyst OTP Management Prerequisites'::TEXT, test_analyst_otp_management_prerequisites(), 'Verifies analyst OTP settings policies, hashed audit logs, and missing-destination preflight RPC'::TEXT),
        ('OTP Challenge Lifecycle Audit'::TEXT, test_otp_challenge_lifecycle_audit(), 'Verifies OTP challenge lifecycle audit excludes OTP verifier material and hashes session identifiers'::TEXT),
        ('Sensitive Search RPC Execute Privileges'::TEXT, test_sensitive_search_rpc_execute_privileges(), 'Verifies anon cannot execute sensitive sample/result search RPCs and authenticated users retain access'::TEXT),
        ('Assessment Snapshot SELECT Policy Guard'::TEXT, test_assessment_snapshot_select_policy_guard(), 'Verifies assessment snapshots retain analyst ownership and manager read scope'::TEXT),
        ('Result Review Submission RPC Guard'::TEXT, test_result_review_submission_rpc_guard(), 'Verifies the legacy bypass RPC stays absent and the assessment-aware RPC retains least-privilege execution'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.test_result_review_submission_rpc_guard()
FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_tests()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.test_result_review_submission_rpc_guard()
TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_tests()
TO authenticated;

COMMENT ON FUNCTION public.test_result_review_submission_rpc_guard()
IS 'Verifies the legacy result-review submission RPC remains absent and the assessment-aware replacement keeps least-privilege execution.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including the result-review submission RPC contract.';

NOTIFY pgrst, 'reload schema';
