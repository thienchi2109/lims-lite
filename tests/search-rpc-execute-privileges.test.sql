-- SEARCH RPC EXECUTE PRIVILEGES REGRESSION TEST SUITE
-- Verifies anonymous users cannot execute sample/result search RPCs that can expose sensitive metadata.
-- Usage: docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/search-rpc-execute-privileges.test.sql

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;

\echo '============================================================================'
\echo 'SEARCH RPC EXECUTE PRIVILEGES TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

CREATE TEMP TABLE search_rpc_execute_privilege_test_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

WITH protected_functions(function_name, signature) AS (
    VALUES
        ('get_samples_page', 'public.get_samples_page(text, text, sample_status, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid, uuid[], text, text, integer, integer)'),
        ('global_search', 'public.global_search(text, integer)'),
        ('search_assays', 'public.search_assays(text, integer)'),
        ('search_clients', 'public.search_clients(text, integer)'),
        ('search_results', 'public.search_results(text, integer)'),
        ('search_samples', 'public.search_samples(text, integer)')
),
privilege_checks AS (
    SELECT
        function_name,
        has_function_privilege('anon', signature, 'EXECUTE') AS anon_can_execute,
        has_function_privilege('authenticated', signature, 'EXECUTE') AS authenticated_can_execute
    FROM protected_functions
)
INSERT INTO search_rpc_execute_privilege_test_results (test_name, passed, detail)
SELECT
    'anon_cannot_execute_sensitive_search_rpcs',
    bool_and(NOT anon_can_execute),
    COALESCE(
        string_agg(function_name, ', ' ORDER BY function_name) FILTER (WHERE anon_can_execute),
        'anon has no EXECUTE privilege on protected search/page RPCs'
    )
FROM privilege_checks;

WITH protected_functions(function_name, signature) AS (
    VALUES
        ('get_samples_page', 'public.get_samples_page(text, text, sample_status, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid, uuid[], text, text, integer, integer)'),
        ('global_search', 'public.global_search(text, integer)'),
        ('search_assays', 'public.search_assays(text, integer)'),
        ('search_clients', 'public.search_clients(text, integer)'),
        ('search_results', 'public.search_results(text, integer)'),
        ('search_samples', 'public.search_samples(text, integer)')
),
privilege_checks AS (
    SELECT
        function_name,
        has_function_privilege('authenticated', signature, 'EXECUTE') AS authenticated_can_execute
    FROM protected_functions
)
INSERT INTO search_rpc_execute_privilege_test_results (test_name, passed, detail)
SELECT
    'authenticated_can_execute_sensitive_search_rpcs',
    bool_and(authenticated_can_execute),
    COALESCE(
        string_agg(function_name, ', ' ORDER BY function_name) FILTER (WHERE NOT authenticated_can_execute),
        'authenticated keeps EXECUTE privilege on protected search/page RPCs'
    )
FROM privilege_checks;

\echo ''
\echo 'Results:'
TABLE search_rpc_execute_privilege_test_results ORDER BY test_name;

DO $$
DECLARE
    v_failures TEXT;
BEGIN
    SELECT string_agg(format('- %s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failures
    FROM search_rpc_execute_privilege_test_results
    WHERE NOT passed;

    IF v_failures IS NOT NULL THEN
        RAISE EXCEPTION 'search-rpc-execute-privileges.test.sql failed:%', E'\n' || v_failures;
    END IF;
END $$;

ROLLBACK;

\echo ''
\echo '✓ SEARCH RPC EXECUTE PRIVILEGES TESTS PASSED'
