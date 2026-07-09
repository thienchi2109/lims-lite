-- MANAGER USER PERMISSIONS RLS/TRIGGER REGRESSION TEST SUITE
-- Verifies DB defense-in-depth for manager-originated public.users writes.
-- Usage: docker exec -i lims-postgres psql -U postgres -d postgres < tests/manager-user-permissions-rls.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;

\echo '============================================================================'
\echo 'MANAGER USER PERMISSIONS RLS/TRIGGER TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE manager_user_permissions_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE ON manager_user_permissions_test_results TO authenticated, service_role;

DO $$
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        ('61111111-1111-1111-1111-111111111111', 'manager-user-rls-caller@lims.local'),
        ('62222222-2222-2222-2222-222222222222', 'manager-user-rls-target-manager@lims.local'),
        ('63333333-3333-3333-3333-333333333333', 'manager-user-rls-target-analyst@lims.local'),
        ('64444444-4444-4444-4444-444444444444', 'manager-user-rls-inserted@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (id, username, full_name, role, email, can_access_confidential, deleted_at)
    VALUES
        ('61111111-1111-1111-1111-111111111111', 'manager_user_rls_caller', 'Manager User RLS Caller', 'manager', 'manager-user-rls-caller@lims.local', FALSE, NULL),
        ('62222222-2222-2222-2222-222222222222', 'manager_user_rls_target_manager', 'Manager User RLS Target Manager', 'manager', 'manager-user-rls-target-manager@lims.local', FALSE, NULL),
        ('63333333-3333-3333-3333-333333333333', 'manager_user_rls_target_analyst', 'Manager User RLS Target Analyst', 'analyst', 'manager-user-rls-target-analyst@lims.local', FALSE, NULL)
    ON CONFLICT (id) DO UPDATE
    SET
        username = EXCLUDED.username,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        email = EXCLUDED.email,
        can_access_confidential = EXCLUDED.can_access_confidential,
        deleted_at = NULL;
END $$;

\echo 'Test 1: Authenticated manager cannot update another manager profile'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_update_blocked BOOLEAN := FALSE;
    v_target_name TEXT;
BEGIN
    BEGIN
        UPDATE public.users
        SET full_name = 'Manager User RLS Target Manager Mutated'
        WHERE id = '62222222-2222-2222-2222-222222222222';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_update_blocked := TRUE;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_update_blocked := TRUE;
            ELSE
                RAISE;
            END IF;
    END;

    SELECT full_name
    INTO v_target_name
    FROM public.users
    WHERE id = '62222222-2222-2222-2222-222222222222';

    INSERT INTO manager_user_permissions_test_results (test_name, passed, detail)
    VALUES (
        'manager_update_other_manager',
        v_update_blocked AND v_target_name = 'Manager User RLS Target Manager',
        format('blocked=%s, target_name=%s', v_update_blocked, coalesce(v_target_name, '<missing>'))
    );
END $$;

RESET ROLE;

\echo 'Test 2: Authenticated manager cannot delete another manager row'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_deleted_count INTEGER;
    v_target_exists BOOLEAN;
BEGIN
    DELETE FROM public.users
    WHERE id = '62222222-2222-2222-2222-222222222222';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = '62222222-2222-2222-2222-222222222222'
          AND role = 'manager'
    )
    INTO v_target_exists;

    INSERT INTO manager_user_permissions_test_results (test_name, passed, detail)
    VALUES (
        'manager_delete_other_manager',
        v_deleted_count = 0 AND v_target_exists,
        format('deleted_count=%s, target_exists=%s', v_deleted_count, v_target_exists)
    );
END $$;

RESET ROLE;

\echo 'Test 3: Authenticated manager cannot toggle can_access_confidential'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_update_blocked BOOLEAN := FALSE;
    v_target_confidential BOOLEAN;
BEGIN
    BEGIN
        UPDATE public.users
        SET can_access_confidential = TRUE
        WHERE id = '63333333-3333-3333-3333-333333333333';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_update_blocked := TRUE;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_update_blocked := TRUE;
            ELSE
                RAISE;
            END IF;
    END;

    SELECT can_access_confidential
    INTO v_target_confidential
    FROM public.users
    WHERE id = '63333333-3333-3333-3333-333333333333';

    INSERT INTO manager_user_permissions_test_results (test_name, passed, detail)
    VALUES (
        'manager_toggle_confidential',
        v_update_blocked AND v_target_confidential = FALSE,
        format('blocked=%s, target_confidential=%s', v_update_blocked, v_target_confidential)
    );
END $$;

RESET ROLE;

\echo 'Test 4: Authenticated manager cannot insert confidential-enabled users'
SET ROLE authenticated;
SET request.jwt.claims TO '{"sub":"61111111-1111-1111-1111-111111111111","role":"authenticated"}';

DO $$
DECLARE
    v_insert_blocked BOOLEAN := FALSE;
    v_inserted_exists BOOLEAN;
BEGIN
    BEGIN
        INSERT INTO public.users (id, username, full_name, role, email, can_access_confidential)
        VALUES ('64444444-4444-4444-4444-444444444444', 'manager_user_rls_inserted', 'Manager User RLS Inserted', 'analyst', 'manager-user-rls-inserted@lims.local', TRUE);
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_insert_blocked := TRUE;
        WHEN OTHERS THEN
            IF SQLSTATE = '42501' THEN
                v_insert_blocked := TRUE;
            ELSE
                RAISE;
            END IF;
    END;

    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = '64444444-4444-4444-4444-444444444444'
    )
    INTO v_inserted_exists;

    INSERT INTO manager_user_permissions_test_results (test_name, passed, detail)
    VALUES (
        'manager_insert_confidential_user',
        v_insert_blocked AND NOT v_inserted_exists,
        format('blocked=%s, inserted_exists=%s', v_insert_blocked, v_inserted_exists)
    );
END $$;

RESET ROLE;

\echo 'Test 5: Trusted service_role can toggle can_access_confidential'
SET ROLE service_role;

DO $$
DECLARE
    v_update_succeeded BOOLEAN := TRUE;
    v_target_confidential BOOLEAN;
BEGIN
    BEGIN
        UPDATE public.users
        SET can_access_confidential = TRUE
        WHERE id = '63333333-3333-3333-3333-333333333333';
    EXCEPTION
        WHEN OTHERS THEN
            v_update_succeeded := FALSE;
    END;

    SELECT can_access_confidential
    INTO v_target_confidential
    FROM public.users
    WHERE id = '63333333-3333-3333-3333-333333333333';

    INSERT INTO manager_user_permissions_test_results (test_name, passed, detail)
    VALUES (
        'service_role_toggle_confidential',
        v_update_succeeded AND v_target_confidential = TRUE,
        format('update_succeeded=%s, target_confidential=%s', v_update_succeeded, v_target_confidential)
    );
END $$;

RESET ROLE;

\echo ''
\echo 'Results:'
TABLE manager_user_permissions_test_results ORDER BY test_name;

DO $$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(format('- %s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failures
    FROM manager_user_permissions_test_results
    WHERE NOT passed;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION 'manager-user-permissions-rls.test.sql failed:%', E'\n' || v_failures;
    END IF;
END $$;

ROLLBACK;

\echo ''
\echo '✓ MANAGER USER PERMISSIONS RLS/TRIGGER TESTS PASSED'
