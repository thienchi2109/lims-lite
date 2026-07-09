-- ============================================================================
-- ANALYST EMAIL OTP PHASE 1 REGRESSION TESTS
-- ============================================================================
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/analyst-email-otp-phase1.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_manager_id UUID := '92000000-0000-0000-0000-000000000001'::UUID;
    v_analyst_id UUID := '92000000-0000-0000-0000-000000000002'::UUID;
    v_doctor_id UUID := '92000000-0000-0000-0000-000000000003'::UUID;
    v_audit_has_plaintext BOOLEAN;
    v_missing_count INTEGER;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'phase1-manager@lims.local'),
        (v_analyst_id, 'phase1-analyst@lims.local'),
        (v_doctor_id, 'phase1-doctor@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, email, can_access_confidential, deleted_at)
    VALUES
        (v_manager_id, 'phase1_manager', 'Phase1 Manager', 'manager', 'phase1-manager@lims.local', false, NULL),
        (v_analyst_id, 'phase1_analyst', 'Phase1 Analyst', 'analyst', 'phase1-analyst@lims.local', false, NULL),
        (v_doctor_id, 'phase1_doctor', 'Phase1 Doctor', 'doctor', 'phase1-doctor@lims.local', false, NULL)
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        email = EXCLUDED.email,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    DELETE FROM public.manager_otp_settings
    WHERE user_id IN (v_manager_id, v_analyst_id, v_doctor_id);

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_manager_id),
        true
    );

    UPDATE public.users
    SET can_access_confidential = true
    WHERE id = v_analyst_id;

    IF NOT EXISTS (
        SELECT 1 FROM public.users
        WHERE id = v_analyst_id
          AND can_access_confidential IS TRUE
    ) THEN
        RAISE EXCEPTION 'manager failed to grant analyst confidential access';
    END IF;

    BEGIN
        UPDATE public.users
        SET can_access_confidential = true
        WHERE id = v_doctor_id;
        RAISE EXCEPTION 'manager unexpectedly changed doctor confidential access';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    INSERT INTO public.manager_otp_settings (user_id, otp_email)
    VALUES (v_analyst_id, 'phase1-analyst-otp@lims.local');

    IF NOT EXISTS (
        SELECT 1
        FROM public.manager_otp_settings
        WHERE user_id = v_analyst_id
          AND otp_email = 'phase1-analyst-otp@lims.local'
    ) THEN
        RAISE EXCEPTION 'manager failed to configure analyst OTP email';
    END IF;

    BEGIN
        INSERT INTO public.manager_otp_settings (user_id, otp_email)
        VALUES (v_doctor_id, 'phase1-doctor-otp@lims.local');
        RAISE EXCEPTION 'manager unexpectedly configured doctor OTP email';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
        WHEN check_violation THEN
            NULL;
    END;

    RESET ROLE;
    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        true
    );

    UPDATE public.manager_otp_settings
    SET otp_email = 'self-service-analyst@lims.local'
    WHERE user_id = v_analyst_id;

    IF FOUND THEN
        RAISE EXCEPTION 'analyst self-service OTP update unexpectedly changed settings';
    END IF;

    RESET ROLE;

    SELECT EXISTS (
        SELECT 1
        FROM public.audit_logs
        WHERE table_name = 'manager_otp_settings'
          AND record_id = v_analyst_id
          AND (
              old_values::TEXT ILIKE '%phase1-analyst-otp@lims.local%'
              OR new_values::TEXT ILIKE '%phase1-analyst-otp@lims.local%'
          )
    )
    INTO v_audit_has_plaintext;

    IF v_audit_has_plaintext THEN
        RAISE EXCEPTION 'OTP settings audit leaked plaintext email';
    END IF;

    DELETE FROM public.manager_otp_settings
    WHERE user_id = v_analyst_id;

    SELECT count(*)
    INTO v_missing_count
    FROM public.get_confidential_analysts_missing_otp_email()
    WHERE user_id = v_analyst_id;

    IF v_missing_count <> 1 THEN
        RAISE EXCEPTION 'preflight RPC did not report confidential analyst missing OTP email';
    END IF;
END $$;

ROLLBACK;

SELECT 'analyst-email-otp-phase1: ok' AS result;
