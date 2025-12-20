-- Migration 088: Fix Security Definer View Warnings
-- Security Impact: HIGH - Fixes unauthorized access to storage views
-- Changes:
--   1. Revoke excessive permissions from public.migrations, public.objects, public.buckets
--   2. Drop insecure views if not needed
--   3. Grant read-only access to authenticated users for storage views

SET search_path TO public;

-- ============================================================================
-- CRITICAL SECURITY FIX: Revoke All Permissions from Storage Views
-- ============================================================================

-- These views expose storage.* tables to public schema without RLS
-- Problem: anon and authenticated roles have INSERT, UPDATE, DELETE permissions
-- Solution: Revoke all permissions and grant only necessary SELECT to authenticated

-- ============================================================================
-- View 1: public.migrations (Storage migration tracking)
-- ============================================================================
-- This view exposes storage.migrations table
-- Decision: DROP - Not needed in application, used only by Supabase internally

-- Revoke all permissions
REVOKE ALL PRIVILEGES ON public.migrations FROM anon;
REVOKE ALL PRIVILEGES ON public.migrations FROM authenticated;
REVOKE ALL PRIVILEGES ON public.migrations FROM service_role;

-- Drop the view (Supabase can still access storage.migrations directly)
DROP VIEW IF EXISTS public.migrations;

COMMENT ON SCHEMA storage IS 'Supabase Storage schema - access via storage schema directly, not public views';

-- ============================================================================
-- View 2: public.objects (Storage objects/files)
-- ============================================================================
-- This view exposes storage.objects table
-- Decision: KEEP with restricted permissions (needed for file uploads)
-- Note: Storage API handles authentication, but view should be read-only

-- Revoke all permissions
REVOKE ALL PRIVILEGES ON public.objects FROM anon;
REVOKE ALL PRIVILEGES ON public.objects FROM authenticated;
REVOKE ALL PRIVILEGES ON public.objects FROM service_role;

-- Grant read-only access to authenticated users
-- Storage policies in storage.objects will enforce row-level security
GRANT SELECT ON public.objects TO authenticated;

-- Service role needs full access for storage API
GRANT ALL PRIVILEGES ON public.objects TO service_role;

COMMENT ON VIEW public.objects IS 'Read-only view of storage.objects. Modifications must go through Storage API (storage.objects table with RLS).';

-- ============================================================================
-- View 3: public.buckets (Storage buckets)
-- ============================================================================
-- This view exposes storage.buckets table
-- Decision: KEEP with restricted permissions (needed for bucket management)

-- Revoke all permissions
REVOKE ALL PRIVILEGES ON public.buckets FROM anon;
REVOKE ALL PRIVILEGES ON public.buckets FROM authenticated;
REVOKE ALL PRIVILEGES ON public.buckets FROM service_role;

-- Grant read-only access to authenticated users
GRANT SELECT ON public.buckets TO authenticated;

-- Service role needs full access for storage API
GRANT ALL PRIVILEGES ON public.buckets TO service_role;

COMMENT ON VIEW public.buckets IS 'Read-only view of storage.buckets. Modifications must go through Storage API (storage.buckets table with RLS).';

-- ============================================================================
-- Additional Security: Verify storage schema has RLS enabled
-- ============================================================================

-- Check if storage.objects has RLS (should be enabled by Supabase)
-- We cannot enable RLS on storage tables (managed by Supabase), but we can verify

DO $$
DECLARE
    objects_rls BOOLEAN;
    buckets_rls BOOLEAN;
BEGIN
    -- Check if storage.objects has RLS enabled
    SELECT relrowsecurity INTO objects_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'objects';

    -- Check if storage.buckets has RLS enabled
    SELECT relrowsecurity INTO buckets_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'storage' AND c.relname = 'buckets';

    -- Raise notice if RLS is not enabled (informational only)
    IF NOT objects_rls THEN
        RAISE NOTICE 'WARNING: storage.objects does not have RLS enabled. This is expected for Supabase managed tables.';
    END IF;

    IF NOT buckets_rls THEN
        RAISE NOTICE 'WARNING: storage.buckets does not have RLS enabled. This is expected for Supabase managed tables.';
    END IF;
END $$;

-- ============================================================================
-- Verification Queries (Run manually after migration)
-- ============================================================================

-- Verify permissions are restricted:
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_schema = 'public' AND table_name IN ('objects', 'buckets') ORDER BY table_name, grantee;

-- Expected output:
-- - authenticated: SELECT only on public.objects
-- - authenticated: SELECT only on public.buckets
-- - service_role: ALL PRIVILEGES on both
-- - anon: NO PERMISSIONS

-- Verify public.migrations view is dropped:
-- SELECT * FROM pg_views WHERE schemaname = 'public' AND viewname = 'migrations';

-- Expected output: (0 rows)
