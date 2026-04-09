-- Migration 132: Add doctor completed-sample read-only RBAC
-- Security Impact: High
-- Changes:
--   - Adds the forward-only public.user_role value "doctor"
--   - Restricts doctor sample reads to completed, non-deleted samples only
--   - Allows doctor CoA reads only for ready CoAs on authorized completed samples
--   - Keeps doctor out of write/operational RLS policy branches
--   - Extends run_security_tests() with doctor role/policy coverage

SET search_path TO public, storage, extensions;

ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'doctor';

DROP POLICY IF EXISTS "Authenticated users can read samples" ON public.samples;
CREATE POLICY "Authenticated users can read samples"
ON public.samples FOR SELECT
TO authenticated
USING (
    (SELECT auth.uid()) IS NOT NULL
    AND deleted_at IS NULL
    AND (
        public.get_user_role() IN ('analyst', 'manager')
        OR (
            public.get_user_role()::TEXT = 'doctor'
            AND status = 'completed'
            AND (
                (SELECT public.user_can_access_confidential())
                OR NOT public.sample_has_confidential_results(id)
            )
        )
    )
);

COMMENT ON POLICY "Authenticated users can read samples" ON public.samples
IS 'Analysts and managers can read non-deleted samples; doctors can read only completed samples that pass confidential access checks.';

DROP POLICY IF EXISTS "coa_reports_select_authenticated" ON public.coa_reports;
CREATE POLICY "coa_reports_select_authenticated"
ON public.coa_reports FOR SELECT
TO authenticated
USING (
    public.get_user_role() IN ('analyst', 'manager')
    OR (
        public.get_user_role()::TEXT = 'doctor'
        AND status = 'ready'
        AND deleted_at IS NULL
        AND EXISTS (
            SELECT 1
            FROM public.samples AS doctor_sample
            WHERE doctor_sample.id = coa_reports.sample_id
              AND doctor_sample.deleted_at IS NULL
              AND doctor_sample.status = 'completed'
              AND (
                  (SELECT public.user_can_access_confidential())
                  OR NOT public.sample_has_confidential_results(doctor_sample.id)
              )
        )
    )
);

COMMENT ON POLICY "coa_reports_select_authenticated" ON public.coa_reports
IS 'Analysts and managers can view CoA records; doctors can view only ready CoA records for authorized completed samples.';

DROP POLICY IF EXISTS "coa_storage_select_authenticated" ON storage.objects;
CREATE POLICY "coa_storage_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'coa-reports'
    AND (
        public.get_user_role() IN ('analyst', 'manager')
        OR (
            public.get_user_role()::TEXT = 'doctor'
            AND EXISTS (
                SELECT 1
                FROM public.coa_reports AS doctor_coa
                INNER JOIN public.samples AS doctor_sample
                    ON doctor_sample.id = doctor_coa.sample_id
                WHERE doctor_coa.file_path = storage.objects.name
                  AND doctor_coa.status = 'ready'
                  AND doctor_coa.deleted_at IS NULL
                  AND doctor_sample.status = 'completed'
                  AND doctor_sample.deleted_at IS NULL
                  AND (
                      (SELECT public.user_can_access_confidential())
                      OR NOT public.sample_has_confidential_results(doctor_sample.id)
                  )
            )
        )
    )
);

COMMENT ON POLICY "coa_storage_select_authenticated" ON storage.objects
IS 'Analysts and managers can read CoA files; doctors can read ready CoA files only for authorized completed samples.';

CREATE OR REPLACE FUNCTION public.test_doctor_role_enum_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_enum AS e
        WHERE e.enumtypid = 'public.user_role'::regtype
          AND e.enumlabel = 'doctor'
    )
    INTO v_exists;

    IF NOT v_exists THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_role is missing doctor enum value';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_doctor_samples_select_policy_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_policy TEXT;
