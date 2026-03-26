-- RUN SECURITY TESTS CONFIDENTIAL COVERAGE REGRESSION SUITE
-- Verifies run_security_tests() includes confidential-control assertions from batches 1-2.
-- Usage: docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/run-security-tests-confidential.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'RUN SECURITY TESTS CONFIDENTIAL COVERAGE REGRESSION SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE run_security_tests_confidential_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $$
BEGIN
    CREATE TEMP TABLE batch7_security_results AS
    SELECT *
    FROM public.run_security_tests();
END $$;

\echo 'Test 1: run_security_tests() includes confidential schema-column coverage'
INSERT INTO run_security_tests_confidential_results
SELECT
    'run_security_tests_includes_confidential_schema_columns',
    EXISTS (
        SELECT 1
        FROM batch7_security_results
        WHERE test_name = 'Confidential Schema Columns Exist'
          AND passed = TRUE
    ),
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM batch7_security_results
            WHERE test_name = 'Confidential Schema Columns Exist'
              AND passed = TRUE
        )
            THEN 'run_security_tests() reports confidential schema-column coverage'
        ELSE 'missing passed row: Confidential Schema Columns Exist'
    END;

\echo 'Test 2: run_security_tests() includes confidential helper coverage'
INSERT INTO run_security_tests_confidential_results
SELECT
    'run_security_tests_includes_confidential_helper_security',
    EXISTS (
        SELECT 1
        FROM batch7_security_results
        WHERE test_name = 'Confidential Access Helper Security'
          AND passed = TRUE
    ),
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM batch7_security_results
            WHERE test_name = 'Confidential Access Helper Security'
              AND passed = TRUE
        )
            THEN 'run_security_tests() reports confidential helper security coverage'
        ELSE 'missing passed row: Confidential Access Helper Security'
    END;

\echo 'Test 3: run_security_tests() includes confidential results-policy coverage'
INSERT INTO run_security_tests_confidential_results
SELECT
    'run_security_tests_includes_confidential_results_policy_guards',
    EXISTS (
        SELECT 1
        FROM batch7_security_results
        WHERE test_name = 'Results Confidential Policy Guards'
          AND passed = TRUE
    ),
    CASE
        WHEN EXISTS (
            SELECT 1
            FROM batch7_security_results
            WHERE test_name = 'Results Confidential Policy Guards'
              AND passed = TRUE
        )
            THEN 'run_security_tests() reports confidential results-policy guards'
        ELSE 'missing passed row: Results Confidential Policy Guards'
    END;

TABLE run_security_tests_confidential_results;

DO $$
DECLARE
    v_failures INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_failures
    FROM run_security_tests_confidential_results
    WHERE NOT passed;

    IF v_failures > 0 THEN
        RAISE EXCEPTION 'run-security-tests-confidential.test.sql failed with % failing test(s)', v_failures;
    END IF;
END $$;

ROLLBACK;
