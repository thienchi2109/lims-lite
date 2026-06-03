-- Harden manager OTP verification lifecycle.
--
-- Security Impact:
-- - Keeps OTP attempt counting and lockout inside a SECURITY DEFINER RPC with row locking.
-- - Aligns database verification with the app-owned SHA-256 OTP hash format.
-- - Writes non-sensitive audit rows for verification success, failure, expiry, used, and lockout outcomes.
-- - Does not expose plaintext OTP values or grant direct app access to challenge rows.

DROP FUNCTION IF EXISTS public.verify_manager_otp_challenge(UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_manager_otp_challenge(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ);

CREATE OR REPLACE FUNCTION public.create_manager_otp_challenge(
    p_challenge_id UUID,
    p_user_id UUID,
    p_session_id TEXT,
    p_code_hash TEXT,
    p_expires_at TIMESTAMPTZ,
    p_resend_available_at TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
    v_auth_uid UUID := auth.uid();
    v_existing public.manager_otp_challenges%ROWTYPE;
    v_inserted public.manager_otp_challenges%ROWTYPE;
BEGIN
    IF p_challenge_id IS NULL
       OR p_user_id IS NULL
       OR p_session_id IS NULL
       OR p_code_hash IS NULL
       OR p_expires_at IS NULL
       OR p_resend_available_at IS NULL THEN
        RAISE EXCEPTION 'Invalid OTP challenge input' USING ERRCODE = '22023';
    END IF;

    IF v_auth_uid IS NOT NULL AND p_user_id <> v_auth_uid THEN
        RAISE EXCEPTION 'OTP challenge not found' USING ERRCODE = '42501';
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_session_id, 0));

    SELECT
        id,
        user_id,
        session_id,
        code_hash,
        expires_at,
        used_at,
        locked_at,
        attempt_count,
        resend_available_at,
        created_at
    INTO v_existing
    FROM public.manager_otp_challenges
    WHERE user_id = p_user_id
      AND session_id = p_session_id
      AND used_at IS NULL
      AND expires_at > now()
    ORDER BY created_at DESC
    LIMIT 1
    FOR UPDATE;

    IF FOUND AND v_existing.locked_at IS NOT NULL THEN
        RETURN jsonb_build_object(
            'ok', false,
            'status', 'locked',
            'challenge', jsonb_build_object(
                'id', v_existing.id,
                'expires_at', v_existing.expires_at,
                'resend_available_at', v_existing.resend_available_at
            )
        );
    END IF;

    IF FOUND AND v_existing.resend_available_at > now() THEN
        RETURN jsonb_build_object(
            'ok', false,
            'status', 'cooldown',
            'challenge', jsonb_build_object(
                'id', v_existing.id,
                'expires_at', v_existing.expires_at,
                'resend_available_at', v_existing.resend_available_at
            )
        );
    END IF;

    INSERT INTO public.manager_otp_challenges (
        id,
        user_id,
        session_id,
        code_hash,
        expires_at,
        resend_available_at
    )
    VALUES (
        p_challenge_id,
        p_user_id,
        p_session_id,
        p_code_hash,
        p_expires_at,
        p_resend_available_at
    )
    RETURNING * INTO v_inserted;

    RETURN jsonb_build_object(
        'ok', true,
        'challenge', jsonb_build_object(
            'id', v_inserted.id,
            'expires_at', v_inserted.expires_at,
            'resend_available_at', v_inserted.resend_available_at
        )
    );
END;
$function$;

