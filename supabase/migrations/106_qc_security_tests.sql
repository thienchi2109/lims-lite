-- Migration 106: QC Security Verification Tests
-- Creates automated tests to verify RLS policies on QC tables
-- Run this after any migration that modifies QC RLS policies

SET search_path TO public;

-- ============================================================================
-- QC SECURITY TEST FUNCTIONS
-- ============================================================================

-- Test 1: Verify all QC tables have RLS enabled
CREATE OR REPLACE FUNCTION test_qc_tables_have_rls_enabled()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_table TEXT;
    v_qc_tables TEXT[] := ARRAY[
        'qc_materials',
        'qc_definitions',
        'qc_sessions',
        'qc_results',
        'qc_violations',
        'qc_tea_standards'
    ];
    v_has_rls BOOLEAN;
BEGIN
    FOREACH v_table IN ARRAY v_qc_tables LOOP
        SELECT relrowsecurity INTO v_has_rls
        FROM pg_class
        WHERE relname = v_table AND relnamespace = 'public'::regnamespace;

        IF NOT v_has_rls THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % does not have RLS enabled', v_table;
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Test 2: Verify all QC tables have at least one policy for each operation type
CREATE OR REPLACE FUNCTION test_qc_tables_have_policies()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_table TEXT;
    v_qc_tables TEXT[] := ARRAY[
        'qc_materials',
        'qc_definitions',
        'qc_sessions',
        'qc_results',
        'qc_violations',
        'qc_tea_standards'
    ];
    v_policy_count INTEGER;
    v_has_select BOOLEAN;
    v_has_insert BOOLEAN;
    v_has_update BOOLEAN;
    v_has_delete BOOLEAN;
BEGIN
    FOREACH v_table IN ARRAY v_qc_tables LOOP
        -- Check SELECT policy
        SELECT COUNT(*) > 0 INTO v_has_select
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'r';  -- 'r' = SELECT

        IF NOT v_has_select THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % missing SELECT policy', v_table;
            RETURN FALSE;
        END IF;

        -- Check INSERT policy
        SELECT COUNT(*) > 0 INTO v_has_insert
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'a';  -- 'a' = INSERT

        IF NOT v_has_insert THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % missing INSERT policy', v_table;
            RETURN FALSE;
        END IF;

        -- Check UPDATE policy
        SELECT COUNT(*) > 0 INTO v_has_update
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'w';  -- 'w' = UPDATE

        IF NOT v_has_update THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % missing UPDATE policy', v_table;
            RETURN FALSE;
        END IF;

        -- Check DELETE policy
        SELECT COUNT(*) > 0 INTO v_has_delete
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'd';  -- 'd' = DELETE

        IF NOT v_has_delete THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % missing DELETE policy', v_table;
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Test 3: Verify manager-only tables have proper role checks
CREATE OR REPLACE FUNCTION test_qc_manager_only_policies()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_table TEXT;
    v_manager_tables TEXT[] := ARRAY[
        'qc_materials',
        'qc_definitions',
        'qc_sessions',
        'qc_tea_standards'
    ];
    v_policy_check TEXT;
BEGIN
    FOREACH v_table IN ARRAY v_manager_tables LOOP
        -- Check INSERT policy has manager role check
        SELECT pg_get_expr(polwithcheck, polrelid) INTO v_policy_check
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'a'  -- INSERT
        LIMIT 1;

        IF v_policy_check IS NULL OR v_policy_check NOT LIKE '%manager%' THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % INSERT policy missing manager role check. Policy: %',
                v_table, COALESCE(v_policy_check, 'NULL');
            RETURN FALSE;
        END IF;

        -- Check UPDATE policy has manager role check
        SELECT pg_get_expr(polqual, polrelid) INTO v_policy_check
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'w'  -- UPDATE
        LIMIT 1;

        IF v_policy_check IS NULL OR v_policy_check NOT LIKE '%manager%' THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % UPDATE policy missing manager role check. Policy: %',
                v_table, COALESCE(v_policy_check, 'NULL');
            RETURN FALSE;
        END IF;

        -- Check DELETE policy has manager role check
        SELECT pg_get_expr(polqual, polrelid) INTO v_policy_check
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'd'  -- DELETE
        LIMIT 1;

        IF v_policy_check IS NULL OR v_policy_check NOT LIKE '%manager%' THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % DELETE policy missing manager role check. Policy: %',
                v_table, COALESCE(v_policy_check, 'NULL');
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Test 4: Verify qc_results allows analyst INSERT
CREATE OR REPLACE FUNCTION test_qc_results_analyst_can_insert()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy_check TEXT;
BEGIN
    SELECT pg_get_expr(polwithcheck, polrelid) INTO v_policy_check
    FROM pg_policy
    WHERE polrelid = 'public.qc_results'::regclass
      AND polcmd = 'a'  -- INSERT
    LIMIT 1;

    IF v_policy_check IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: No INSERT policy found on qc_results';
        RETURN FALSE;
    END IF;

    -- Should allow both analyst and manager
    IF v_policy_check NOT LIKE '%analyst%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: qc_results INSERT policy should allow analyst. Policy: %', v_policy_check;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Test 5: Verify qc_violations allows analyst INSERT (for system/trigger created violations)
