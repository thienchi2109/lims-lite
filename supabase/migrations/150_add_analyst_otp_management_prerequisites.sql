-- Migration 150: Add analyst OTP management prerequisites
-- Security Impact: High
-- Changes:
--   - Allows authenticated managers to toggle can_access_confidential only for analyst rows.
--   - Allows manager-managed OTP destination metadata for analyst accounts.
--   - Audits manager_otp_settings changes without storing plaintext OTP email values.
--   - Adds an operational preflight RPC for confidential analysts missing OTP email settings.
-- Non-goal:
--   - Does not add or expose any analyst OTP env flag. Env flags remain operator-only.

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
IS 'SECURITY INVOKER trigger guard that blocks authenticated manager-originated forbidden public.users writes while allowing analyst-only confidential access management.';

DROP POLICY IF EXISTS "Managers can read analyst OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Managers can read analyst OTP settings"
ON public.manager_otp_settings FOR SELECT
USING (
    (select public.get_user_role()) = 'manager'::public.user_role
    AND EXISTS (
        SELECT 1
        FROM public.users AS target_user
        WHERE target_user.id = manager_otp_settings.user_id
          AND target_user.role = 'analyst'::public.user_role
          AND target_user.deleted_at IS NULL
    )
);

DROP POLICY IF EXISTS "Managers can insert analyst OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Managers can insert analyst OTP settings"
ON public.manager_otp_settings FOR INSERT
WITH CHECK (
    (select public.get_user_role()) = 'manager'::public.user_role
    AND EXISTS (
        SELECT 1
        FROM public.users AS target_user
        WHERE target_user.id = manager_otp_settings.user_id
          AND target_user.role = 'analyst'::public.user_role
          AND target_user.deleted_at IS NULL
    )
);

DROP POLICY IF EXISTS "Managers can update analyst OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Managers can update analyst OTP settings"
ON public.manager_otp_settings FOR UPDATE
USING (
    (select public.get_user_role()) = 'manager'::public.user_role
    AND EXISTS (
        SELECT 1
        FROM public.users AS target_user
        WHERE target_user.id = manager_otp_settings.user_id
          AND target_user.role = 'analyst'::public.user_role
          AND target_user.deleted_at IS NULL
    )
)
WITH CHECK (
    (select public.get_user_role()) = 'manager'::public.user_role
    AND EXISTS (
        SELECT 1
        FROM public.users AS target_user
        WHERE target_user.id = manager_otp_settings.user_id
          AND target_user.role = 'analyst'::public.user_role
          AND target_user.deleted_at IS NULL
    )
);

GRANT INSERT, UPDATE ON public.manager_otp_settings TO authenticated;

CREATE OR REPLACE FUNCTION public.audit_manager_otp_settings_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_old_values JSONB;
    v_new_values JSONB;
BEGIN
    IF TG_OP IN ('UPDATE', 'DELETE') THEN
        v_old_values := jsonb_build_object(
            'user_id', OLD.user_id,
            'otp_email_hash', encode(digest(lower(OLD.otp_email), 'sha256'), 'hex'),
            'configured_at', OLD.configured_at,
            'updated_at', OLD.updated_at
        );
    END IF;

    IF TG_OP IN ('INSERT', 'UPDATE') THEN
        v_new_values := jsonb_build_object(
            'user_id', NEW.user_id,
            'otp_email_hash', encode(digest(lower(NEW.otp_email), 'sha256'), 'hex'),
            'configured_at', NEW.configured_at,
            'updated_at', NEW.updated_at
        );
    END IF;

    IF TG_OP = 'UPDATE' AND v_old_values = v_new_values THEN
        RETURN NEW;
    END IF;

    INSERT INTO public.audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_by
    )
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.user_id, OLD.user_id),
        TG_OP,
        v_old_values,
        v_new_values,
        auth.uid()
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.audit_manager_otp_settings_changes()
IS 'Audits OTP destination metadata changes using SHA-256 email hashes only; plaintext otp_email is never written to audit_logs.';

DROP TRIGGER IF EXISTS audit_manager_otp_settings_changes ON public.manager_otp_settings;
CREATE TRIGGER audit_manager_otp_settings_changes
AFTER INSERT OR UPDATE OR DELETE ON public.manager_otp_settings
FOR EACH ROW
EXECUTE FUNCTION public.audit_manager_otp_settings_changes();

CREATE OR REPLACE FUNCTION public.get_confidential_analysts_missing_otp_email()
RETURNS TABLE(
    user_id UUID,
    username TEXT,
    full_name TEXT,
    email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
    SELECT
        users.id AS user_id,
        users.username,
        users.full_name,
        users.email
    FROM public.users
    LEFT JOIN public.manager_otp_settings
        ON manager_otp_settings.user_id = users.id
    WHERE users.role = 'analyst'::public.user_role
      AND users.can_access_confidential IS TRUE
      AND users.deleted_at IS NULL
      AND manager_otp_settings.user_id IS NULL
    ORDER BY users.username;
$$;

REVOKE ALL ON FUNCTION public.get_confidential_analysts_missing_otp_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_confidential_analysts_missing_otp_email() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_confidential_analysts_missing_otp_email() TO service_role;

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

    IF v_function_definition NOT ILIKE '%NEW.can_access_confidential IS TRUE AND NEW.role <> ''analyst''%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary guard must allow confidential-enabled analyst inserts only';
        RETURN FALSE;
    END IF;

    IF v_function_definition NOT ILIKE '%OLD.role <> ''analyst'' OR NEW.role <> ''analyst''%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager write boundary guard must restrict confidential flag toggles to analyst rows';
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

GRANT EXECUTE ON FUNCTION public.test_manager_user_write_boundary_guard() TO authenticated;
