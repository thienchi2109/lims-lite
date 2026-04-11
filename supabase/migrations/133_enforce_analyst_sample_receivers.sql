-- Migration 133: Enforce analyst-only sample receivers
-- Security Impact: High
-- Changes:
--   - Restricts future sample accession/creation to analysts at the RLS layer
--   - Enforces received_by to reference an analyst on INSERT and remain immutable on UPDATE
--   - Narrows sample accession SECURITY DEFINER RPC role checks to analysts only
--   - Extends run_security_tests() with sample receiver policy/trigger/RPC coverage
--   - Does not backfill existing historical samples with manager receivers
SET search_path TO public, extensions;
DROP POLICY IF EXISTS "Analysts and managers can insert samples" ON public.samples;
DROP POLICY IF EXISTS "Analysts can insert own samples" ON public.samples;
CREATE POLICY "Analysts can insert own samples"
ON public.samples FOR INSERT
TO authenticated
WITH CHECK (
    public.get_user_role() = 'analyst'
    AND received_by = (SELECT auth.uid())
);
COMMENT ON POLICY "Analysts can insert own samples" ON public.samples
IS 'Only analysts may accession/create samples, and they may only set themselves as received_by.';
CREATE OR REPLACE FUNCTION public.enforce_analyst_sample_receiver()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_receiver_role public.user_role;
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.received_by IS DISTINCT FROM OLD.received_by THEN
        RAISE EXCEPTION 'Sample receiver cannot be changed after accession'
            USING ERRCODE = '42501';
    END IF;
    IF NEW.received_by IS NULL THEN
        RETURN NEW;
    END IF;
    SELECT role
    INTO v_receiver_role
    FROM public.users
    WHERE id = NEW.received_by;
    IF v_receiver_role IS NULL OR v_receiver_role <> 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can receive samples'
            USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS samples_enforce_analyst_receiver ON public.samples;
CREATE TRIGGER samples_enforce_analyst_receiver
BEFORE INSERT OR UPDATE ON public.samples
FOR EACH ROW
EXECUTE FUNCTION public.enforce_analyst_sample_receiver();
COMMENT ON FUNCTION public.enforce_analyst_sample_receiver()
IS 'Guards public.samples.received_by so only analysts may be assigned at insert time and the receiver cannot be changed later.';
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
    IF v_user_role <> 'analyst' THEN
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
    IF v_user_role <> 'analyst' THEN
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

COMMENT ON FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID, TEXT)
IS 'Creates a sample with atomic sample_id generation. SECURITY DEFINER with explicit analyst-only auth/role checks; caller-supplied received_by is ignored.';
COMMENT ON FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB, TEXT)
IS 'Creates a sample and assigns tests in one transaction. SECURITY DEFINER with explicit analyst-only auth/role checks.';
CREATE OR REPLACE FUNCTION public.test_samples_insert_policy_requires_analyst_receiver()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_policy TEXT;
BEGIN
    SELECT with_check
    INTO v_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'samples'
      AND policyname = 'Analysts can insert own samples'
      AND cmd = 'INSERT';
    IF v_policy IS NULL
       OR v_policy NOT ILIKE '%analyst%'
       OR v_policy NOT ILIKE '%received_by%'
       OR v_policy NOT ILIKE '%auth.uid%'
       OR v_policy ILIKE '%manager%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: samples INSERT policy does not enforce analyst-only receivers. Policy: %', COALESCE(v_policy, 'NULL');
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.test_sample_receiver_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_trigger_count INTEGER;
    v_function_def TEXT;
BEGIN
    SELECT COUNT(*)
    INTO v_trigger_count
    FROM pg_trigger
    WHERE tgrelid = 'public.samples'::regclass
      AND tgname = 'samples_enforce_analyst_receiver'
      AND NOT tgisinternal;
    IF v_trigger_count <> 1 THEN
        RAISE WARNING 'SECURITY TEST FAILED: expected samples_enforce_analyst_receiver trigger on public.samples';
        RETURN FALSE;
    END IF;
    SELECT pg_get_functiondef('public.enforce_analyst_sample_receiver()'::regprocedure)
    INTO v_function_def;
    IF v_function_def IS NULL
       OR v_function_def NOT ILIKE '%Only analysts can receive samples%'
       OR v_function_def NOT ILIKE '%cannot be changed after accession%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: sample receiver guard function is missing analyst-only or immutability enforcement';
        RETURN FALSE;
    END IF;
    RETURN TRUE;
END;
$$;
CREATE OR REPLACE FUNCTION public.test_sample_accession_rpcs_require_analyst_role()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_create_def TEXT;
    v_accession_def TEXT;
BEGIN
    SELECT pg_get_functiondef('public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text)'::regprocedure)
    INTO v_create_def;
    SELECT pg_get_functiondef('public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text)'::regprocedure)
    INTO v_accession_def;
    IF v_create_def IS NULL
       OR v_create_def NOT ILIKE '%v_user_role <> ''analyst''%'
       OR v_create_def ILIKE '%manager%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: create_sample_atomic is not analyst-only';
        RETURN FALSE;
    END IF;
    IF v_accession_def IS NULL
       OR v_accession_def NOT ILIKE '%v_user_role <> ''analyst''%'
       OR v_accession_def ILIKE '%manager%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: accession_and_assign_tests is not analyst-only';
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
        ('Doctor Excluded From Operational Policies'::TEXT, test_doctor_not_in_operational_policies(), 'Verifies doctor is not present in write/operational policy branches'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;
REVOKE ALL ON FUNCTION public.test_samples_insert_policy_requires_analyst_receiver() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_sample_receiver_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_sample_accession_rpcs_require_analyst_role() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_samples_insert_policy_requires_analyst_receiver() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_sample_receiver_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_sample_accession_rpcs_require_analyst_role() TO authenticated;
COMMENT ON FUNCTION public.test_samples_insert_policy_requires_analyst_receiver()
IS 'Verifies sample INSERT RLS only allows analysts to create samples for themselves as receiver.';
COMMENT ON FUNCTION public.test_sample_receiver_guard()
IS 'Verifies public.samples has a trigger that enforces analyst-only receivers and immutable received_by values.';
COMMENT ON FUNCTION public.test_sample_accession_rpcs_require_analyst_role()
IS 'Verifies sample accession SECURITY DEFINER RPCs keep analyst-only role guards.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including analyst-only sample receiver coverage and doctor read-only RBAC coverage.';
NOTIFY pgrst, 'reload schema';
