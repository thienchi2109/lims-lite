-- USER ROLE IMMUTABILITY DATABASE REGRESSION TEST SUITE
-- Verifies direct SQL cannot change an existing role, including as postgres.
-- Usage: docker exec -i lims-postgres psql -U postgres -d postgres < tests/user-role-immutability.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;

BEGIN;

CREATE TEMP TABLE user_role_immutability_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_role_immutability_test_results TO authenticated;

DO $$
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('71111111-1111-1111-1111-111111111111', 'role-test-manager@lims.local'),
        ('72222222-2222-2222-2222-222222222222', 'role-test-analyst@lims.local'),
        ('73333333-3333-3333-3333-333333333333', 'role-test-doctor@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, email, can_access_confidential, deleted_at)
    VALUES
        ('71111111-1111-1111-1111-111111111111', 'role_test_manager', 'Role Test Manager', 'manager', 'role-test-manager@lims.local', FALSE, NULL),
        ('72222222-2222-2222-2222-222222222222', 'role_test_analyst', 'Role Test Analyst', 'analyst', 'role-test-analyst@lims.local', FALSE, NULL),
        ('73333333-3333-3333-3333-333333333333', 'role_test_doctor', 'Role Test Doctor', 'doctor', 'role-test-doctor@lims.local', FALSE, NULL)
    ON CONFLICT (id) DO NOTHING;
END $$;

DO $$
DECLARE
    v_before_audits INTEGER;
    v_after_audits INTEGER;
    v_role public.user_role;
    v_blocked BOOLEAN := FALSE;
BEGIN
    SELECT count(*)
    INTO v_before_audits
    FROM public.audit_logs
    WHERE table_name = 'users'
      AND record_id = '72222222-2222-2222-2222-222222222222'
      AND operation = 'UPDATE';

    BEGIN
        UPDATE public.users
        SET role = 'manager'
        WHERE id = '72222222-2222-2222-2222-222222222222';
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'Role promotion was permitted';
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_blocked := TRUE;
        WHEN SQLSTATE 'P0001' THEN
            NULL;
    END;

    SELECT role
    INTO v_role
    FROM public.users
    WHERE id = '72222222-2222-2222-2222-222222222222';

    SELECT count(*)
    INTO v_after_audits
    FROM public.audit_logs
    WHERE table_name = 'users'
      AND record_id = '72222222-2222-2222-2222-222222222222'
      AND operation = 'UPDATE';

    INSERT INTO user_role_immutability_test_results (test_name, passed, detail)
    VALUES (
        'postgres_cannot_promote_analyst',
        v_blocked AND v_role = 'analyst' AND v_after_audits = v_before_audits,
        format('blocked=%s, role=%s, audits_before=%s, audits_after=%s', v_blocked, v_role, v_before_audits, v_after_audits)
    );
END $$;

DO $$
DECLARE
    v_before_audits INTEGER;
    v_after_audits INTEGER;
    v_role public.user_role;
    v_blocked BOOLEAN := FALSE;
BEGIN
    SELECT count(*)
    INTO v_before_audits
    FROM public.audit_logs
    WHERE table_name = 'users'
      AND record_id = '71111111-1111-1111-1111-111111111111'
      AND operation = 'UPDATE';

    BEGIN
        UPDATE public.users
        SET role = 'analyst'
        WHERE id = '71111111-1111-1111-1111-111111111111';
        RAISE EXCEPTION USING
            ERRCODE = 'P0001',
            MESSAGE = 'Role demotion was permitted';
    EXCEPTION
        WHEN SQLSTATE '42501' THEN
            v_blocked := TRUE;
        WHEN SQLSTATE 'P0001' THEN
            NULL;
    END;

    SELECT role
    INTO v_role
    FROM public.users
    WHERE id = '71111111-1111-1111-1111-111111111111';

    SELECT count(*)
    INTO v_after_audits
    FROM public.audit_logs
    WHERE table_name = 'users'
      AND record_id = '71111111-1111-1111-1111-111111111111'
      AND operation = 'UPDATE';

    INSERT INTO user_role_immutability_test_results (test_name, passed, detail)
    VALUES (
        'postgres_cannot_demote_manager',
        v_blocked AND v_role = 'manager' AND v_after_audits = v_before_audits,
        format('blocked=%s, role=%s, audits_before=%s, audits_after=%s', v_blocked, v_role, v_before_audits, v_after_audits)
    );
END $$;

SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"71111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_enabled BOOLEAN;
    v_disabled BOOLEAN;
BEGIN
    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = '72222222-2222-2222-2222-222222222222';

    SELECT can_access_confidential
    INTO v_enabled
    FROM public.users
    WHERE id = '72222222-2222-2222-2222-222222222222';

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = '72222222-2222-2222-2222-222222222222';

    SELECT NOT can_access_confidential
    INTO v_disabled
    FROM public.users
    WHERE id = '72222222-2222-2222-2222-222222222222';

    INSERT INTO user_role_immutability_test_results (test_name, passed, detail)
    VALUES (
        'manager_can_toggle_analyst_confidential_access',
        v_enabled AND v_disabled,
        format('enabled=%s, disabled=%s', v_enabled, v_disabled)
    );
END $$;

DO $$
DECLARE
    v_blocked BOOLEAN := FALSE;
    v_confidential_access BOOLEAN;
BEGIN
    BEGIN
        UPDATE public.users
        SET can_access_confidential = TRUE
        WHERE id = '73333333-3333-3333-3333-333333333333';
    EXCEPTION
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_blocked := TRUE;
            ELSE
                RAISE;
            END IF;
    END;

    SELECT can_access_confidential
    INTO v_confidential_access
    FROM public.users
    WHERE id = '73333333-3333-3333-3333-333333333333';

    INSERT INTO user_role_immutability_test_results (test_name, passed, detail)
    VALUES (
        'manager_cannot_toggle_doctor_confidential_access',
        v_blocked AND NOT v_confidential_access,
        format('blocked=%s, confidential_access=%s', v_blocked, v_confidential_access)
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;

TABLE user_role_immutability_test_results;

DO $$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(test_name || ': ' || detail, E'\n')
    INTO v_failures
    FROM user_role_immutability_test_results
    WHERE NOT passed;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION 'User role immutability regression test failures:%', E'\n' || v_failures;
    END IF;
END $$;

ROLLBACK;
