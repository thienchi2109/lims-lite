-- Migration 097: Fix RLS performance warnings from Supabase advisor
-- Security Impact: None - Performance optimization only
-- Reference: D:\performance_warnings.md
--
-- Fixes:
-- 1. auth_rls_initplan: Wrap auth.jwt() in subquery for 3 tables
-- 2. multiple_permissive_policies: Consolidate audit_logs SELECT policies

SET search_path TO public;

-- ============================================================================
-- Fix 1: auth_rls_initplan on tenants, schema_migrations, extensions
-- ============================================================================
-- Issue: auth.jwt() is re-evaluated for each row
-- Fix: Wrap in subquery (SELECT auth.jwt()) for single evaluation

-- 1.1 Fix tenants policy
DROP POLICY IF EXISTS "Service role only access tenants" ON tenants;
CREATE POLICY "Service role only access tenants"
ON tenants FOR ALL
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

-- 1.2 Fix schema_migrations policy
DROP POLICY IF EXISTS "Service role only access schema_migrations" ON schema_migrations;
CREATE POLICY "Service role only access schema_migrations"
ON schema_migrations FOR ALL
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

-- 1.3 Fix extensions policy
DROP POLICY IF EXISTS "Service role only access extensions" ON extensions;
CREATE POLICY "Service role only access extensions"
ON extensions FOR ALL
USING (((SELECT auth.jwt()) ->> 'role') = 'service_role');

-- ============================================================================
-- Fix 2: multiple_permissive_policies on audit_logs
-- ============================================================================
-- Issue: Two overlapping SELECT policies for same roles
-- Fix: Consolidate into single policy with OR logic

-- Drop both existing policies
DROP POLICY IF EXISTS "Managers can read all audit logs" ON audit_logs;
DROP POLICY IF EXISTS "Analysts can read scoped audit logs" ON audit_logs;

-- Create single consolidated SELECT policy
CREATE POLICY "Users can read audit logs based on role"
ON audit_logs FOR SELECT
USING (
    CASE get_user_role()
        -- Managers can read all audit logs
        WHEN 'manager' THEN true
        -- Analysts can only read audit logs for samples/results/coa_reports they can access
        WHEN 'analyst' THEN (
            (table_name = 'samples' AND EXISTS (
                SELECT 1 FROM samples
                WHERE samples.id = audit_logs.record_id
                AND samples.deleted_at IS NULL
            ))
            OR
            (table_name = 'results' AND EXISTS (
                SELECT 1 FROM results
                WHERE results.id = audit_logs.record_id
            ))
            OR
            (table_name = 'coa_reports' AND EXISTS (
                SELECT 1 FROM coa_reports cr
                JOIN samples s ON cr.sample_id = s.id
                WHERE cr.id = audit_logs.record_id
                AND s.deleted_at IS NULL
            ))
        )
        ELSE false
    END
);

COMMENT ON POLICY "Users can read audit logs based on role" ON audit_logs IS
'Consolidated policy: Managers read all, Analysts read only related samples/results/coa_reports. Fixes multiple_permissive_policies warning.';
