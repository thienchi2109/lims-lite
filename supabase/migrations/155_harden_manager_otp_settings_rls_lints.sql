-- Migration 155: Harden manager OTP settings RLS lint warnings
-- Security Impact: Low
-- Changes:
--   - Combines overlapping SELECT policies on manager_otp_settings into one
--     authenticated-only policy to avoid multiple permissive RLS evaluation.
--   - Wraps auth.uid() in SELECT for initplan caching in the analyst self-read
--     branch.
--   - Recreates manager INSERT/UPDATE policies with an explicit authenticated
--     role target.

SET search_path TO public, extensions;

DROP POLICY IF EXISTS "Analysts can read own OTP settings" ON public.manager_otp_settings;
DROP POLICY IF EXISTS "Managers can read analyst OTP settings" ON public.manager_otp_settings;
DROP POLICY IF EXISTS "Managers can read manager OTP settings" ON public.manager_otp_settings;
DROP POLICY IF EXISTS "Authenticated users can read permitted OTP settings" ON public.manager_otp_settings;

CREATE POLICY "Authenticated users can read permitted OTP settings"
ON public.manager_otp_settings FOR SELECT
TO authenticated
USING (
    (
        (select public.get_user_role()) = 'analyst'::public.user_role
        AND EXISTS (
            SELECT 1
            FROM public.users AS target_user
            WHERE target_user.id = manager_otp_settings.user_id
              AND target_user.id = (select auth.uid())
              AND target_user.role = 'analyst'::public.user_role
              AND target_user.can_access_confidential IS TRUE
              AND target_user.deleted_at IS NULL
        )
    )
    OR (
        (select public.get_user_role()) = 'manager'::public.user_role
        AND (
            manager_otp_settings.user_id = (select auth.uid())
            OR EXISTS (
                SELECT 1
                FROM public.users AS target_user
                WHERE target_user.id = manager_otp_settings.user_id
                  AND target_user.role = 'analyst'::public.user_role
                  AND target_user.deleted_at IS NULL
            )
        )
    )
);

COMMENT ON POLICY "Authenticated users can read permitted OTP settings"
ON public.manager_otp_settings
IS 'Allows authenticated analysts to read only their own confidential OTP settings and managers to read their own or analyst OTP settings while avoiding overlapping permissive SELECT policies.';

DROP POLICY IF EXISTS "Managers can insert analyst OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Managers can insert analyst OTP settings"
ON public.manager_otp_settings FOR INSERT
TO authenticated
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
TO authenticated
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

CREATE OR REPLACE FUNCTION public.test_analyst_otp_management_prerequisites()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_audit_function TEXT;
    v_read_policy TEXT;
    v_public_policy_count INTEGER;
    v_select_policy_count INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'manager_otp_settings'
          AND policyname IN (
              'Authenticated users can read permitted OTP settings',
              'Managers can insert analyst OTP settings',
              'Managers can update analyst OTP settings'
          )
        GROUP BY tablename
        HAVING count(*) = 3
    ) THEN
        RAISE WARNING 'SECURITY TEST FAILED: analyst OTP settings policies are missing';
        RETURN FALSE;
    END IF;

    SELECT count(*)
    INTO v_public_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_otp_settings'
      AND roles = ARRAY['public'::name];

    IF v_public_policy_count <> 0 THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager OTP policies must target authenticated, not public';
        RETURN FALSE;
    END IF;

    SELECT count(*)
    INTO v_select_policy_count
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_otp_settings'
      AND cmd = 'SELECT';

    IF v_select_policy_count <> 1 THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager OTP settings must have exactly one SELECT policy';
        RETURN FALSE;
    END IF;

    SELECT qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_otp_settings'
      AND policyname = 'Authenticated users can read permitted OTP settings'
    INTO v_read_policy;

    IF v_read_policy NOT ILIKE '%SELECT auth.uid%'
       OR v_read_policy ILIKE '%target_user.id = auth.uid()%'
       OR v_read_policy NOT ILIKE '%can_access_confidential IS TRUE%'
       OR v_read_policy NOT ILIKE '%''analyst''::user_role%'
       OR v_read_policy NOT ILIKE '%''manager''::user_role%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: manager OTP read policy must preserve analyst own-row and manager read guards with initplan auth.uid()';
        RETURN FALSE;
    END IF;

    SELECT pg_get_functiondef('public.audit_manager_otp_settings_changes()'::regprocedure)
    INTO v_audit_function;

    IF v_audit_function NOT ILIKE '%otp_email_hash%'
       OR v_audit_function ILIKE '%to_jsonb(NEW)%'
       OR v_audit_function ILIKE '%to_jsonb(OLD)%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: OTP settings audit must hash email and avoid raw row JSON';
        RETURN FALSE;
    END IF;

    IF to_regprocedure('public.get_confidential_analysts_missing_otp_email()') IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: missing confidential analyst OTP preflight RPC';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_analyst_otp_management_prerequisites() TO authenticated;
