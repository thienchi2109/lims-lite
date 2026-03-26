-- SERVICE ROLE CONFIDENTIAL ACCESS REGRESSION TEST SUITE
-- Verifies service_role can read the confidentiality-related tables used by admin helpers.
-- Usage: docker exec -i lims-postgres psql -U postgres -d postgres < tests/service-role-confidential-access.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'SERVICE ROLE CONFIDENTIAL ACCESS REGRESSION TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE service_role_confidential_access_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

\echo 'Test 1: service_role can read public.results'
INSERT INTO service_role_confidential_access_test_results
SELECT
    'service_role_select_results',
    has_table_privilege('service_role', 'public.results', 'SELECT'),
    CASE
        WHEN has_table_privilege('service_role', 'public.results', 'SELECT')
            THEN 'service_role can read public.results'
        ELSE 'service_role cannot read public.results'
    END;

\echo 'Test 2: service_role can read public.assay_definitions'
INSERT INTO service_role_confidential_access_test_results
SELECT
    'service_role_select_assay_definitions',
    has_table_privilege('service_role', 'public.assay_definitions', 'SELECT'),
    CASE
        WHEN has_table_privilege('service_role', 'public.assay_definitions', 'SELECT')
            THEN 'service_role can read public.assay_definitions'
        ELSE 'service_role cannot read public.assay_definitions'
    END;

\echo 'Test 3: service_role can read public.users'
INSERT INTO service_role_confidential_access_test_results
SELECT
    'service_role_select_users',
    has_table_privilege('service_role', 'public.users', 'SELECT'),
    CASE
        WHEN has_table_privilege('service_role', 'public.users', 'SELECT')
            THEN 'service_role can read public.users'
        ELSE 'service_role cannot read public.users'
    END;

TABLE service_role_confidential_access_test_results;

DO $$
DECLARE
    v_failures INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_failures
    FROM service_role_confidential_access_test_results
    WHERE NOT passed;

    IF v_failures > 0 THEN
        RAISE EXCEPTION 'service-role-confidential-access.test.sql failed with % failing test(s)', v_failures;
    END IF;
END $$;

ROLLBACK;
