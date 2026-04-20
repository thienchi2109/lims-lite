-- Migration 134: Add CoA storage service-role policies for backfill and maintenance
-- Security Impact: Medium
-- Changes:
--   - Adds explicit storage.objects SELECT/INSERT/UPDATE policies for service_role on coa-reports
--   - Extends run_security_tests() to fail if these service-role storage policies go missing
-- Context:
--   - In this self-hosted Supabase stack, Storage API requests using service_role do not bypass
--     storage.objects RLS for coa-reports automatically.
--   - This blocks controlled maintenance tasks such as CoA backfill and hash repair.

SET search_path TO public, storage, extensions;

DROP POLICY IF EXISTS "coa_storage_service_role_select" ON storage.objects;
CREATE POLICY "coa_storage_service_role_select"
ON storage.objects FOR SELECT
TO public
USING (
    bucket_id = 'coa-reports'
    AND (SELECT auth.jwt()) ->> 'role' = 'service_role'
);

DROP POLICY IF EXISTS "coa_storage_service_role_insert" ON storage.objects;
CREATE POLICY "coa_storage_service_role_insert"
ON storage.objects FOR INSERT
TO public
WITH CHECK (
    bucket_id = 'coa-reports'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (SELECT auth.jwt()) ->> 'role' = 'service_role'
);

DROP POLICY IF EXISTS "coa_storage_service_role_update" ON storage.objects;
CREATE POLICY "coa_storage_service_role_update"
ON storage.objects FOR UPDATE
TO public
USING (
    bucket_id = 'coa-reports'
    AND (SELECT auth.jwt()) ->> 'role' = 'service_role'
)
WITH CHECK (
    bucket_id = 'coa-reports'
    AND (storage.foldername(name))[1] IS NOT NULL
    AND (SELECT auth.jwt()) ->> 'role' = 'service_role'
);

COMMENT ON POLICY "coa_storage_service_role_select" ON storage.objects
IS 'Allows service_role to read CoA HTML files for controlled maintenance tasks such as backfill and repair.';

COMMENT ON POLICY "coa_storage_service_role_insert" ON storage.objects
IS 'Allows service_role to insert CoA HTML files in coa-reports during controlled maintenance operations.';

COMMENT ON POLICY "coa_storage_service_role_update" ON storage.objects
IS 'Allows service_role to update CoA HTML files in coa-reports during controlled maintenance operations.';

CREATE OR REPLACE FUNCTION public.test_coa_storage_service_role_policy_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, storage, extensions
AS $$
DECLARE
    v_select_policy TEXT;
    v_insert_policy TEXT;
    v_update_policy TEXT;
BEGIN
    SELECT qual
    INTO v_select_policy
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'coa_storage_service_role_select'
      AND cmd = 'SELECT';

    SELECT with_check
    INTO v_insert_policy
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'coa_storage_service_role_insert'
      AND cmd = 'INSERT';

    SELECT COALESCE(qual, '') || ' ' || COALESCE(with_check, '')
    INTO v_update_policy
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'coa_storage_service_role_update'
      AND cmd = 'UPDATE';

    IF v_select_policy IS NULL
       OR v_select_policy NOT ILIKE '%coa-reports%'
       OR v_select_policy NOT ILIKE '%service_role%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: coa storage service-role SELECT policy is missing or malformed. Policy: %', COALESCE(v_select_policy, 'NULL');
        RETURN FALSE;
    END IF;

    IF v_insert_policy IS NULL
       OR v_insert_policy NOT ILIKE '%coa-reports%'
       OR v_insert_policy NOT ILIKE '%service_role%'
       OR v_insert_policy NOT ILIKE '%foldername%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: coa storage service-role INSERT policy is missing or malformed. Policy: %', COALESCE(v_insert_policy, 'NULL');
        RETURN FALSE;
    END IF;

    IF v_update_policy IS NULL
       OR v_update_policy NOT ILIKE '%coa-reports%'
       OR v_update_policy NOT ILIKE '%service_role%'
       OR v_update_policy NOT ILIKE '%foldername%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: coa storage service-role UPDATE policy is missing or malformed. Policy: %', COALESCE(v_update_policy, 'NULL');
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
        ('Security Definer RPC Search Path'::TEXT, test_security_definer_rpc_search_path(), 'Verifies hardened sample accession SECURITY DEFINER RPCs pin search_path'::TEXT),
        ('Samples INSERT Analyst Receiver Policy'::TEXT, test_samples_insert_policy_requires_analyst_receiver(), 'Verifies sample INSERT policy is analyst-only and requires received_by = auth.uid()'::TEXT),
        ('Sample Receiver Trigger Guard'::TEXT, test_sample_receiver_guard(), 'Verifies public.samples receiver trigger enforces analyst-only inserts and immutable receivers'::TEXT),
        ('Sample Accession RPC Analyst Role Guard'::TEXT, test_sample_accession_rpcs_require_analyst_role(), 'Verifies sample accession SECURITY DEFINER RPCs reject manager role branches'::TEXT),
        ('Doctor Role Enum Exists'::TEXT, test_doctor_role_enum_exists(), 'Verifies public.user_role includes doctor'::TEXT),
        ('Doctor Samples SELECT Policy Guard'::TEXT, test_doctor_samples_select_policy_guard(), 'Verifies doctor samples visibility is completed-only and confidential-aware'::TEXT),
        ('Doctor CoA SELECT Policy Guard'::TEXT, test_doctor_coa_select_policy_guard(), 'Verifies doctor CoA metadata visibility is ready/completed/confidential-aware'::TEXT),
        ('Doctor CoA Storage Policy Guard'::TEXT, test_doctor_coa_storage_policy_guard(), 'Verifies doctor CoA storage visibility is ready/completed/confidential-aware'::TEXT),
        ('CoA Storage Service Role Policy Guard'::TEXT, test_coa_storage_service_role_policy_guard(), 'Verifies coa-reports storage keeps explicit service_role policies for maintenance access'::TEXT),
        ('Doctor Excluded From Operational Policies'::TEXT, test_doctor_not_in_operational_policies(), 'Verifies doctor is not present in write/operational policy branches'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.test_coa_storage_service_role_policy_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_coa_storage_service_role_policy_guard() TO authenticated;

COMMENT ON FUNCTION public.test_coa_storage_service_role_policy_guard()
IS 'Verifies storage.objects keeps explicit service_role SELECT/INSERT/UPDATE policies for the coa-reports bucket.';

COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including analyst-only sample receiver coverage, doctor read-only RBAC coverage, and CoA storage service-role maintenance access.';

NOTIFY pgrst, 'reload schema';
