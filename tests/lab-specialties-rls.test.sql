-- ============================================================================
-- LAB SPECIALTIES RLS REGRESSION TEST SUITE
-- ============================================================================
-- Verifies the current manager-only INSERT, UPDATE, and DELETE policy contract:
-- INSERT/UPDATE require manager WITH CHECK; UPDATE/DELETE require manager USING.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/lab-specialties-rls.test.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public;
\timing on

\echo '============================================================================'
\echo 'LAB SPECIALTIES RLS TEST SUITE'
\echo '============================================================================'
\echo ''

BEGIN;

DO $$
DECLARE
    v_mutation_policy_count INTEGER;
    v_expected_manager_expression CONSTANT TEXT :=
        '(get_user_role()=''manager''::user_role)';
    v_insert_using TEXT;
    v_insert_check TEXT;
    v_update_using TEXT;
    v_update_check TEXT;
    v_delete_using TEXT;
    v_delete_check TEXT;
BEGIN
    SELECT COUNT(*)
    INTO v_mutation_policy_count
    FROM pg_policy
    WHERE polrelid = 'public.lab_specialties'::regclass
      AND polcmd IN ('a', 'w', 'd');

    IF v_mutation_policy_count IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: expected 3 mutation policies, found %',
            v_mutation_policy_count;
    END IF;

    SELECT
        regexp_replace(
            lower(COALESCE(pg_get_expr(polqual, polrelid), '')),
            '[[:space:]]+',
            '',
            'g'
        ),
        regexp_replace(
            lower(COALESCE(pg_get_expr(polwithcheck, polrelid), '')),
            '[[:space:]]+',
            '',
            'g'
        )
    INTO v_insert_using, v_insert_check
    FROM pg_policy
    WHERE polrelid = 'public.lab_specialties'::regclass
      AND polname = 'Managers can insert lab specialties'
      AND polcmd = 'a';

    IF v_insert_check IS DISTINCT FROM v_expected_manager_expression THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: INSERT WITH CHECK expected %, found %',
            v_expected_manager_expression,
            nullif(v_insert_check, '');
    END IF;

    IF v_insert_using IS DISTINCT FROM '' THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: INSERT policy unexpectedly has USING: %',
            v_insert_using;
    END IF;

    SELECT
        regexp_replace(
            lower(COALESCE(pg_get_expr(polqual, polrelid), '')),
            '[[:space:]]+',
            '',
            'g'
        ),
        regexp_replace(
            lower(COALESCE(pg_get_expr(polwithcheck, polrelid), '')),
            '[[:space:]]+',
            '',
            'g'
        )
    INTO v_update_using, v_update_check
    FROM pg_policy
    WHERE polrelid = 'public.lab_specialties'::regclass
      AND polname = 'Managers can update lab specialties'
      AND polcmd = 'w';

    IF v_update_using IS DISTINCT FROM v_expected_manager_expression THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: UPDATE USING expected %, found %',
            v_expected_manager_expression,
            nullif(v_update_using, '');
    END IF;

    IF v_update_check IS DISTINCT FROM v_expected_manager_expression THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: UPDATE WITH CHECK expected %, found %',
            v_expected_manager_expression,
            nullif(v_update_check, '');
    END IF;

    SELECT
        regexp_replace(
            lower(COALESCE(pg_get_expr(polqual, polrelid), '')),
            '[[:space:]]+',
            '',
            'g'
        ),
        regexp_replace(
            lower(COALESCE(pg_get_expr(polwithcheck, polrelid), '')),
            '[[:space:]]+',
            '',
            'g'
        )
    INTO v_delete_using, v_delete_check
    FROM pg_policy
    WHERE polrelid = 'public.lab_specialties'::regclass
      AND polname = 'Managers can delete lab specialties'
      AND polcmd = 'd';

    IF v_delete_using IS DISTINCT FROM v_expected_manager_expression THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: DELETE USING expected %, found %',
            v_expected_manager_expression,
            nullif(v_delete_using, '');
    END IF;

    IF v_delete_check IS DISTINCT FROM '' THEN
        RAISE EXCEPTION
            'LAB SPECIALTIES RLS FAILED: DELETE policy unexpectedly has WITH CHECK: %',
            v_delete_check;
    END IF;
END $$;

ROLLBACK;

SELECT 'lab-specialties-rls: ok' AS result;