CREATE OR REPLACE FUNCTION test_qc_violations_analyst_can_insert()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy_check TEXT;
BEGIN
    SELECT pg_get_expr(polwithcheck, polrelid) INTO v_policy_check
    FROM pg_policy
    WHERE polrelid = 'public.qc_violations'::regclass
      AND polcmd = 'a'  -- INSERT
    LIMIT 1;

    IF v_policy_check IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: No INSERT policy found on qc_violations';
        RETURN FALSE;
    END IF;

    -- Should allow both analyst and manager (violations created when entering QC results)
    IF v_policy_check NOT LIKE '%analyst%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: qc_violations INSERT policy should allow analyst. Policy: %', v_policy_check;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Test 6: Verify qc_violations UPDATE only allows manager (for resolving violations)
CREATE OR REPLACE FUNCTION test_qc_violations_only_manager_can_update()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy_check TEXT;
BEGIN
    SELECT pg_get_expr(polqual, polrelid) INTO v_policy_check
    FROM pg_policy
    WHERE polrelid = 'public.qc_violations'::regclass
      AND polcmd = 'w'  -- UPDATE
    LIMIT 1;

    IF v_policy_check IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: No UPDATE policy found on qc_violations';
        RETURN FALSE;
    END IF;

    -- Should only allow manager to resolve violations
    IF v_policy_check NOT LIKE '%manager%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: qc_violations UPDATE policy should require manager role. Policy: %', v_policy_check;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Test 7: Verify SELECT policies require authenticated role
CREATE OR REPLACE FUNCTION test_qc_select_requires_authenticated()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_table TEXT;
    v_qc_tables TEXT[] := ARRAY[
        'qc_materials',
        'qc_definitions',
        'qc_sessions',
        'qc_results',
        'qc_violations',
        'qc_tea_standards'
    ];
    v_policy_check TEXT;
BEGIN
    FOREACH v_table IN ARRAY v_qc_tables LOOP
        SELECT pg_get_expr(polqual, polrelid) INTO v_policy_check
        FROM pg_policy
        WHERE polrelid = ('public.' || v_table)::regclass
          AND polcmd = 'r'  -- SELECT
        LIMIT 1;

        IF v_policy_check IS NULL OR v_policy_check NOT LIKE '%authenticated%' THEN
            RAISE WARNING 'SECURITY TEST FAILED: QC table % SELECT policy should require authenticated role. Policy: %',
                v_table, COALESCE(v_policy_check, 'NULL');
            RETURN FALSE;
        END IF;
    END LOOP;

    RETURN TRUE;
END;
$$;

-- Test 8: Verify check_qc_approval_status function exists and is accessible
CREATE OR REPLACE FUNCTION test_check_qc_approval_status_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_function_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'check_qc_approval_status'
    ) INTO v_function_exists;

    IF NOT v_function_exists THEN
        RAISE WARNING 'SECURITY TEST FAILED: check_qc_approval_status function does not exist';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- Test 9: Verify get_active_qc_session function exists
CREATE OR REPLACE FUNCTION test_get_active_qc_session_exists()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_function_exists BOOLEAN;
BEGIN
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'get_active_qc_session'
    ) INTO v_function_exists;

    IF NOT v_function_exists THEN
        RAISE WARNING 'SECURITY TEST FAILED: get_active_qc_session function does not exist';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

-- ============================================================================
-- MASTER QC SECURITY TEST RUNNER
-- ============================================================================

