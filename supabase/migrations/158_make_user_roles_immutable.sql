-- Migration 158: Make user roles immutable after account creation
-- Security Impact: High
-- Changes:
--   - Rejects every UPDATE that changes public.users.role before trusted-role bypasses.
--   - Keeps manager-controlled can_access_confidential updates available for analyst accounts only.
--   - Extends the registered user-write security test to verify role guard ordering.
-- Compliance:
--   - Prevents direct SQL, service_role, and application-path privilege escalation.
--   - Preserves soft deletion, audit triggers, RLS policies, and immutable historical records.

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
    -- Roles are immutable after account creation, including for trusted DB roles.
    IF TG_OP = 'UPDATE' AND NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'User roles are immutable after account creation'
            USING ERRCODE = '42501';
    END IF;

    -- Trusted DB administration remains available for non-role user maintenance.
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
        IF NEW.can_access_confidential IS TRUE AND NEW.role <> 'analyst' THEN
            RAISE EXCEPTION 'Managers can only grant confidential access to analyst accounts'
                USING ERRCODE = '42501';
        END IF;

        RETURN NEW;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        IF OLD.role = 'manager' AND OLD.id IS DISTINCT FROM v_actor_id THEN
            RAISE EXCEPTION 'Managers cannot update other managers'
                USING ERRCODE = '42501';
        END IF;

        IF NEW.can_access_confidential IS DISTINCT FROM OLD.can_access_confidential
           AND (OLD.role <> 'analyst' OR NEW.role <> 'analyst') THEN
            RAISE EXCEPTION 'Managers can only change confidential access for analyst accounts'
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
IS 'SECURITY INVOKER trigger guard that makes public.users.role immutable after insert and blocks forbidden manager-originated user writes.';

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
    v_role_guard_position INTEGER;
    v_trusted_bypass_position INTEGER;
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

    v_role_guard_position := position('NEW.role IS DISTINCT FROM OLD.role' IN v_function_definition);
    v_trusted_bypass_position := position('current_user IN (''postgres'', ''service_role'')' IN v_function_definition);

    IF v_role_guard_position = 0
       OR v_trusted_bypass_position = 0
       OR v_role_guard_position > v_trusted_bypass_position THEN
        RAISE WARNING 'SECURITY TEST FAILED: role immutability must be checked before postgres/service_role bypasses';
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

COMMENT ON FUNCTION public.test_manager_user_write_boundary_guard()
IS 'Verifies public.users role immutability precedes trusted bypasses and preserves analyst-only confidential access controls.';

NOTIFY pgrst, 'reload schema';
