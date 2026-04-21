-- ANON CONFIDENTIAL HELPER RLS REGRESSION TEST
-- Verifies anonymous reads fail closed with zero visible rows instead of permission errors.
-- Usage: docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/anon-confidential-helper-rls.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'ANON CONFIDENTIAL HELPER RLS TEST'
\echo '============================================================================'
\echo ''

BEGIN;

SET LOCAL ROLE anon;
SET LOCAL request.jwt.claims TO '{"role":"anon"}';

CREATE TEMP TABLE anon_confidential_helper_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_results_visible_rows BIGINT;
    v_audit_logs_visible_rows BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO v_results_visible_rows
    FROM public.results;

    INSERT INTO anon_confidential_helper_test_results
    VALUES (
        'anon_results_query_fails_closed',
        v_results_visible_rows = 0,
        format('anon visible rows in results = %s', v_results_visible_rows)
    );

    SELECT COUNT(*)
    INTO v_audit_logs_visible_rows
    FROM public.audit_logs;

    INSERT INTO anon_confidential_helper_test_results
    VALUES (
        'anon_audit_logs_query_fails_closed',
        v_audit_logs_visible_rows = 0,
        format('anon visible rows in audit_logs = %s', v_audit_logs_visible_rows)
    );
END $$;

RESET ROLE;
RESET request.jwt.claims;

TABLE anon_confidential_helper_test_results;

DO $$
DECLARE
    v_failed_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_failed_count
    FROM anon_confidential_helper_test_results
    WHERE NOT passed;

    IF v_failed_count > 0 THEN
        RAISE EXCEPTION 'anon confidential helper regression test failed with % failing assertion(s)', v_failed_count;
    END IF;
END $$;

ROLLBACK;
