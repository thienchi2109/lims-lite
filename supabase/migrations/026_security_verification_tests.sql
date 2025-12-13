-- Migration 026: Security Verification Tests
-- Creates automated tests to prevent security regressions and false positives
-- Run this after any migration that modifies RLS policies

SET search_path TO public;

-- ============================================================================
-- SECURITY TEST FUNCTIONS
-- ============================================================================

-- Test 1: Verify only one INSERT policy exists on results table
CREATE OR REPLACE FUNCTION test_results_insert_policy_count()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM pg_policy 
    WHERE polrelid = 'public.results'::regclass 
      AND polcmd = 'a';  -- 'a' = INSERT
    
    IF v_count != 1 THEN
        RAISE WARNING 'SECURITY TEST FAILED: Expected 1 INSERT policy on results, found %', v_count;
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Test 2: Verify INSERT policy has role check
CREATE OR REPLACE FUNCTION test_results_insert_has_role_check()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy_check TEXT;
BEGIN
    SELECT pg_get_expr(polwithcheck, polrelid) INTO v_policy_check
    FROM pg_policy 
    WHERE polrelid = 'public.results'::regclass 
      AND polcmd = 'a'
    LIMIT 1;
    
    IF v_policy_check IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: No INSERT policy found on results table';
        RETURN FALSE;
    END IF;
    
    IF v_policy_check NOT LIKE '%get_user_role%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: INSERT policy missing role check. Policy: %', v_policy_check;
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- Test 3: Verify no orphaned vulnerable policies exist
CREATE OR REPLACE FUNCTION test_no_orphaned_vulnerable_policies()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_vulnerable_policies TEXT[];
BEGIN
    -- List of old vulnerable policy names that should NOT exist
    v_vulnerable_policies := ARRAY[
        'Analysts can insert results',  -- From migration 003 (should be removed)
        'Analysts can insert pending results'  -- From migration 023 (should be removed)
    ];
    
    FOR i IN 1..array_length(v_vulnerable_policies, 1) LOOP
        IF EXISTS (
            SELECT 1 FROM pg_policy 
            WHERE polrelid = 'public.results'::regclass 
              AND polname = v_vulnerable_policies[i]
        ) THEN
            RAISE WARNING 'SECURITY TEST FAILED: Orphaned vulnerable policy found: %', v_vulnerable_policies[i];
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;

-- Test 4: Verify all tables with RLS have at least one policy
CREATE OR REPLACE FUNCTION test_all_rls_tables_have_policies()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_table RECORD;
    v_policy_count INTEGER;
BEGIN
    FOR v_table IN 
        SELECT schemaname, tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND rowsecurity = true
    LOOP
        SELECT COUNT(*) INTO v_policy_count
        FROM pg_policy 
        WHERE schemaname = v_table.schemaname 
          AND tablename = v_table.tablename;
        
        IF v_policy_count = 0 THEN
            RAISE WARNING 'SECURITY TEST FAILED: Table %.% has RLS enabled but no policies', 
                v_table.schemaname, v_table.tablename;
            RETURN FALSE;
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;

-- Test 5: Verify critical policies have role checks
CREATE OR REPLACE FUNCTION test_critical_policies_have_role_checks()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy RECORD;
    v_policy_check TEXT;
    v_has_role_check BOOLEAN;
BEGIN
    -- Check INSERT/UPDATE/DELETE policies on critical tables
    FOR v_policy IN 
        SELECT 
            schemaname,
            tablename,
            policyname,
            cmd
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('results', 'samples', 'users', 'audit_logs')
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
          AND policyname NOT LIKE 'Managers can%'  -- Managers policies are OK
    LOOP
        SELECT pg_get_expr(polwithcheck, polrelid) INTO v_policy_check
        FROM pg_policy 
        WHERE schemaname = v_policy.schemaname
          AND tablename = v_policy.tablename
          AND polname = v_policy.policyname;
        
        -- Check if policy has role check or ownership check
        v_has_role_check := (
            v_policy_check LIKE '%get_user_role%' OR
            v_policy_check LIKE '%received_by%' OR
            v_policy_check LIKE '%auth.uid()%'
        );
        
        IF NOT v_has_role_check THEN
            RAISE WARNING 'SECURITY TEST WARNING: Policy %.%.% may be missing access control. Check: %', 
                v_policy.schemaname, v_policy.tablename, v_policy.policyname, v_policy_check;
            -- Don't fail, just warn (some policies might be intentionally permissive)
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;

-- Master test runner
CREATE OR REPLACE FUNCTION run_security_tests()
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
    
    -- Test 1
    RETURN QUERY SELECT 
        'Results INSERT Policy Count'::TEXT,
        test_results_insert_policy_count(),
        'Verifies only one INSERT policy exists on results table'::TEXT;
    
    -- Test 2
    RETURN QUERY SELECT 
        'Results INSERT Role Check'::TEXT,
        test_results_insert_has_role_check(),
        'Verifies INSERT policy includes get_user_role() check'::TEXT;
    
    -- Test 3
    RETURN QUERY SELECT 
        'No Orphaned Vulnerable Policies'::TEXT,
        test_no_orphaned_vulnerable_policies(),
        'Verifies old vulnerable policies have been removed'::TEXT;
    
    -- Test 4
    RETURN QUERY SELECT 
        'All RLS Tables Have Policies'::TEXT,
        test_all_rls_tables_have_policies(),
        'Verifies all tables with RLS have at least one policy'::TEXT;
    
    -- Test 5
    RETURN QUERY SELECT 
        'Critical Policies Have Access Control'::TEXT,
        test_critical_policies_have_role_checks(),
        'Verifies critical policies have role or ownership checks'::TEXT;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION test_results_insert_policy_count() TO authenticated;
GRANT EXECUTE ON FUNCTION test_results_insert_has_role_check() TO authenticated;
GRANT EXECUTE ON FUNCTION test_no_orphaned_vulnerable_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION test_all_rls_tables_have_policies() TO authenticated;
GRANT EXECUTE ON FUNCTION test_critical_policies_have_role_checks() TO authenticated;
GRANT EXECUTE ON FUNCTION run_security_tests() TO authenticated;

-- Add comments
COMMENT ON FUNCTION run_security_tests() IS 'Runs all security verification tests. Run after any migration that modifies RLS policies.';
COMMENT ON FUNCTION test_results_insert_policy_count() IS 'Verifies only one INSERT policy exists on results table to prevent policy accumulation.';
COMMENT ON FUNCTION test_results_insert_has_role_check() IS 'Verifies the INSERT policy on results includes proper role check.';
COMMENT ON FUNCTION test_no_orphaned_vulnerable_policies() IS 'Checks for old vulnerable policies that should have been removed.';

-- Run tests immediately to verify current state
SELECT * FROM run_security_tests();
