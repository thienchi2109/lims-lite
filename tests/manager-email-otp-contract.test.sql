-- ============================================================================
-- MANAGER EMAIL OTP CONTRACT TEST SUITE
-- ============================================================================
-- Verifies grants, exact RLS behavior, secret handling, RPC exposure, and the
-- registered security helpers for manager-managed analyst OTP settings.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/manager-email-otp-contract.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE manager_otp_contract_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;
GRANT SELECT, INSERT, UPDATE, DELETE
ON manager_otp_contract_results
TO authenticated, service_role;

DO $$
DECLARE
    v_settings_policies TEXT;
    v_authenticated_settings_definer_mutators TEXT[];
    v_create_rpc REGPROCEDURE;
    v_verify_rpc REGPROCEDURE;
BEGIN
    IF to_regclass('public.manager_otp_settings') IS NULL
       OR to_regclass('public.manager_otp_challenges') IS NULL THEN
        RAISE EXCEPTION
            'manager OTP tables must exist before contract assertions run';
    END IF;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'manager_otp_settings required columns and no OTP secrets',
        NOT EXISTS (
            SELECT required.column_name
            FROM unnest(ARRAY[
                'user_id',
                'otp_email',
                'configured_at',
                'updated_at'
            ]) AS required(column_name)
            WHERE NOT EXISTS (
                SELECT 1
                FROM information_schema.columns AS column_info
                WHERE column_info.table_schema = 'public'
                  AND column_info.table_name = 'manager_otp_settings'
                  AND column_info.column_name = required.column_name
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'manager_otp_settings'
              AND column_name IN (
                  'secret',
                  'otp_secret',
                  'code',
                  'otp_code',
                  'code_hash',
                  'token'
              )
        ),
        'settings store OTP destination metadata only'
    );

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'manager_otp_settings exact table privileges',
        has_table_privilege(
            'authenticated',
            'public.manager_otp_settings',
            'SELECT'
        )
        AND has_table_privilege(
            'authenticated',
            'public.manager_otp_settings',
            'INSERT'
        )
        AND has_table_privilege(
            'authenticated',
            'public.manager_otp_settings',
            'UPDATE'
        )
        AND NOT has_table_privilege(
            'authenticated',
            'public.manager_otp_settings',
            'DELETE'
        )
        AND NOT has_table_privilege(
            'anon',
            'public.manager_otp_settings',
            'SELECT, INSERT, UPDATE, DELETE'
        )
        AND has_table_privilege(
            'service_role',
            'public.manager_otp_settings',
            'SELECT, INSERT, UPDATE, DELETE'
        ),
        'authenticated=SELECT/INSERT/UPDATE, anon=none, service_role=CRUD'
    );

    SELECT string_agg(
        format('%s:%s:%s', policyname, cmd, roles::TEXT),
        ', '
        ORDER BY policyname
    )
    INTO v_settings_policies
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_otp_settings';

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    SELECT
        'manager_otp_settings exact authenticated policies',
        count(*) = 3
            AND count(*) FILTER (WHERE cmd = 'SELECT') = 1
            AND count(*) FILTER (WHERE cmd = 'INSERT') = 1
            AND count(*) FILTER (WHERE cmd = 'UPDATE') = 1
            AND count(*) FILTER (WHERE cmd IN ('DELETE', 'ALL')) = 0
            AND bool_and(roles = ARRAY['authenticated']::NAME[]),
        coalesce(v_settings_policies, '<none>')
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'manager_otp_settings';

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'manager_otp_challenges hash-only and inaccessible to app roles',
        NOT EXISTS (
            SELECT required.column_name
            FROM unnest(ARRAY[
                'id',
                'user_id',
                'session_id',
                'code_hash',
                'expires_at',
                'used_at',
                'locked_at',
                'attempt_count',
                'resend_available_at',
                'created_at'
            ]) AS required(column_name)
            WHERE NOT EXISTS (
                SELECT 1
                FROM information_schema.columns AS column_info
                WHERE column_info.table_schema = 'public'
                  AND column_info.table_name = 'manager_otp_challenges'
                  AND column_info.column_name = required.column_name
            )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'manager_otp_challenges'
              AND column_name IN (
                  'code',
                  'plain_code',
                  'otp',
                  'otp_code',
                  'token'
              )
        )
        AND NOT has_table_privilege(
            'anon',
            'public.manager_otp_challenges',
            'SELECT, INSERT, UPDATE, DELETE'
        )
        AND NOT has_table_privilege(
            'authenticated',
            'public.manager_otp_challenges',
            'SELECT, INSERT, UPDATE, DELETE'
        )
        AND has_table_privilege(
            'service_role',
            'public.manager_otp_challenges',
            'SELECT, INSERT, UPDATE, DELETE'
        ),
        'challenge codes are hash-only and direct rows remain trusted-service-only'
    );

    SELECT ARRAY(
        SELECT p.oid::REGPROCEDURE::TEXT
        FROM pg_proc AS p
        JOIN pg_namespace AS n
          ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.prokind = 'f'
          AND p.prosecdef
          AND has_function_privilege('authenticated', p.oid, 'EXECUTE')
          AND pg_get_functiondef(p.oid) ILIKE '%manager_otp_settings%'
          AND (
              pg_get_functiondef(p.oid)
                  ~* '\yINSERT\s+INTO\s+(public\.)?manager_otp_settings\y'
              OR pg_get_functiondef(p.oid)
                  ~* '\yUPDATE\s+(public\.)?manager_otp_settings\y'
              OR pg_get_functiondef(p.oid)
                  ~* '\yDELETE\s+FROM\s+(public\.)?manager_otp_settings\y'
          )
        ORDER BY p.oid::REGPROCEDURE::TEXT
    )
    INTO v_authenticated_settings_definer_mutators;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'no authenticated SECURITY DEFINER OTP settings mutator',
        coalesce(
            array_length(v_authenticated_settings_definer_mutators, 1),
            0
        ) = 0,
        CASE
            WHEN coalesce(
                array_length(v_authenticated_settings_definer_mutators, 1),
                0
            ) = 0
                THEN 'authenticated writes rely on RLS, not a definer bypass'
            ELSE format(
                'forbidden mutators: %s',
                array_to_string(
                    v_authenticated_settings_definer_mutators,
                    ', '
                )
            )
        END
    );

    v_create_rpc := to_regprocedure(
        'public.create_manager_otp_challenge(uuid,uuid,text,text,timestamp with time zone,timestamp with time zone)'
    );
    v_verify_rpc := to_regprocedure(
        'public.verify_manager_otp_challenge(uuid,text,uuid,text)'
    );

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES
        (
            'current OTP create RPC grants',
            v_create_rpc IS NOT NULL
                AND NOT coalesce(
                    has_function_privilege('anon', v_create_rpc, 'EXECUTE'),
                    FALSE
                )
                AND NOT coalesce(
                    has_function_privilege(
                        'authenticated',
                        v_create_rpc,
                        'EXECUTE'
                    ),
                    FALSE
                )
                AND coalesce(
                    has_function_privilege(
                        'service_role',
                        v_create_rpc,
                        'EXECUTE'
                    ),
                    FALSE
                ),
            'create RPC is executable only by service_role'
        ),
        (
            'current OTP verify RPC grants',
            v_verify_rpc IS NOT NULL
                AND NOT coalesce(
                    has_function_privilege('anon', v_verify_rpc, 'EXECUTE'),
                    FALSE
                )
                AND coalesce(
                    has_function_privilege(
                        'authenticated',
                        v_verify_rpc,
                        'EXECUTE'
                    ),
                    FALSE
                )
                AND coalesce(
                    has_function_privilege(
                        'service_role',
                        v_verify_rpc,
                        'EXECUTE'
                    ),
                    FALSE
                ),
            'verify RPC is executable by authenticated and service_role'
        ),
        (
            'legacy two-argument OTP verification RPC absent',
            to_regprocedure(
                'public.verify_manager_otp_challenge(uuid,text)'
            ) IS NULL,
            'legacy verification signature must remain removed'
        );
