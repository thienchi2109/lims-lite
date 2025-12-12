-- ============================================================================
-- LAB SPECIALTIES RLS REGRESSION TEST SUITE
-- ============================================================================
-- Verifies that manager-only management policy includes an explicit WITH CHECK
-- so INSERT/UPDATE are restricted to managers.
--
-- Usage:
--   psql -h localhost -p 54322 -U postgres -d postgres -f lab-specialties-rls.test.sql
-- Or via docker:
--   docker compose exec db psql -U postgres -d postgres -f /path/to/this/file.sql
-- ============================================================================

\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
\timing on
\echo '============================================================================'
\echo 'LAB SPECIALTIES RLS TEST SUITE'
\echo '============================================================================'
\echo ''

-- TEST 1: Manager management policy must include WITH CHECK
DO $$
DECLARE
    v_with_check TEXT;
BEGIN
    SELECT pg_get_expr(polwithcheck, polrelid) INTO v_with_check
    FROM pg_policy
    WHERE polrelid = 'public.lab_specialties'::regclass
      AND polname = 'Managers can manage lab specialties'
    LIMIT 1;

    IF v_with_check IS NULL THEN
        RAISE EXCEPTION '✗ TEST 1 FAILED: "Managers can manage lab specialties" policy is missing WITH CHECK';
    END IF;

    IF v_with_check NOT LIKE '%get_user_role%' THEN
        RAISE EXCEPTION '✗ TEST 1 FAILED: WITH CHECK missing role guard. Found: %', v_with_check;
    END IF;

    RAISE NOTICE '✓ TEST 1 PASSED: WITH CHECK present with role guard: %', v_with_check;
END $$;

\echo ''
\echo 'Expected: Test 1 passes with explicit WITH CHECK containing get_user_role()'
\echo ''
