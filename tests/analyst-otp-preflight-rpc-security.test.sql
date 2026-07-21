-- ============================================================================
-- ANALYST OTP PREFLIGHT RPC AUTHORIZATION REGRESSION
-- ============================================================================
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/analyst-otp-preflight-rpc-security.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

DO $test$
DECLARE
    v_manager_id UUID := '91910000-0000-0000-0000-000000000001'::UUID;
    v_analyst_id UUID := '91910000-0000-0000-0000-000000000002'::UUID;
    v_doctor_id UUID := '91910000-0000-0000-0000-000000000003'::UUID;
    v_missing_analyst_id UUID := '91910000-0000-0000-0000-000000000004'::UUID;
    v_configured_analyst_id UUID := '91910000-0000-0000-0000-000000000005'::UUID;
    v_visible_count INTEGER;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_manager_id, 'issue91-manager@lims.local'),
        (v_analyst_id, 'issue91-analyst@lims.local'),
        (v_doctor_id, 'issue91-doctor@lims.local'),
        (v_missing_analyst_id, 'issue91-missing@lims.local'),
        (v_configured_analyst_id, 'issue91-configured@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id,
        username,
        full_name,
        role,
        email,
        can_access_confidential,
        deleted_at
    )
    VALUES
        (
            v_manager_id,
            'issue91_manager',
            'Issue 91 Manager',
            'manager',
            'issue91-manager@lims.local',
            FALSE,
            NULL
        ),
        (
            v_analyst_id,
            'issue91_analyst',
            'Issue 91 Analyst',
            'analyst',
            'issue91-analyst@lims.local',
            FALSE,
            NULL
        ),
        (
            v_doctor_id,
            'issue91_doctor',
            'Issue 91 Doctor',
            'doctor',
            'issue91-doctor@lims.local',
            FALSE,
            NULL
        ),
        (
            v_missing_analyst_id,
            'issue91_missing',
            'Issue 91 Missing OTP',
            'analyst',
            'issue91-missing@lims.local',
            TRUE,
            NULL
        ),
        (
            v_configured_analyst_id,
            'issue91_configured',
            'Issue 91 Configured OTP',
            'analyst',
            'issue91-configured@lims.local',
            TRUE,
            NULL
        )
    ON CONFLICT (id) DO UPDATE
    SET username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        email = EXCLUDED.email,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;

    DELETE FROM public.manager_otp_settings
    WHERE user_id IN (v_missing_analyst_id, v_configured_analyst_id);

    INSERT INTO public.manager_otp_settings (user_id, otp_email)
    VALUES (v_configured_analyst_id, 'issue91-configured-otp@lims.local');

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_manager_id),
        TRUE
    );

    SELECT count(*)
    INTO v_visible_count
    FROM public.get_confidential_analysts_missing_otp_email()
    WHERE user_id = v_missing_analyst_id;

    IF v_visible_count <> 1 THEN
        RAISE EXCEPTION 'manager could not read the missing analyst OTP preflight row';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.get_confidential_analysts_missing_otp_email()
        WHERE user_id = v_configured_analyst_id
    ) THEN
        RAISE EXCEPTION 'preflight RPC returned an analyst with configured OTP metadata';
    END IF;

    RESET ROLE;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        TRUE
    );

    BEGIN
        PERFORM 1
        FROM public.get_confidential_analysts_missing_otp_email();
        RAISE EXCEPTION 'analyst unexpectedly executed the OTP preflight RPC';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    RESET ROLE;

    SET LOCAL ROLE authenticated;
    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_doctor_id),
        TRUE
    );

    BEGIN
        PERFORM 1
        FROM public.get_confidential_analysts_missing_otp_email();
        RAISE EXCEPTION 'doctor unexpectedly executed the OTP preflight RPC';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    RESET ROLE;

    SET LOCAL ROLE anon;
    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"anon"}',
        TRUE
    );

    BEGIN
        PERFORM 1
        FROM public.get_confidential_analysts_missing_otp_email();
        RAISE EXCEPTION 'anon unexpectedly executed the OTP preflight RPC';
    EXCEPTION
        WHEN insufficient_privilege THEN
            NULL;
    END;

    RESET ROLE;

    SET LOCAL ROLE service_role;
    PERFORM set_config(
        'request.jwt.claims',
        '{"role":"service_role"}',
        TRUE
    );

    SELECT count(*)
    INTO v_visible_count
    FROM public.get_confidential_analysts_missing_otp_email()
    WHERE user_id = v_missing_analyst_id;

    IF v_visible_count <> 1 THEN
        RAISE EXCEPTION 'service_role could not execute the OTP preflight RPC';
    END IF;

    RESET ROLE;

    IF has_function_privilege(
        'anon',
        'public.get_confidential_analysts_missing_otp_email()',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'anon has EXECUTE on the OTP preflight RPC';
    END IF;

    IF NOT has_function_privilege(
        'authenticated',
        'public.get_confidential_analysts_missing_otp_email()',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'authenticated is missing required OTP preflight EXECUTE';
    END IF;

    IF NOT has_function_privilege(
        'service_role',
        'public.get_confidential_analysts_missing_otp_email()',
        'EXECUTE'
    ) THEN
        RAISE EXCEPTION 'service_role is missing required OTP preflight EXECUTE';
    END IF;
END;
$test$;

ROLLBACK;

SELECT 'analyst-otp-preflight-rpc-security: ok' AS result;