END $$;

DO $$
DECLARE
    v_fixture_ids UUID[] := ARRAY[
        '90000090-0090-4091-8091-000000000001'::UUID,
        '90000090-0090-4091-8091-000000000002'::UUID,
        '90000090-0090-4091-8091-000000000003'::UUID,
        '90000090-0090-4091-8091-000000000004'::UUID,
        '90000090-0090-4091-8091-000000000005'::UUID
    ];
BEGIN
    IF EXISTS (
        SELECT 1
        FROM auth.users
        WHERE id = ANY(v_fixture_ids)
           OR email LIKE 'issue-90-manager-otp-%@lims.local'
    ) OR EXISTS (
        SELECT 1
        FROM public.users
        WHERE id = ANY(v_fixture_ids)
           OR username LIKE 'issue90_manager_otp_%'
           OR email LIKE 'issue-90-manager-otp-%@lims.local'
    ) OR EXISTS (
        SELECT 1
        FROM public.manager_otp_challenges
        WHERE id = '90000090-0090-4091-8091-000000000006'
           OR session_id = 'issue-90-manager-otp-secret-session'
    ) THEN
        RAISE EXCEPTION
            'Issue #90 manager-OTP fixture collision; suite-owned identities must be unused';
    END IF;

    INSERT INTO auth.users (id, email)
    VALUES
        (
            '90000090-0090-4091-8091-000000000001',
            'issue-90-manager-otp-caller@lims.local'
        ),
        (
            '90000090-0090-4091-8091-000000000002',
            'issue-90-manager-otp-other-manager@lims.local'
        ),
        (
            '90000090-0090-4091-8091-000000000003',
            'issue-90-manager-otp-doctor@lims.local'
        ),
        (
            '90000090-0090-4091-8091-000000000004',
            'issue-90-manager-otp-active-analyst@lims.local'
        ),
        (
            '90000090-0090-4091-8091-000000000005',
            'issue-90-manager-otp-deleted-analyst@lims.local'
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
            '90000090-0090-4091-8091-000000000001',
            'issue90_manager_otp_caller',
            'Issue 90 Manager OTP Caller',
            'manager',
            'issue-90-manager-otp-caller@lims.local',
            FALSE,
            NULL
        ),
        (
            '90000090-0090-4091-8091-000000000002',
            'issue90_manager_otp_other_manager',
            'Issue 90 Manager OTP Other Manager',
            'manager',
            'issue-90-manager-otp-other-manager@lims.local',
            FALSE,
            NULL
        ),
        (
            '90000090-0090-4091-8091-000000000003',
            'issue90_manager_otp_doctor',
            'Issue 90 Manager OTP Doctor',
            'doctor',
            'issue-90-manager-otp-doctor@lims.local',
            FALSE,
            NULL
        ),
        (
            '90000090-0090-4091-8091-000000000004',
            'issue90_manager_otp_active_analyst',
            'Issue 90 Manager OTP Active Analyst',
            'analyst',
            'issue-90-manager-otp-active-analyst@lims.local',
            TRUE,
            NULL
        ),
        (
            '90000090-0090-4091-8091-000000000005',
            'issue90_manager_otp_deleted_analyst',
            'Issue 90 Manager OTP Deleted Analyst',
            'analyst',
            'issue-90-manager-otp-deleted-analyst@lims.local',
            TRUE,
            clock_timestamp()
        );
