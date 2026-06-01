-- ============================================================================
-- MANAGER EMAIL OTP DB MODEL REGRESSION TESTS
-- ============================================================================
-- Verifies the MVP database model for manager email OTP:
-- - DB admins can configure OTP email metadata directly.
-- - App-authenticated users have no self-service write path for OTP email.
-- - OTP challenges store hash-only codes and enforce expiry/use/lockout.
--
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/manager-email-otp-db-model.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_manager_id UUID := '91000000-0000-0000-0000-000000000044'::UUID;
    v_challenge_id UUID;
    v_result JSONB;
    v_attempt_count INTEGER;
    v_locked_at TIMESTAMPTZ;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES (v_manager_id, 'manager-otp-mvp@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, email, can_access_confidential)
    VALUES (
        v_manager_id,
        'manager_otp_mvp',
        'Manager OTP MVP',
        'manager',
        'manager-otp-mvp@lims.local',
        false
    )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        email = EXCLUDED.email,
        can_access_confidential = EXCLUDED.can_access_confidential;

    INSERT INTO public.manager_otp_settings (user_id, otp_email)
    VALUES (v_manager_id, 'otp-destination@lims.local')
    ON CONFLICT (user_id) DO UPDATE
    SET otp_email = EXCLUDED.otp_email,
        updated_at = now();

    IF NOT EXISTS (
        SELECT 1
        FROM public.manager_otp_settings
        WHERE user_id = v_manager_id
          AND otp_email = 'otp-destination@lims.local'
    ) THEN
        RAISE EXCEPTION 'DB admin OTP email configuration failed';
    END IF;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_manager_id),
        true
    );

    BEGIN
        UPDATE public.manager_otp_settings
        SET otp_email = 'self-service@lims.local'
        WHERE user_id = v_manager_id;

        IF FOUND THEN
            RAISE EXCEPTION 'authenticated self-service update unexpectedly changed manager_otp_settings';
        END IF;
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    RESET ROLE;

    INSERT INTO public.manager_otp_challenges (
        user_id,
        session_id,
        code_hash,
        expires_at,
        resend_available_at
    ) VALUES (
        v_manager_id,
        'session-issue-44',
        crypt('123456', gen_salt('bf')),
        now() + interval '5 minutes',
        now() + interval '1 minute'
    )
    RETURNING id INTO v_challenge_id;

    SELECT public.verify_manager_otp_challenge(v_challenge_id, '000000')
    INTO v_result;

    IF v_result->>'status' <> 'invalid' THEN
        RAISE EXCEPTION 'wrong OTP should be invalid, got %', v_result;
    END IF;

    SELECT attempt_count
    INTO v_attempt_count
    FROM public.manager_otp_challenges
    WHERE id = v_challenge_id;

    IF v_attempt_count <> 1 THEN
        RAISE EXCEPTION 'wrong OTP should increment attempt_count to 1, got %', v_attempt_count;
    END IF;

    SELECT public.verify_manager_otp_challenge(v_challenge_id, '123456')
    INTO v_result;

    IF v_result->>'status' <> 'verified' THEN
        RAISE EXCEPTION 'correct OTP should verify, got %', v_result;
    END IF;

    SELECT public.verify_manager_otp_challenge(v_challenge_id, '123456')
    INTO v_result;

    IF v_result->>'status' <> 'used' THEN
        RAISE EXCEPTION 'used OTP should not verify again, got %', v_result;
    END IF;

    INSERT INTO public.manager_otp_challenges (
        user_id,
        session_id,
        code_hash,
        expires_at,
        attempt_count,
        resend_available_at
    ) VALUES (
        v_manager_id,
        'session-issue-44-lock',
        crypt('654321', gen_salt('bf')),
        now() + interval '5 minutes',
        4,
        now()
    )
    RETURNING id INTO v_challenge_id;

    SELECT public.verify_manager_otp_challenge(v_challenge_id, '000000')
    INTO v_result;

    IF v_result->>'status' <> 'locked' THEN
        RAISE EXCEPTION 'fifth wrong OTP should lock challenge, got %', v_result;
    END IF;

    SELECT locked_at
    INTO v_locked_at
    FROM public.manager_otp_challenges
    WHERE id = v_challenge_id;

    IF v_locked_at IS NULL THEN
        RAISE EXCEPTION 'locked challenge should set locked_at';
    END IF;

    INSERT INTO public.manager_otp_challenges (
        user_id,
        session_id,
        code_hash,
        expires_at,
        resend_available_at,
        created_at
    ) VALUES (
        v_manager_id,
        'session-issue-44-expired',
        crypt('111111', gen_salt('bf')),
        now() - interval '1 minute',
        now() - interval '2 minutes',
        now() - interval '6 minutes'
    )
    RETURNING id INTO v_challenge_id;

    SELECT public.verify_manager_otp_challenge(v_challenge_id, '111111')
    INTO v_result;

    IF v_result->>'status' <> 'expired' THEN
        RAISE EXCEPTION 'expired OTP should not verify, got %', v_result;
    END IF;

    SELECT public.verify_manager_otp_challenge(
        '00000000-0000-0000-0000-000000000000'::UUID,
        '123456'
    )
    INTO v_result;

    IF v_result->>'status' <> 'not_found' THEN
        RAISE EXCEPTION 'missing OTP challenge should return not_found, got %', v_result;
    END IF;
END $$;

ROLLBACK;
