-- MANAGER USER PERMISSIONS RLS/TRIGGER REGRESSION TEST SUITE
-- Verifies the current analyst-only confidential-access management contract.
-- Usage: docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/manager-user-permissions-rls.test.sql

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
GRANT SELECT, INSERT, UPDATE, DELETE
ON manager_user_permissions_test_results
TO authenticated, service_role;

DO $$
DECLARE
    v_fixture_ids UUID[] := ARRAY[
        '90000090-0090-4090-8090-000000000001'::UUID,
        '90000090-0090-4090-8090-000000000002'::UUID,
        '90000090-0090-4090-8090-000000000003'::UUID,
        '90000090-0090-4090-8090-000000000004'::UUID
    ];
BEGIN
    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = ANY(v_fixture_ids)
           OR email LIKE 'issue-90-manager-user-%@lims.local'
    ) OR EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = ANY(v_fixture_ids)
           OR username LIKE 'issue90_manager_user_%'
           OR email LIKE 'issue-90-manager-user-%@lims.local'
    ) THEN
        RAISE EXCEPTION
            'Issue #90 manager-user fixture collision; suite-owned identities must be unused';
    END IF;

    INSERT INTO auth.users (id, email)
    VALUES
        (
            '90000090-0090-4090-8090-000000000001',
            'issue-90-manager-user-caller@lims.local'
        ),
        (
            '90000090-0090-4090-8090-000000000002',
            'issue-90-manager-user-other-manager@lims.local'
        ),
        (
            '90000090-0090-4090-8090-000000000003',
            'issue-90-manager-user-doctor@lims.local'
        ),
        (
            '90000090-0090-4090-8090-000000000004',
            'issue-90-manager-user-analyst@lims.local'
        );

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
            '90000090-0090-4090-8090-000000000001',
            'issue90_manager_user_caller',
            'Issue 90 Manager User Caller',
            'manager',
            'issue-90-manager-user-caller@lims.local',
            FALSE,
            NULL
        ),
        (
            '90000090-0090-4090-8090-000000000002',
            'issue90_manager_user_other_manager',
            'Issue 90 Manager User Other Manager',
            'manager',
            'issue-90-manager-user-other-manager@lims.local',
            FALSE,
            NULL
        ),
        (
            '90000090-0090-4090-8090-000000000003',
            'issue90_manager_user_doctor',
            'Issue 90 Manager User Doctor',
            'doctor',
            'issue-90-manager-user-doctor@lims.local',
            FALSE,
            NULL
        ),
        (
            '90000090-0090-4090-8090-000000000004',
            'issue90_manager_user_analyst',
            'Issue 90 Manager User Analyst',
            'analyst',
            'issue-90-manager-user-analyst@lims.local',
            FALSE,
            NULL
        );
END $$;

\echo 'Test 1: Authenticated manager cannot update another manager profile'
SET ROLE authenticated;
SET request.jwt.claims TO
    '{"sub":"90000090-0090-4090-8090-000000000001","role":"authenticated"}';

DO $$
DECLARE
    v_update_blocked BOOLEAN := FALSE;
    v_target_name TEXT;
BEGIN
    BEGIN
        UPDATE public.users
        SET full_name = 'Issue 90 Other Manager Mutated'
        WHERE id = '90000090-0090-4090-8090-000000000002';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_update_blocked := TRUE;
    END;

    SELECT full_name
    INTO v_target_name
    FROM public.users
    WHERE id = '90000090-0090-4090-8090-000000000002';

    INSERT INTO manager_user_permissions_test_results
        (test_name, passed, detail)
    VALUES (
        'manager_update_other_manager',
        v_update_blocked
            AND v_target_name = 'Issue 90 Manager User Other Manager',
        format(
            'blocked=%s, target_name=%s',
            v_update_blocked,
            coalesce(v_target_name, '<missing>')
        )
    );
END $$;

\echo 'Test 2: Authenticated manager cannot delete another manager row'
DO $$
DECLARE
    v_delete_blocked BOOLEAN := FALSE;
    v_deleted_count INTEGER := 0;
    v_target_exists BOOLEAN;
BEGIN
    BEGIN
        DELETE FROM public.users
        WHERE id = '90000090-0090-4090-8090-000000000002';
        GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
        v_delete_blocked := v_deleted_count = 0;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_delete_blocked := TRUE;
    END;

    SELECT EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = '90000090-0090-4090-8090-000000000002'
          AND role = 'manager'
    )
    INTO v_target_exists;

    INSERT INTO manager_user_permissions_test_results
        (test_name, passed, detail)
    VALUES (
        'manager_delete_other_manager',
        v_delete_blocked AND v_target_exists,
        format(
            'blocked=%s, deleted_count=%s, target_exists=%s',
            v_delete_blocked,
            v_deleted_count,
            v_target_exists
        )
    );
