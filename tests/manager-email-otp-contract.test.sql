-- ============================================================================
-- MANAGER EMAIL OTP CONTRACT TEST SUITE
-- ============================================================================
-- RED contracts for Issue #44 / add-manager-email-otp-step-up.
-- These tests intentionally fail until the manager OTP schema, RLS-safe helper
-- functions, and challenge lifecycle contracts are implemented.
--
-- MVP note: manager OTP destination email is configured directly by a DB admin
-- in the self-hosted Supabase Dashboard. App-authenticated users must not have
-- a self-service write path for that metadata in this phase.
--
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/manager-email-otp-contract.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;

BEGIN;

CREATE TEMP TABLE manager_otp_contract_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_plaintext_columns TEXT[];
    v_missing_columns TEXT[];
BEGIN
    IF to_regclass('public.manager_otp_settings') IS NULL THEN
        INSERT INTO manager_otp_contract_results
        VALUES ('manager_otp_settings table exists', FALSE, 'missing public.manager_otp_settings');
    ELSE
        SELECT array_agg(column_name ORDER BY column_name)
        INTO v_missing_columns
        FROM unnest(ARRAY[
            'user_id',
            'otp_email',
            'configured_at',
            'updated_at'
        ]) AS required(column_name)
        WHERE NOT EXISTS (
            SELECT 1
            FROM information_schema.columns c
            WHERE c.table_schema = 'public'
              AND c.table_name = 'manager_otp_settings'
              AND c.column_name = required.column_name
        );

        INSERT INTO manager_otp_contract_results
        VALUES (
            'manager_otp_settings required columns',
            coalesce(array_length(v_missing_columns, 1), 0) = 0,
            CASE
                WHEN coalesce(array_length(v_missing_columns, 1), 0) = 0 THEN 'dashboard-managed OTP email columns are present'
                ELSE format('missing columns: %s', array_to_string(v_missing_columns, ', '))
            END
        );

        INSERT INTO manager_otp_contract_results
        VALUES (
            'manager_otp_settings has no app self-service writes',
            NOT EXISTS (
                SELECT 1
                FROM pg_policies
                WHERE schemaname = 'public'
                  AND tablename = 'manager_otp_settings'
                  AND cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')
            )
            AND NOT has_table_privilege('authenticated', 'public.manager_otp_settings', 'INSERT')
            AND NOT has_table_privilege('authenticated', 'public.manager_otp_settings', 'UPDATE')
            AND NOT has_table_privilege('authenticated', 'public.manager_otp_settings', 'DELETE'),
            'authenticated role must not insert/update/delete dashboard-managed OTP email metadata'
        );
    END IF;

    IF to_regclass('public.manager_otp_challenges') IS NULL THEN
        INSERT INTO manager_otp_contract_results
        VALUES ('manager_otp_challenges table exists', FALSE, 'missing public.manager_otp_challenges');
        RETURN;
    END IF;

    SELECT array_agg(column_name ORDER BY column_name)
    INTO v_missing_columns
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
        FROM information_schema.columns c
        WHERE c.table_schema = 'public'
          AND c.table_name = 'manager_otp_challenges'
          AND c.column_name = required.column_name
    );

    IF coalesce(array_length(v_missing_columns, 1), 0) > 0 THEN
        INSERT INTO manager_otp_contract_results
        VALUES (
            'manager_otp_challenges required columns',
            FALSE,
            format('missing columns: %s', array_to_string(v_missing_columns, ', '))
        );
    ELSE
        INSERT INTO manager_otp_contract_results
        VALUES ('manager_otp_challenges required columns', TRUE, 'challenge lifecycle columns are present');
    END IF;

    SELECT array_agg(column_name ORDER BY column_name)
    INTO v_plaintext_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'manager_otp_challenges'
      AND column_name IN ('code', 'plain_code', 'otp', 'otp_code', 'token');

    INSERT INTO manager_otp_contract_results
    VALUES (
        'manager_otp_challenges stores hash only',
        coalesce(array_length(v_plaintext_columns, 1), 0) = 0,
        CASE
            WHEN coalesce(array_length(v_plaintext_columns, 1), 0) = 0 THEN 'no plaintext OTP columns found'
            ELSE format('plaintext OTP-like columns are forbidden: %s', array_to_string(v_plaintext_columns, ', '))
        END
    );
END $$;

DO $$
BEGIN
    IF to_regprocedure('public.verify_manager_otp_challenge(uuid,text)') IS NULL THEN
        INSERT INTO manager_otp_contract_results
        VALUES (
            'OTP verification RPC exists',
            FALSE,
            'missing public.verify_manager_otp_challenge(uuid, text)'
        );
    ELSE
        INSERT INTO manager_otp_contract_results
        VALUES ('OTP verification RPC exists', TRUE, 'RPC contract is present');
    END IF;
END $$;

DO $$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(format('%s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failed
    FROM manager_otp_contract_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION 'Manager OTP contract tests failed:%', E'\n' || v_failed;
    END IF;
END $$;

ROLLBACK;