END $$;

SET ROLE authenticated;
SET request.jwt.claims TO
    '{"sub":"90000090-0090-4091-8091-000000000001","role":"authenticated"}';

DO $$
DECLARE
    v_active_email TEXT;
    v_manager_insert_blocked BOOLEAN := FALSE;
    v_doctor_insert_blocked BOOLEAN := FALSE;
    v_deleted_insert_blocked BOOLEAN := FALSE;
BEGIN
    INSERT INTO public.manager_otp_settings (user_id, otp_email)
    VALUES (
        '90000090-0090-4091-8091-000000000004',
        'issue-90-manager-otp-active-v1@lims.local'
    );

    UPDATE public.manager_otp_settings
    SET otp_email = 'issue-90-manager-otp-active-v2@lims.local'
    WHERE user_id = '90000090-0090-4091-8091-000000000004';

    SELECT otp_email
    INTO v_active_email
    FROM public.manager_otp_settings
    WHERE user_id = '90000090-0090-4091-8091-000000000004';

    BEGIN
        INSERT INTO public.manager_otp_settings (user_id, otp_email)
        VALUES (
            '90000090-0090-4091-8091-000000000002',
            'issue-90-manager-otp-manager-target@lims.local'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_manager_insert_blocked := TRUE;
    END;

    BEGIN
        INSERT INTO public.manager_otp_settings (user_id, otp_email)
        VALUES (
            '90000090-0090-4091-8091-000000000003',
            'issue-90-manager-otp-doctor-target@lims.local'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_doctor_insert_blocked := TRUE;
    END;

    BEGIN
        INSERT INTO public.manager_otp_settings (user_id, otp_email)
        VALUES (
            '90000090-0090-4091-8091-000000000005',
            'issue-90-manager-otp-deleted-target@lims.local'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_deleted_insert_blocked := TRUE;
    END;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES
        (
            'manager writes active analyst OTP settings',
            v_active_email = 'issue-90-manager-otp-active-v2@lims.local',
            format('active_analyst_email=%s', coalesce(v_active_email, '<missing>'))
        ),
        (
            'manager inserts only active analyst OTP settings',
            v_manager_insert_blocked
                AND v_doctor_insert_blocked
                AND v_deleted_insert_blocked,
            format(
                'manager=%s, doctor=%s, deleted_analyst=%s',
                v_manager_insert_blocked,
                v_doctor_insert_blocked,
                v_deleted_insert_blocked
            )
        );
END $$;

RESET ROLE;

-- Remove any unexpectedly permitted denied-target inserts before update tests.
DELETE FROM public.manager_otp_settings
WHERE user_id IN (
    '90000090-0090-4091-8091-000000000002',
    '90000090-0090-4091-8091-000000000003',
    '90000090-0090-4091-8091-000000000005'
);

SET request.jwt.claims TO '{"role":"service_role"}';
SET ROLE service_role;

INSERT INTO public.manager_otp_settings (user_id, otp_email)
VALUES
    (
        '90000090-0090-4091-8091-000000000002',
        'issue-90-manager-otp-manager-seed@lims.local'
    ),
    (
        '90000090-0090-4091-8091-000000000003',
        'issue-90-manager-otp-doctor-seed@lims.local'
    ),
    (
        '90000090-0090-4091-8091-000000000005',
        'issue-90-manager-otp-deleted-seed@lims.local'
    );

RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims TO
    '{"sub":"90000090-0090-4091-8091-000000000001","role":"authenticated"}';

DO $$
DECLARE
    v_manager_update_blocked BOOLEAN := FALSE;
    v_doctor_update_blocked BOOLEAN := FALSE;
    v_deleted_update_blocked BOOLEAN := FALSE;
    v_row_count INTEGER;
BEGIN
    BEGIN
        UPDATE public.manager_otp_settings
        SET otp_email = 'issue-90-manager-otp-manager-mutated@lims.local'
        WHERE user_id = '90000090-0090-4091-8091-000000000002';
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        v_manager_update_blocked := v_row_count = 0;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_manager_update_blocked := TRUE;
    END;

    BEGIN
        UPDATE public.manager_otp_settings
        SET otp_email = 'issue-90-manager-otp-doctor-mutated@lims.local'
        WHERE user_id = '90000090-0090-4091-8091-000000000003';
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        v_doctor_update_blocked := v_row_count = 0;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_doctor_update_blocked := TRUE;
    END;

    BEGIN
        UPDATE public.manager_otp_settings
        SET otp_email = 'issue-90-manager-otp-deleted-mutated@lims.local'
        WHERE user_id = '90000090-0090-4091-8091-000000000005';
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        v_deleted_update_blocked := v_row_count = 0;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_deleted_update_blocked := TRUE;
    END;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'manager updates only active analyst OTP settings',
        v_manager_update_blocked
            AND v_doctor_update_blocked
            AND v_deleted_update_blocked,
        format(
            'manager=%s, doctor=%s, deleted_analyst=%s',
            v_manager_update_blocked,
            v_doctor_update_blocked,
            v_deleted_update_blocked
        )
    );
END $$;

RESET ROLE;

INSERT INTO manager_otp_contract_results
    (test_name, passed, detail)
SELECT
    'denied manager OTP targets remain unchanged',
    bool_and(
        otp_email IN (
            'issue-90-manager-otp-manager-seed@lims.local',
            'issue-90-manager-otp-doctor-seed@lims.local',
            'issue-90-manager-otp-deleted-seed@lims.local'
        )
    ),
    string_agg(otp_email, ', ' ORDER BY user_id)
FROM public.manager_otp_settings
WHERE user_id IN (
    '90000090-0090-4091-8091-000000000002',
    '90000090-0090-4091-8091-000000000003',
    '90000090-0090-4091-8091-000000000005'
);

SET ROLE authenticated;
SET request.jwt.claims TO
    '{"sub":"90000090-0090-4091-8091-000000000004","role":"authenticated"}';

DO $$
DECLARE
    v_visible_count INTEGER;
    v_visible_email TEXT;
    v_update_blocked BOOLEAN := FALSE;
    v_delete_blocked BOOLEAN := FALSE;
    v_row_count INTEGER;
BEGIN
    SELECT count(*), max(otp_email)
    INTO v_visible_count, v_visible_email
    FROM public.manager_otp_settings;

    BEGIN
        UPDATE public.manager_otp_settings
        SET otp_email = 'issue-90-manager-otp-analyst-mutated@lims.local'
        WHERE user_id = '90000090-0090-4091-8091-000000000004';
        GET DIAGNOSTICS v_row_count = ROW_COUNT;
        v_update_blocked := v_row_count = 0;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_update_blocked := TRUE;
    END;

    BEGIN
        DELETE FROM public.manager_otp_settings
        WHERE user_id = '90000090-0090-4091-8091-000000000004';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_delete_blocked := TRUE;
    END;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES
        (
            'confidential analyst reads only own OTP setting',
            v_visible_count = 1
                AND v_visible_email =
                    'issue-90-manager-otp-active-v2@lims.local',
            format(
                'visible_count=%s, visible_email=%s',
                v_visible_count,
                coalesce(v_visible_email, '<missing>')
            )
        ),
        (
            'confidential analyst cannot update or delete own OTP setting',
            v_update_blocked AND v_delete_blocked,
            format(
                'update_blocked=%s, delete_blocked=%s',
                v_update_blocked,
                v_delete_blocked
            )
        );
END $$;

RESET ROLE;
SET request.jwt.claims TO '{"role":"service_role"}';
SET ROLE service_role;

DELETE FROM public.manager_otp_settings
WHERE user_id = '90000090-0090-4091-8091-000000000004';

RESET ROLE;
SET ROLE authenticated;
SET request.jwt.claims TO
    '{"sub":"90000090-0090-4091-8091-000000000004","role":"authenticated"}';

DO $$
DECLARE
    v_insert_blocked BOOLEAN := FALSE;
BEGIN
    BEGIN
        INSERT INTO public.manager_otp_settings (user_id, otp_email)
        VALUES (
            '90000090-0090-4091-8091-000000000004',
            'issue-90-manager-otp-analyst-insert@lims.local'
        );
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_insert_blocked := TRUE;
    END;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'confidential analyst cannot insert own OTP setting',
        v_insert_blocked,
        format('insert_blocked=%s', v_insert_blocked)
    );
END $$;

RESET ROLE;
SET request.jwt.claims TO '{"role":"service_role"}';
SET ROLE service_role;

DO $$
DECLARE
    v_selected_email TEXT;
    v_updated_count INTEGER;
    v_deleted_count INTEGER;
    v_create_result JSONB;
    v_code_hash TEXT := encode(digest('654321', 'sha256'), 'hex');
    v_session_id TEXT := 'issue-90-manager-otp-secret-session';
BEGIN
    INSERT INTO public.manager_otp_settings (user_id, otp_email)
    VALUES (
        '90000090-0090-4091-8091-000000000004',
        'issue-90-manager-otp-service-create@lims.local'
    );

    SELECT otp_email
    INTO v_selected_email
    FROM public.manager_otp_settings
    WHERE user_id = '90000090-0090-4091-8091-000000000004';

    UPDATE public.manager_otp_settings
    SET otp_email = 'issue-90-manager-otp-service-update@lims.local'
    WHERE user_id = '90000090-0090-4091-8091-000000000004';
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;

    DELETE FROM public.manager_otp_settings
    WHERE user_id = '90000090-0090-4091-8091-000000000004';
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'service_role performs trusted OTP settings CRUD',
        v_selected_email =
            'issue-90-manager-otp-service-create@lims.local'
            AND v_updated_count = 1
            AND v_deleted_count = 1
            AND NOT EXISTS (
                SELECT 1
                FROM public.manager_otp_settings
                WHERE user_id =
                    '90000090-0090-4091-8091-000000000004'
            ),
        format(
            'selected=%s, updated=%s, deleted=%s',
            coalesce(v_selected_email, '<missing>'),
            v_updated_count,
            v_deleted_count
        )
    );

    SELECT public.create_manager_otp_challenge(
        '90000090-0090-4091-8091-000000000006',
        '90000090-0090-4091-8091-000000000001',
        v_session_id,
        v_code_hash,
        now() + interval '5 minutes',
        now() - interval '1 minute'
    )
    INTO v_create_result;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES (
        'OTP challenge RPC response keeps code and session secret',
        v_create_result->>'ok' = 'true'
            AND v_create_result::TEXT NOT ILIKE '%' || v_session_id || '%'
            AND v_create_result::TEXT NOT ILIKE '%' || v_code_hash || '%'
            AND v_create_result::TEXT NOT ILIKE '%654321%',
        v_create_result::TEXT
    );