CREATE OR REPLACE FUNCTION run_qc_security_tests()
RETURNS TABLE(
    test_name TEXT,
    passed BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE '=== Running QC Security Verification Tests ===';
    RAISE NOTICE '';

    -- Test 1
    RETURN QUERY SELECT
        'QC Tables Have RLS Enabled'::TEXT,
        test_qc_tables_have_rls_enabled(),
        'Verifies all 6 QC tables have RLS enabled'::TEXT;

    -- Test 2
    RETURN QUERY SELECT
        'QC Tables Have All Policy Types'::TEXT,
        test_qc_tables_have_policies(),
        'Verifies all QC tables have SELECT/INSERT/UPDATE/DELETE policies'::TEXT;

    -- Test 3
    RETURN QUERY SELECT
        'Manager-Only Tables Enforce Role'::TEXT,
        test_qc_manager_only_policies(),
        'Verifies qc_materials, qc_definitions, qc_sessions, qc_tea_standards require manager for mutations'::TEXT;

    -- Test 4
    RETURN QUERY SELECT
        'qc_results Allows Analyst INSERT'::TEXT,
        test_qc_results_analyst_can_insert(),
        'Verifies analysts can insert QC results'::TEXT;

    -- Test 5
    RETURN QUERY SELECT
        'qc_violations Allows Analyst INSERT'::TEXT,
        test_qc_violations_analyst_can_insert(),
        'Verifies analysts can create violations (when entering QC results)'::TEXT;

    -- Test 6
    RETURN QUERY SELECT
        'qc_violations Only Manager UPDATE'::TEXT,
        test_qc_violations_only_manager_can_update(),
        'Verifies only managers can resolve (update) violations'::TEXT;

    -- Test 7
    RETURN QUERY SELECT
        'QC SELECT Requires Authenticated'::TEXT,
        test_qc_select_requires_authenticated(),
        'Verifies all QC tables require authenticated role for SELECT'::TEXT;

    -- Test 8
    RETURN QUERY SELECT
        'check_qc_approval_status Exists'::TEXT,
        test_check_qc_approval_status_exists(),
        'Verifies the QC approval blocking function exists'::TEXT;

    -- Test 9
    RETURN QUERY SELECT
        'get_active_qc_session Exists'::TEXT,
        test_get_active_qc_session_exists(),
        'Verifies the active session lookup function exists'::TEXT;

    RAISE NOTICE '';
    RAISE NOTICE '=== QC Security Tests Complete ===';
END;
$$;

-- ============================================================================
-- GRANT EXECUTE PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION test_qc_tables_have_rls_enabled() TO authenticated;
GRANT EXECUTE ON FUNCTION test_qc_tables_have_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION test_qc_manager_only_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION test_qc_results_analyst_can_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION test_qc_violations_analyst_can_insert() TO authenticated;
GRANT EXECUTE ON FUNCTION test_qc_violations_only_manager_can_update() TO authenticated;
GRANT EXECUTE ON FUNCTION test_qc_select_requires_authenticated() TO authenticated;
GRANT EXECUTE ON FUNCTION test_check_qc_approval_status_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION test_get_active_qc_session_exists() TO authenticated;
GRANT EXECUTE ON FUNCTION run_qc_security_tests() TO authenticated;

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION run_qc_security_tests() IS 'Runs all QC security verification tests. Run after any migration that modifies QC RLS policies.';
COMMENT ON FUNCTION test_qc_tables_have_rls_enabled() IS 'Verifies all 6 QC tables have RLS enabled.';
COMMENT ON FUNCTION test_qc_tables_have_policies() IS 'Verifies all QC tables have SELECT/INSERT/UPDATE/DELETE policies.';
COMMENT ON FUNCTION test_qc_manager_only_policies() IS 'Verifies manager-only tables enforce manager role for mutations.';
COMMENT ON FUNCTION test_qc_results_analyst_can_insert() IS 'Verifies analysts can insert QC results.';
COMMENT ON FUNCTION test_qc_violations_analyst_can_insert() IS 'Verifies analysts can create violations.';
COMMENT ON FUNCTION test_qc_violations_only_manager_can_update() IS 'Verifies only managers can resolve violations.';
COMMENT ON FUNCTION test_qc_select_requires_authenticated() IS 'Verifies all QC tables require authenticated role for SELECT.';

-- Run tests immediately to verify current state
SELECT * FROM run_qc_security_tests();
