-- Migration 148: Harden manager user write boundaries
-- Security Impact: High
-- Changes:
--   - Adds a public.users trigger guard for authenticated manager-originated writes
--   - Blocks managers from updating/deleting other manager rows
--   - Blocks managers from inserting or toggling can_access_confidential=true
--   - Preserves trusted postgres/service_role administration of can_access_confidential
-- Compliance:
--   - Provides DB defense-in-depth behind server-action authorization checks
--   - Rejects unauthorized confidential-access changes instead of silently accepting them

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.guard_manager_user_write_boundaries()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_actor_id UUID := auth.uid();
    v_actor_role public.user_role := public.get_user_role();
BEGIN
    -- Trusted DB administration must remain able to manage user permissions.
    IF current_user IN ('postgres', 'service_role') THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        RETURN NEW;
    END IF;

    IF current_user <> 'authenticated' OR v_actor_role <> 'manager' THEN
        IF TG_OP = 'DELETE' THEN
            RETURN OLD;
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.can_access_confidential IS TRUE THEN
            RAISE EXCEPTION 'Managers cannot grant confidential access'
                USING ERRCODE = '42501';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.role = 'manager' AND OLD.id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'Managers cannot update other managers'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.can_access_confidential IS DISTINCT FROM OLD.can_access_confidential THEN
            RAISE EXCEPTION 'Managers cannot change confidential access'
                USING ERRCODE = '42501';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'DELETE' THEN
        IF OLD.role = 'manager' AND OLD.id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'Managers cannot delete other managers'
                USING ERRCODE = '42501';
        END IF;

        RETURN OLD;
    END IF;

    RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.guard_manager_user_write_boundaries()
IS 'SECURITY INVOKER trigger guard that blocks authenticated manager-originated forbidden public.users writes while preserving trusted DB administration.';

DROP TRIGGER IF EXISTS guard_manager_user_write_boundaries ON public.users;
CREATE TRIGGER guard_manager_user_write_boundaries
BEFORE INSERT OR UPDATE OR DELETE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.guard_manager_user_write_boundaries();

GRANT UPDATE (can_access_confidential) ON TABLE public.users TO service_role;

CREATE OR REPLACE FUNCTION public.test_manager_user_write_boundary_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_trigger_definition TEXT;
    v_function_definition TEXT;
    v_is_security_definer BOOLEAN;
    v_service_role_can_update_confidential BOOLEAN;
BEGIN
    SELECT pg_get_triggerdef(t.oid)
    INTO v_trigger_definition
    FROM pg_trigger AS t
    WHERE t.tgrelid = 'public.users'::regclass
      AND t.tgname = 'guard_manager_user_write_boundaries'
      AND NOT t.tgisinternal
      AND t.tgenabled <> 'D';

    IF v_trigger_definition IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.users manager write boundary trigger is missing or disabled';
        RETURN FALSE;
    END IF;

    IF v_trigger_definition NOT ILIKE '%BEFORE INSERT OR DELETE OR UPDATE%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary trigger must cover INSERT, UPDATE, and DELETE. Trigger: %', v_trigger_definition;
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef(p.oid), p.prosecdef
    INTO v_function_definition, v_is_security_definer
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'guard_manager_user_write_boundaries';

    IF v_function_definition IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.guard_manager_user_write_boundaries() is missing';
        RETURN FALSE;
    END IF;

    IF v_is_security_definer THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary trigger must remain SECURITY INVOKER so current_user identifies API roles';
        RETURN FALSE;
    END IF;

    IF v_function_definition NOT ILIKE '%current_user IN (''postgres'', ''service_role'')%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary guard must preserve trusted postgres/service_role administration';
        RETURN FALSE;
    END IF;

    IF v_function_definition NOT ILIKE '%NEW.can_access_confidential IS TRUE%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary guard must reject confidential-enabled inserts';
        RETURN FALSE;
    END IF;

    IF v_function_definition NOT ILIKE '%NEW.can_access_confidential IS DISTINCT FROM OLD.can_access_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary guard must reject confidential flag toggles';
        RETURN FALSE;
    END IF;

    IF v_function_definition NOT ILIKE '%OLD.role = ''manager''%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary guard must protect existing manager rows';
        RETURN FALSE;
    END IF;

    v_service_role_can_update_confidential :=
        has_column_privilege('service_role', 'public.users', 'can_access_confidential', 'UPDATE');

    IF NOT v_service_role_can_update_confidential THEN
        RAISE WARNING 'SECURITY TEST FAILED: service_role must retain column-scoped UPDATE on public.users.can_access_confidential';
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
        ('Manager User Write Boundary Guard'::TEXT, test_manager_user_write_boundary_guard(), 'Verifies public.users manager write guard covers manager rows, confidential flag changes, and trusted service_role administration'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_manager_user_write_boundaries() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.test_manager_user_write_boundary_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_security_tests() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.test_manager_user_write_boundary_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_tests() TO authenticated;

COMMENT ON FUNCTION public.test_manager_user_write_boundary_guard()
IS 'Verifies the public.users manager write boundary trigger covers forbidden manager writes and keeps service_role confidential-access administration available.';
COMMENT ON FUNCTION public.run_security_tests()
IS 'Runs security verification tests, including manager public.users write boundaries and confidential access administration grants.';

NOTIFY pgrst, 'reload schema';
