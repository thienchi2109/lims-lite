-- Migration 154: Allow confidential analysts to read their own OTP settings
-- Security Impact: Low
-- Enables the shared OTP verification page to display masked analyst OTP
-- destination metadata after password login. The policy is limited to the
-- authenticated analyst's own row and only when confidential access is enabled.

SET search_path TO public, extensions;

DROP POLICY IF EXISTS "Analysts can read own OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Analysts can read own OTP settings"
ON public.manager_otp_settings FOR SELECT
USING (
    (select public.get_user_role()) = 'analyst'::public.user_role
    AND EXISTS (
        SELECT 1
        FROM public.users AS target_user
        WHERE target_user.id = manager_otp_settings.user_id
          AND target_user.id = auth.uid()
          AND target_user.role = 'analyst'::public.user_role
          AND target_user.can_access_confidential IS TRUE
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
    v_analyst_self_read_policy TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'manager_otp_settings'
          AND policyname IN (
              'Managers can read analyst OTP settings',
              'Managers can insert analyst OTP settings',
              'Managers can update analyst OTP settings',
              'Analysts can read own OTP settings'
          )
        GROUP BY tablename
        HAVING count(*) = 4
    ) THEN
        RAISE WARNING 'SECURITY TEST FAILED: analyst OTP settings policies are missing';
        RETURN FALSE;
    END IF;

    SELECT qual
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_otp_settings'
      AND policyname = 'Analysts can read own OTP settings'
    INTO v_analyst_self_read_policy;

    IF v_analyst_self_read_policy NOT ILIKE '%auth.uid%'
       OR v_analyst_self_read_policy NOT ILIKE '%can_access_confidential IS TRUE%'
       OR v_analyst_self_read_policy NOT ILIKE '%role = ''analyst''%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: analyst OTP self-read policy must be own-row and confidential-only';
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