BEGIN
    SELECT qual
    INTO v_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'samples'
      AND policyname = 'Authenticated users can read samples'
      AND cmd = 'SELECT';

    IF v_policy IS NULL
       OR v_policy NOT ILIKE '%doctor%'
       OR v_policy NOT ILIKE '%completed%'
       OR v_policy NOT ILIKE '%sample_has_confidential_results%'
       OR v_policy NOT ILIKE '%user_can_access_confidential%'
       OR v_policy NOT ILIKE '%analyst%'
       OR v_policy NOT ILIKE '%manager%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: samples SELECT policy lacks doctor completed/confidential guard. Policy: %', COALESCE(v_policy, 'NULL');
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_doctor_coa_select_policy_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_policy TEXT;
BEGIN
    SELECT qual
    INTO v_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'coa_reports'
      AND policyname = 'coa_reports_select_authenticated'
      AND cmd = 'SELECT';

    IF v_policy IS NULL
       OR v_policy NOT ILIKE '%doctor%'
       OR v_policy NOT ILIKE '%ready%'
       OR v_policy NOT ILIKE '%completed%'
       OR v_policy NOT ILIKE '%sample_has_confidential_results%'
       OR v_policy NOT ILIKE '%user_can_access_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: coa_reports SELECT policy lacks doctor ready/completed/confidential guard. Policy: %', COALESCE(v_policy, 'NULL');
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_doctor_coa_storage_policy_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, storage, extensions
AS $$
DECLARE
    v_policy TEXT;
BEGIN
    SELECT qual
    INTO v_policy
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'coa_storage_select_authenticated'
      AND cmd = 'SELECT';

    IF v_policy IS NULL
       OR v_policy NOT ILIKE '%doctor%'
       OR v_policy NOT ILIKE '%coa-reports%'
       OR v_policy NOT ILIKE '%ready%'
       OR v_policy NOT ILIKE '%completed%'
       OR v_policy NOT ILIKE '%sample_has_confidential_results%'
       OR v_policy NOT ILIKE '%user_can_access_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: coa storage SELECT policy lacks doctor ready/completed/confidential guard. Policy: %', COALESCE(v_policy, 'NULL');
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_doctor_not_in_operational_policies()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, storage, extensions
AS $$
DECLARE
    v_policy_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_policy_count
    FROM pg_policies
    WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
      AND (
          (schemaname = 'public' AND tablename IN (
              'samples',
              'results',
              'coa_reports',
              'sample_submissions',
              'qc_sessions',
              'qc_results',
              'users',
              'clients',
              'assay_definitions',
              'methods',
              'assay_methods',
              'user_signatures'
          ))
          OR (schemaname = 'storage' AND tablename = 'objects')
      )
      AND (
          COALESCE(qual, '') ILIKE '%doctor%'
          OR COALESCE(with_check, '') ILIKE '%doctor%'
      );

    IF v_policy_count <> 0 THEN
        RAISE WARNING 'SECURITY TEST FAILED: doctor appears in % operational/write policy branch(es)', v_policy_count;
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
        ('Doctor Role Enum Exists'::TEXT, test_doctor_role_enum_exists(), 'Verifies public.user_role includes doctor'::TEXT),
        ('Doctor Samples SELECT Policy Guard'::TEXT, test_doctor_samples_select_policy_guard(), 'Verifies doctor samples visibility is completed-only and confidential-aware'::TEXT),
        ('Doctor CoA SELECT Policy Guard'::TEXT, test_doctor_coa_select_policy_guard(), 'Verifies doctor CoA metadata visibility is ready/completed/confidential-aware'::TEXT),
        ('Doctor CoA Storage Policy Guard'::TEXT, test_doctor_coa_storage_policy_guard(), 'Verifies doctor CoA storage visibility is ready/completed/confidential-aware'::TEXT),
        ('Doctor Excluded From Operational Policies'::TEXT, test_doctor_not_in_operational_policies(), 'Verifies doctor is not present in write/operational policy branches'::TEXT);

    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.test_doctor_role_enum_exists() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_doctor_samples_select_policy_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_doctor_coa_select_policy_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_doctor_coa_storage_policy_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_doctor_not_in_operational_policies() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_tests() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.test_doctor_role_enum_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_doctor_samples_select_policy_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_doctor_coa_select_policy_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_doctor_coa_storage_policy_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_doctor_not_in_operational_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_tests() TO authenticated;

COMMENT ON FUNCTION public.test_doctor_role_enum_exists()
IS 'Verifies public.user_role includes the doctor enum value.';
COMMENT ON FUNCTION public.test_doctor_samples_select_policy_guard()
IS 'Verifies doctor samples visibility is completed-only and confidential-aware.';
COMMENT ON FUNCTION public.test_doctor_coa_select_policy_guard()
IS 'Verifies doctor CoA metadata visibility is ready, completed-sample-only, and confidential-aware.';
COMMENT ON FUNCTION public.test_doctor_coa_storage_policy_guard()
IS 'Verifies doctor CoA storage visibility is ready, completed-sample-only, and confidential-aware.';
COMMENT ON FUNCTION public.test_doctor_not_in_operational_policies()
IS 'Verifies doctor is not present in write or operational RLS policy branches.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including doctor read-only RBAC coverage.';

NOTIFY pgrst, 'reload schema';
