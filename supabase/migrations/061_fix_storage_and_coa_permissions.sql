-- Migration 058: Fix Storage Service and CoA Reports Permissions
-- Description: Create views for storage service and add missing RLS policies

SET search_path TO public;

-- ============================================================================
-- PART 1: Storage Service Views
-- ============================================================================
-- The storage service (supabase/storage-api) queries tables without schema
-- qualification. Create views in public schema pointing to storage schema.

CREATE OR REPLACE VIEW public.buckets AS SELECT * FROM storage.buckets;
CREATE OR REPLACE VIEW public.objects AS SELECT * FROM storage.objects;
CREATE OR REPLACE VIEW public.migrations AS SELECT * FROM storage.migrations;

-- Grant permissions to Supabase roles
GRANT ALL ON public.buckets TO service_role, authenticated, anon;
GRANT ALL ON public.objects TO service_role, authenticated, anon;
GRANT ALL ON public.migrations TO service_role, authenticated, anon;

-- Also grant on underlying storage tables
GRANT ALL ON storage.buckets TO service_role, authenticated, anon;
GRANT ALL ON storage.objects TO service_role, authenticated, anon;
GRANT ALL ON storage.migrations TO service_role, authenticated, anon;

-- ============================================================================
-- PART 2: CoA Reports INSERT Policy
-- ============================================================================
-- Add missing INSERT policy for coa_reports table

CREATE POLICY IF NOT EXISTS coa_reports_insert_authenticated
ON public.coa_reports FOR INSERT
TO public
WITH CHECK (
    get_user_role() IN ('analyst', 'manager')
);

-- Add comment
COMMENT ON POLICY coa_reports_insert_authenticated ON public.coa_reports 
IS 'Allows analysts and managers to insert CoA reports after generating them';