END $$;

\echo 'Test 3: Authenticated manager can grant and revoke an active analyst'
DO $$
DECLARE
    v_granted_count INTEGER;
    v_revoked_count INTEGER;
    v_after_grant BOOLEAN;
    v_after_revoke BOOLEAN;
BEGIN
    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = '90000090-0090-4090-8090-000000000004';
    GET DIAGNOSTICS v_granted_count = ROW_COUNT;

    SELECT can_access_confidential
    INTO v_after_grant
    FROM public.users
    WHERE id = '90000090-0090-4090-8090-000000000004';

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = '90000090-0090-4090-8090-000000000004';
    GET DIAGNOSTICS v_revoked_count = ROW_COUNT;

    SELECT can_access_confidential
    INTO v_after_revoke
    FROM public.users
    WHERE id = '90000090-0090-4090-8090-000000000004';

    INSERT INTO manager_user_permissions_test_results
        (test_name, passed, detail)
    VALUES
        (
            'manager_grant_active_analyst_confidential_access',
            v_granted_count = 1 AND v_after_grant IS TRUE,
            format(
                'updated_count=%s, after_grant=%s',
                v_granted_count,
                v_after_grant
            )
        ),
        (
            'manager_revoke_active_analyst_confidential_access',
            v_revoked_count = 1 AND v_after_revoke IS FALSE,
            format(
                'updated_count=%s, after_revoke=%s',
                v_revoked_count,
                v_after_revoke
            )
        );
END $$;

\echo 'Test 4: Authenticated manager cannot toggle manager or doctor access'
DO $$
DECLARE
    v_manager_blocked BOOLEAN := FALSE;
    v_doctor_blocked BOOLEAN := FALSE;
    v_manager_confidential BOOLEAN;
    v_doctor_confidential BOOLEAN;
BEGIN
    BEGIN
        UPDATE public.users
        SET can_access_confidential = TRUE
        WHERE id = '90000090-0090-4090-8090-000000000002';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_manager_blocked := TRUE;
    END;

    BEGIN
        UPDATE public.users
        SET can_access_confidential = TRUE
        WHERE id = '90000090-0090-4090-8090-000000000003';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_doctor_blocked := TRUE;
    END;

    SELECT can_access_confidential
    INTO v_manager_confidential
    FROM public.users
    WHERE id = '90000090-0090-4090-8090-000000000002';

    SELECT can_access_confidential
    INTO v_doctor_confidential
    FROM public.users
    WHERE id = '90000090-0090-4090-8090-000000000003';

    INSERT INTO manager_user_permissions_test_results
        (test_name, passed, detail)
    VALUES
        (
            'manager_cannot_toggle_manager_confidential_access',
            v_manager_blocked AND v_manager_confidential IS FALSE,
            format(
                'blocked=%s, target_confidential=%s',
                v_manager_blocked,
                v_manager_confidential
            )
        ),
        (
            'manager_cannot_toggle_doctor_confidential_access',
            v_doctor_blocked AND v_doctor_confidential IS FALSE,
            format(
                'blocked=%s, target_confidential=%s',
                v_doctor_blocked,
                v_doctor_confidential
            )
        );
END $$;

RESET ROLE;

\echo 'Test 5: Trusted service_role performs a real confidential-access transition'
SET ROLE service_role;

DO $$
DECLARE
    v_updated_count INTEGER;
    v_target_confidential BOOLEAN;
BEGIN
    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = '90000090-0090-4090-8090-000000000004';
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    SELECT can_access_confidential
    INTO v_target_confidential
    FROM public.users
    WHERE id = '90000090-0090-4090-8090-000000000004';

    INSERT INTO manager_user_permissions_test_results
        (test_name, passed, detail)
    VALUES (
        'service_role_transitions_confidential_access',
        v_updated_count = 1 AND v_target_confidential IS TRUE,
        format(
            'updated_count=%s, target_confidential=%s',
            v_updated_count,
            v_target_confidential
        )
    );
END $$;

RESET ROLE;

INSERT INTO manager_user_permissions_test_results
    (test_name, passed, detail)
SELECT
    'manager_user_security_helper',
    public.test_manager_user_write_boundary_guard(),
    'test_manager_user_write_boundary_guard() must return true';

\echo ''
\echo 'Results:'
TABLE manager_user_permissions_test_results ORDER BY test_name;

DO $$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(
        format('- %s: %s', test_name, detail),
        E'\n'
        ORDER BY test_name
    )
    INTO v_failures
    FROM manager_user_permissions_test_results
    WHERE NOT passed;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION
            'manager-user-permissions-rls.test.sql failed:%',
            E'\n' || v_failures;
    END IF;
END $$;

ROLLBACK;

\echo ''
\echo 'MANAGER USER PERMISSIONS RLS/TRIGGER TESTS PASSED'
