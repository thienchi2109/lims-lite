-- Migration 128: Extend run_security_tests() for confidential controls
-- Security Impact: Low - strengthens the internal security verification harness without changing runtime RLS behavior
-- Purpose: Ensure run_security_tests() validates confidential schema primitives, helper security, and confidential results policy guards

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.test_confidential_schema_columns_exist()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_matching_columns INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_matching_columns
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (
          (
              table_name = 'assay_definitions'
              AND column_name = 'is_confidential'
              AND data_type = 'boolean'
              AND is_nullable = 'NO'
              AND COALESCE(column_default, '') LIKE 'false%'
          )
          OR (
              table_name = 'users'
              AND column_name = 'can_access_confidential'
              AND data_type = 'boolean'
              AND is_nullable = 'NO'
              AND COALESCE(column_default, '') LIKE 'false%'
          )
      );

    IF v_matching_columns <> 2 THEN
        RAISE WARNING 'SECURITY TEST FAILED: expected 2 confidential schema columns with boolean/not-null/default false, found %', v_matching_columns;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_confidential_access_helper_security()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_helper_exists BOOLEAN;
    v_security_definer BOOLEAN;
    v_volatility "char";
    v_returns_boolean BOOLEAN;
    v_has_authenticated_execute BOOLEAN;
BEGIN
    SELECT
        TRUE,
        p.prosecdef,
        p.provolatile,
        pg_catalog.pg_get_function_result(p.oid) = 'boolean',
        has_function_privilege('authenticated', 'public.user_can_access_confidential()', 'EXECUTE')
    INTO
        v_helper_exists,
        v_security_definer,
        v_volatility,
        v_returns_boolean,
        v_has_authenticated_execute
    FROM pg_proc AS p
    WHERE p.pronamespace = 'public'::regnamespace
      AND p.proname = 'user_can_access_confidential';

    IF NOT COALESCE(v_helper_exists, FALSE) THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() is missing';
        RETURN FALSE;
    END IF;

    IF NOT v_security_definer THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() must be SECURITY DEFINER';
        RETURN FALSE;
    END IF;

    IF v_volatility <> 's' THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() should remain STABLE, got volatility=%', v_volatility;
        RETURN FALSE;
    END IF;

    IF NOT v_returns_boolean THEN
        RAISE WARNING 'SECURITY TEST FAILED: public.user_can_access_confidential() must return boolean';
        RETURN FALSE;
    END IF;

    IF NOT v_has_authenticated_execute THEN
        RAISE WARNING 'SECURITY TEST FAILED: authenticated role lost EXECUTE on public.user_can_access_confidential()';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.test_results_confidential_policy_guards()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_select_policy TEXT;
    v_insert_policy TEXT;
    v_update_using_policy TEXT;
    v_update_with_check_policy TEXT;
