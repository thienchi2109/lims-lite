-- Add manager email OTP database model for MVP step-up foundation.
--
-- Security Impact:
-- - Adds dashboard-managed manager OTP destination metadata.
-- - Authenticated app users receive no INSERT/UPDATE/DELETE path for OTP email.
-- - Adds hash-only OTP challenge storage with RLS enabled and no direct app grants.
-- - Adds SECURITY DEFINER verification RPC with fixed search_path and ownership guard.
-- - MVP decision: DB admins may edit OTP email metadata directly in Supabase Dashboard;
--   audit integration for those direct edits is intentionally deferred.

SET search_path TO public, extensions;

CREATE TABLE IF NOT EXISTS public.manager_otp_settings (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    otp_email TEXT NOT NULL CHECK (
        otp_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
    ),
    configured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manager_otp_challenges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL,
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    used_at TIMESTAMPTZ,
    locked_at TIMESTAMPTZ,
    attempt_count INTEGER NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    resend_available_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT manager_otp_challenges_expiry_after_create
        CHECK (expires_at > created_at),
    CONSTRAINT manager_otp_challenges_used_or_locked
        CHECK (used_at IS NULL OR locked_at IS NULL)
);

CREATE INDEX IF NOT EXISTS idx_manager_otp_settings_otp_email
ON public.manager_otp_settings (lower(otp_email));

CREATE INDEX IF NOT EXISTS idx_manager_otp_challenges_user_created
ON public.manager_otp_challenges (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_manager_otp_challenges_expires_at
ON public.manager_otp_challenges (expires_at);

CREATE INDEX IF NOT EXISTS idx_manager_otp_challenges_active
ON public.manager_otp_challenges (user_id, session_id, expires_at DESC)
WHERE used_at IS NULL AND locked_at IS NULL;

ALTER TABLE public.manager_otp_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manager_otp_challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can read manager OTP settings" ON public.manager_otp_settings;
CREATE POLICY "Managers can read manager OTP settings"
ON public.manager_otp_settings FOR SELECT
USING (public.get_user_role() = 'manager'::public.user_role);

DROP POLICY IF EXISTS "No app access to manager OTP challenges" ON public.manager_otp_challenges;
CREATE POLICY "No app access to manager OTP challenges"
ON public.manager_otp_challenges FOR SELECT
USING (false);

REVOKE ALL ON public.manager_otp_settings FROM PUBLIC;
REVOKE ALL ON public.manager_otp_settings FROM anon;
REVOKE ALL ON public.manager_otp_settings FROM authenticated;
GRANT SELECT ON public.manager_otp_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_otp_settings TO service_role;

REVOKE ALL ON public.manager_otp_challenges FROM PUBLIC;
REVOKE ALL ON public.manager_otp_challenges FROM anon;
REVOKE ALL ON public.manager_otp_challenges FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manager_otp_challenges TO service_role;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgname = 'update_manager_otp_settings_updated_at'
    ) THEN
        CREATE TRIGGER update_manager_otp_settings_updated_at
        BEFORE UPDATE ON public.manager_otp_settings
        FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.verify_manager_otp_challenge(
    p_challenge_id UUID,
    p_code TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_challenge public.manager_otp_challenges%ROWTYPE;
    v_attempt_count INTEGER;
BEGIN
    SELECT *
    INTO v_challenge
    FROM public.manager_otp_challenges
    WHERE id = p_challenge_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'status', 'not_found');
    END IF;

    IF v_auth_uid IS NOT NULL AND v_challenge.user_id <> v_auth_uid THEN
        RAISE EXCEPTION 'OTP challenge not found' USING ERRCODE = '42501';
    END IF;

    IF v_challenge.used_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 'used');
    END IF;

    IF v_challenge.locked_at IS NOT NULL THEN
        RETURN jsonb_build_object('ok', false, 'status', 'locked');
    END IF;

    IF v_challenge.expires_at <= now() THEN
        RETURN jsonb_build_object('ok', false, 'status', 'expired');
    END IF;

    IF p_code IS NOT NULL
       AND crypt(p_code, v_challenge.code_hash) = v_challenge.code_hash THEN
        UPDATE public.manager_otp_challenges
        SET used_at = now()
        WHERE id = p_challenge_id;

        RETURN jsonb_build_object('ok', true, 'status', 'verified');
    END IF;

    v_attempt_count := v_challenge.attempt_count + 1;

    UPDATE public.manager_otp_challenges
    SET attempt_count = v_attempt_count,
        locked_at = CASE WHEN v_attempt_count >= 5 THEN now() ELSE locked_at END
    WHERE id = p_challenge_id;

    IF v_attempt_count >= 5 THEN
        RETURN jsonb_build_object('ok', false, 'status', 'locked');
    END IF;

    RETURN jsonb_build_object('ok', false, 'status', 'invalid');
END;
$function$;

REVOKE ALL ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT) TO authenticated;

COMMENT ON TABLE public.manager_otp_settings
IS 'MVP manager OTP destination metadata. DB admins configure rows directly in self-hosted Supabase Dashboard; app users have no write path.';

COMMENT ON TABLE public.manager_otp_challenges
IS 'Hash-only manager email OTP challenges with expiry, single-use, resend cooldown, attempts, and lockout metadata.';

COMMENT ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT)
IS 'Verifies a manager email OTP challenge by comparing the supplied code with the stored hash; never stores plaintext OTP.';

NOTIFY pgrst, 'reload schema';