CREATE OR REPLACE FUNCTION public.verify_manager_otp_challenge(
    p_challenge_id UUID,
    p_code TEXT,
    p_user_id UUID,
    p_session_id TEXT
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
    v_status TEXT;
BEGIN
    IF p_user_id IS NULL OR p_session_id IS NULL THEN
        RAISE EXCEPTION 'Invalid OTP verification input' USING ERRCODE = '22023';
    END IF;

    IF v_auth_uid IS NOT NULL AND p_user_id <> v_auth_uid THEN
        RAISE EXCEPTION 'OTP challenge not found' USING ERRCODE = '42501';
    END IF;

    SELECT
        id,
        user_id,
        session_id,
        code_hash,
        expires_at,
        used_at,
        locked_at,
        attempt_count,
        resend_available_at,
        created_at
    INTO v_challenge
    FROM public.manager_otp_challenges
    WHERE id = p_challenge_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('ok', false, 'status', 'not_found');
    END IF;

    IF v_challenge.user_id <> p_user_id OR v_challenge.session_id <> p_session_id THEN
        RAISE EXCEPTION 'OTP challenge not found' USING ERRCODE = '42501';
    END IF;

    IF v_challenge.used_at IS NOT NULL THEN
        INSERT INTO public.audit_logs (table_name, record_id, operation, new_values, changed_by)
        VALUES (
            'manager_otp_challenges',
            v_challenge.id,
            'MANAGER_OTP_VERIFY_USED',
            jsonb_build_object('status', 'used', 'attempt_count', v_challenge.attempt_count),
            v_challenge.user_id
        );
        RETURN jsonb_build_object('ok', false, 'status', 'used');
    END IF;

    IF v_challenge.locked_at IS NOT NULL THEN
        INSERT INTO public.audit_logs (table_name, record_id, operation, new_values, changed_by)
        VALUES (
            'manager_otp_challenges',
            v_challenge.id,
            'MANAGER_OTP_VERIFY_LOCKED',
            jsonb_build_object('status', 'locked', 'attempt_count', v_challenge.attempt_count),
            v_challenge.user_id
        );
        RETURN jsonb_build_object('ok', false, 'status', 'locked');
    END IF;

    IF v_challenge.expires_at <= now() THEN
        INSERT INTO public.audit_logs (table_name, record_id, operation, new_values, changed_by)
        VALUES (
            'manager_otp_challenges',
            v_challenge.id,
            'MANAGER_OTP_VERIFY_EXPIRED',
            jsonb_build_object('status', 'expired', 'attempt_count', v_challenge.attempt_count),
            v_challenge.user_id
        );
        RETURN jsonb_build_object('ok', false, 'status', 'expired');
    END IF;

    IF p_code IS NOT NULL
       AND encode(digest(p_code, 'sha256'), 'hex') = v_challenge.code_hash THEN
        UPDATE public.manager_otp_challenges
        SET used_at = now()
        WHERE id = p_challenge_id;

        INSERT INTO public.audit_logs (table_name, record_id, operation, new_values, changed_by)
        VALUES (
            'manager_otp_challenges',
            v_challenge.id,
            'MANAGER_OTP_VERIFY_SUCCESS',
            jsonb_build_object('status', 'verified', 'attempt_count', v_challenge.attempt_count),
            v_challenge.user_id
        );

        RETURN jsonb_build_object('ok', true, 'status', 'verified');
    END IF;

    v_attempt_count := v_challenge.attempt_count + 1;
    v_status := CASE WHEN v_attempt_count >= 3 THEN 'locked' ELSE 'invalid' END;

    UPDATE public.manager_otp_challenges
    SET attempt_count = v_attempt_count,
        locked_at = CASE WHEN v_attempt_count >= 3 THEN now() ELSE locked_at END
    WHERE id = p_challenge_id;

    INSERT INTO public.audit_logs (table_name, record_id, operation, new_values, changed_by)
    VALUES (
        'manager_otp_challenges',
        v_challenge.id,
        CASE WHEN v_status = 'locked' THEN 'MANAGER_OTP_VERIFY_LOCKED' ELSE 'MANAGER_OTP_VERIFY_FAILED' END,
        jsonb_build_object('status', v_status, 'attempt_count', v_attempt_count),
        v_challenge.user_id
    );

    RETURN jsonb_build_object('ok', false, 'status', v_status);
END;
$function$;

REVOKE ALL ON FUNCTION public.create_manager_otp_challenge(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT, UUID, TEXT) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_manager_otp_challenge(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT, UUID, TEXT) TO service_role;

COMMENT ON FUNCTION public.create_manager_otp_challenge(UUID, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ)
IS 'Atomically creates or reuses a manager email OTP challenge under an advisory transaction lock.';

COMMENT ON FUNCTION public.verify_manager_otp_challenge(UUID, TEXT, UUID, TEXT)
IS 'Atomically verifies a manager email OTP challenge, records non-sensitive audit outcomes, and never stores plaintext OTP.';

NOTIFY pgrst, 'reload schema';