BEGIN
    SELECT qual
    INTO v_select_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'results'
      AND policyname = 'Authenticated users can read results'
      AND cmd = 'SELECT';

    IF v_select_policy IS NULL
       OR v_select_policy NOT ILIKE '%user_can_access_confidential%'
       OR v_select_policy NOT ILIKE '%is_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: results SELECT policy is missing confidential guard text. Policy: %', COALESCE(v_select_policy, 'NULL');
        RETURN FALSE;
    END IF;

    SELECT with_check
    INTO v_insert_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'results'
      AND policyname = 'Analysts and managers can insert results'
      AND cmd = 'INSERT';

    IF v_insert_policy IS NULL
       OR v_insert_policy NOT ILIKE '%user_can_access_confidential%'
       OR v_insert_policy NOT ILIKE '%is_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: results INSERT policy is missing confidential guard text. Policy: %', COALESCE(v_insert_policy, 'NULL');
        RETURN FALSE;
    END IF;

    SELECT qual, with_check
    INTO v_update_using_policy, v_update_with_check_policy
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'results'
      AND policyname = 'Analysts and managers can update results'
      AND cmd = 'UPDATE';

    IF v_update_using_policy IS NULL
       OR v_update_using_policy NOT ILIKE '%user_can_access_confidential%'
       OR v_update_using_policy NOT ILIKE '%is_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: results UPDATE USING policy is missing confidential guard text. Policy: %', COALESCE(v_update_using_policy, 'NULL');
        RETURN FALSE;
    END IF;

    IF v_update_with_check_policy IS NULL
       OR v_update_with_check_policy NOT ILIKE '%user_can_access_confidential%'
       OR v_update_with_check_policy NOT ILIKE '%is_confidential%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: results UPDATE WITH CHECK policy is missing confidential guard text. Policy: %', COALESCE(v_update_with_check_policy, 'NULL');
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_security_tests()
RETURNS TABLE(
    test_name TEXT,
    passed BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '=== Running Security Verification Tests ===';
    RAISE NOTICE '';

    RETURN QUERY SELECT
        'Results INSERT Policy Count'::TEXT,
        test_results_insert_policy_count(),
        'Verifies only one INSERT policy exists on results table'::TEXT;

    RETURN QUERY SELECT
        'Results INSERT Role Check'::TEXT,
        test_results_insert_has_role_check(),
        'Verifies INSERT policy includes get_user_role() check'::TEXT;

    RETURN QUERY SELECT
        'No Orphaned Vulnerable Policies'::TEXT,
        test_no_orphaned_vulnerable_policies(),
        'Verifies old vulnerable policies have been removed'::TEXT;

    RETURN QUERY SELECT
        'All RLS Tables Have Policies'::TEXT,
        test_all_rls_tables_have_policies(),
        'Verifies all tables with RLS have at least one policy'::TEXT;

    RETURN QUERY SELECT
        'Critical Policies Have Access Control'::TEXT,
        test_critical_policies_have_role_checks(),
        'Verifies critical policies have role or ownership checks'::TEXT;

    RETURN QUERY SELECT
        'Confidential Schema Columns Exist'::TEXT,
        test_confidential_schema_columns_exist(),
        'Verifies confidential schema columns exist as non-null booleans with safe defaults'::TEXT;

    RETURN QUERY SELECT
        'Confidential Access Helper Security'::TEXT,
        test_confidential_access_helper_security(),
        'Verifies user_can_access_confidential() stays boolean, STABLE, SECURITY DEFINER, and executable by authenticated users'::TEXT;

    RETURN QUERY SELECT
        'Results Confidential Policy Guards'::TEXT,
        test_results_confidential_policy_guards(),
        'Verifies results SELECT/INSERT/UPDATE policies keep the confidential assay guard tied to user_can_access_confidential()'::TEXT;

    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

GRANT EXECUTE ON FUNCTION public.test_confidential_schema_columns_exist() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_confidential_access_helper_security() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_results_confidential_policy_guards() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_security_tests() TO authenticated;

ALTER FUNCTION public.test_confidential_schema_columns_exist() SET search_path = public, extensions;
ALTER FUNCTION public.test_confidential_access_helper_security() SET search_path = public, extensions;
ALTER FUNCTION public.test_results_confidential_policy_guards() SET search_path = public, extensions;
ALTER FUNCTION public.run_security_tests() SET search_path = public, extensions;

COMMENT ON FUNCTION public.test_confidential_schema_columns_exist() IS
'Verifies confidential schema columns exist as boolean, non-null fields with safe false defaults.';
COMMENT ON FUNCTION public.test_confidential_access_helper_security() IS
'Verifies the confidential access helper remains boolean, STABLE, SECURITY DEFINER, and executable by authenticated users.';
COMMENT ON FUNCTION public.test_results_confidential_policy_guards() IS
'Verifies results SELECT/INSERT/UPDATE policies retain the confidential assay guard tied to user_can_access_confidential().';
COMMENT ON FUNCTION public.run_security_tests() IS
'Runs security verification tests, including confidential schema, helper, and results-policy guard coverage.';