END $$;

RESET ROLE;

DO $$
DECLARE
    v_settings_audit_safe BOOLEAN;
    v_challenge_audit_safe BOOLEAN;
BEGIN
    SELECT
        EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'manager_otp_settings'
              AND record_id =
                  '90000090-0090-4091-8091-000000000004'
              AND (
                  coalesce(old_values, '{}'::JSONB) ? 'otp_email_hash'
                  OR coalesce(new_values, '{}'::JSONB) ? 'otp_email_hash'
              )
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'manager_otp_settings'
              AND record_id =
                  '90000090-0090-4091-8091-000000000004'
              AND (
                  coalesce(old_values::TEXT, '') ILIKE '%@lims.local%'
                  OR coalesce(new_values::TEXT, '') ILIKE '%@lims.local%'
              )
        )
    INTO v_settings_audit_safe;

    SELECT
        EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'manager_otp_challenges'
              AND record_id =
                  '90000090-0090-4091-8091-000000000006'
              AND coalesce(new_values, '{}'::JSONB) ? 'session_id_hash'
        )
        AND NOT EXISTS (
            SELECT 1
            FROM public.audit_logs
            WHERE table_name = 'manager_otp_challenges'
              AND record_id =
                  '90000090-0090-4091-8091-000000000006'
              AND (
                  coalesce(old_values::TEXT, '') ILIKE
                      '%issue-90-manager-otp-secret-session%'
                  OR coalesce(new_values::TEXT, '') ILIKE
                      '%issue-90-manager-otp-secret-session%'
                  OR coalesce(old_values::TEXT, '') ILIKE
                      '%' || encode(digest('654321', 'sha256'), 'hex') || '%'
                  OR coalesce(new_values::TEXT, '') ILIKE
                      '%' || encode(digest('654321', 'sha256'), 'hex') || '%'
                  OR coalesce(old_values::TEXT, '') ILIKE '%654321%'
                  OR coalesce(new_values::TEXT, '') ILIKE '%654321%'
              )
        )
    INTO v_challenge_audit_safe;

    INSERT INTO manager_otp_contract_results
        (test_name, passed, detail)
    VALUES
        (
            'OTP settings audit excludes raw email',
            v_settings_audit_safe,
            format('audit_safe=%s', v_settings_audit_safe)
        ),
        (
            'OTP challenge audit hashes session and excludes verifier material',
            v_challenge_audit_safe,
            format('audit_safe=%s', v_challenge_audit_safe)
        ),
        (
            'manager user write-boundary security helper',
            public.test_manager_user_write_boundary_guard(),
            'test_manager_user_write_boundary_guard() must return true'
        ),
        (
            'analyst OTP management security helper',
            public.test_analyst_otp_management_prerequisites(),
            'test_analyst_otp_management_prerequisites() must return true'
        ),
        (
            'OTP challenge lifecycle security helper',
            public.test_otp_challenge_lifecycle_audit(),
            'test_otp_challenge_lifecycle_audit() must return true'
        );
END $$;

\echo ''
\echo 'Results:'
TABLE manager_otp_contract_results ORDER BY test_name;

DO $$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(
        format('- %s: %s', test_name, detail),
        E'\n'
        ORDER BY test_name
    )
    INTO v_failed
    FROM manager_otp_contract_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION
            'manager-email-otp-contract.test.sql failed:%',
            E'\n' || v_failed;
    END IF;
END $$;

ROLLBACK;

\echo ''
\echo 'MANAGER EMAIL OTP CONTRACT TESTS PASSED'
