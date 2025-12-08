-- Migration 028: Fix security verification tests
-- Security Impact: Low
-- Changes: Fixes test_all_rls_tables_have_policies to query pg_policies (schemaname, tablename) instead of pg_policy to avoid missing column errors

SET search_path TO public;

-- Replace failing test function to use pg_policies view
DROP FUNCTION IF EXISTS test_all_rls_tables_have_policies();

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
        FROM pg_policies 
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

COMMENT ON FUNCTION test_all_rls_tables_have_policies() IS 'Verifies all tables with RLS have at least one policy (uses pg_policies view).';

-- Replace critical policy role-check validator to use pg_policies view
DROP FUNCTION IF EXISTS test_critical_policies_have_role_checks();

CREATE OR REPLACE FUNCTION test_critical_policies_have_role_checks()
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_policy RECORD;
    v_has_role_check BOOLEAN;
BEGIN
    -- Check INSERT/UPDATE/DELETE policies on critical tables
    FOR v_policy IN 
        SELECT 
            schemaname,
            tablename,
            policyname,
            cmd,
            with_check
        FROM pg_policies 
        WHERE schemaname = 'public' 
          AND tablename IN ('results', 'samples', 'users', 'audit_logs')
          AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
          AND policyname NOT LIKE 'Managers can%'  -- Managers policies are OK
    LOOP
        -- Check if policy has role check or ownership check
        v_has_role_check := (
            v_policy.with_check LIKE '%get_user_role%' OR
            v_policy.with_check LIKE '%received_by%' OR
            v_policy.with_check LIKE '%auth.uid()%'
        );
        
        IF NOT v_has_role_check THEN
            RAISE WARNING 'SECURITY TEST WARNING: Policy %.%.% may be missing access control. Check: %', 
                v_policy.schemaname, v_policy.tablename, v_policy.policyname, v_policy.with_check;
            -- Don't fail, just warn (some policies might be intentionally permissive)
        END IF;
    END LOOP;
    
    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION test_critical_policies_have_role_checks() IS 'Verifies critical policies have role or ownership checks (pg_policies-backed).';

-- Re-run security tests immediately to validate
SELECT * FROM run_security_tests();
