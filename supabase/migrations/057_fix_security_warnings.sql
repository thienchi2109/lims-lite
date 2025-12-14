-- Migration 057: Fix security warnings (Mutable search paths and Extensions in public)
-- Description: 
-- 1. Moves 'uuid-ossp' and 'pgcrypto' extensions to 'extensions' schema to keep public clean.
-- 2. Sets search_path for functions to prevent search path hijacking (CVE-2018-1058 mitigation).
-- 3. Updates default search_path for roles to include the new 'extensions' schema.
-- 4. Fixes "Function search path mutable" warnings from Supabase linter.

SET search_path TO public;

-- ============================================================================
-- 1. PREPARE EXTENSIONS SCHEMA
-- ============================================================================

-- Create schema for extensions if it doesn't exist
CREATE SCHEMA IF NOT EXISTS "extensions";

-- Grant usage to all standard roles
GRANT USAGE ON SCHEMA "extensions" TO postgres, anon, authenticated, service_role;

-- Move extensions to the new schema
-- We use a DO block to handle cases where they might already be moved or missing
DO $$
BEGIN
    -- Move uuid-ossp
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp') THEN
        ALTER EXTENSION "uuid-ossp" SET SCHEMA "extensions";
    END IF;

    -- Move pgcrypto
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        ALTER EXTENSION "pgcrypto" SET SCHEMA "extensions";
    END IF;
END $$;

-- ============================================================================
-- 2. UPDATE ROLE CONFIGURATION
-- ============================================================================

-- Update search_path for all roles to include 'extensions'
-- This ensures that default queries (e.g. from PostgREST) can find extension functions
ALTER ROLE postgres SET search_path TO public, extensions;
ALTER ROLE authenticated SET search_path TO public, extensions;
ALTER ROLE anon SET search_path TO public, extensions;
ALTER ROLE service_role SET search_path TO public, extensions;

-- Note: We generally avoid ALTER DATABASE in migrations as it can't run in transaction blocks
-- but ALTER ROLE is safe and effective for connection sessions.

-- ============================================================================
-- 3. FIX FUNCTION SEARCH PATHS
-- ============================================================================
-- Prevents malicious users from hijacking function execution by creating objects
-- in schemas that appear earlier in the search path.
-- We explicitly set search_path to 'public, extensions' for all affected functions.

-- Helper & Trigger Functions
ALTER FUNCTION public.get_user_role() SET search_path = public, extensions;
ALTER FUNCTION public.update_updated_at_column() SET search_path = public, extensions;
ALTER FUNCTION public.trigger_audit_log() SET search_path = public, extensions;
ALTER FUNCTION public.update_sample_updated_at_from_result() SET search_path = public, extensions;
ALTER FUNCTION public.sync_client_name_snapshot() SET search_path = public, extensions;
ALTER FUNCTION public.generate_next_sample_id() SET search_path = public, extensions;

-- Security Test Functions
ALTER FUNCTION public.test_results_insert_policy_count() SET search_path = public, extensions;
ALTER FUNCTION public.test_results_insert_has_role_check() SET search_path = public, extensions;
ALTER FUNCTION public.test_no_orphaned_vulnerable_policies() SET search_path = public, extensions;
ALTER FUNCTION public.test_all_rls_tables_have_policies() SET search_path = public, extensions;
ALTER FUNCTION public.test_critical_policies_have_role_checks() SET search_path = public, extensions;
ALTER FUNCTION public.run_security_tests() SET search_path = public, extensions;

-- RPCs (Business Logic)
ALTER FUNCTION public.create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID) SET search_path = public, extensions;
ALTER FUNCTION public.accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB) SET search_path = public, extensions;

-- ============================================================================
-- 4. VERIFICATION
-- ============================================================================

-- Run security tests to ensure nothing broke
SELECT run_security_tests();
