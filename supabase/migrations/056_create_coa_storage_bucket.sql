-- Migration 056: Create CoA Storage Bucket
-- Description: Create storage bucket for Certificate of Analysis HTML files with RLS policies
-- Security Impact: Medium (new public-facing storage with signed URL access)
-- Related: openspec/changes/add-coa-generation-and-access/

SET search_path TO storage;

-- ============================================================================
-- 1. Create storage bucket
-- ============================================================================

-- Insert bucket into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'coa-reports',
    'coa-reports',
    false,  -- Private bucket (access via signed URLs only)
    10485760,  -- 10MB file size limit (generous for HTML files)
    ARRAY['text/html']::text[]  -- Only allow HTML files
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE storage.buckets IS 'Storage buckets configuration';

-- ============================================================================
-- 2. Enable Row Level Security on storage.objects
-- ============================================================================

-- RLS should already be enabled on storage.objects, but verify
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Create RLS Policies for coa-reports bucket
-- ============================================================================

-- DROP existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "coa_storage_insert_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "coa_storage_select_authenticated" ON storage.objects;
DROP POLICY IF EXISTS "coa_storage_update_deny" ON storage.objects;
DROP POLICY IF EXISTS "coa_storage_delete_deny" ON storage.objects;

-- INSERT: Authenticated users with analyst or manager role can upload
CREATE POLICY "coa_storage_insert_authenticated"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'coa-reports'
    AND public.get_user_role() IN ('analyst', 'manager')
    AND (storage.foldername(name))[1] IS NOT NULL  -- Ensure folder structure (sample_id folder)
);

-- SELECT: Authenticated staff can read all files, public can read via signed URLs
-- Note: Signed URLs are handled by Supabase Storage API automatically
CREATE POLICY "coa_storage_select_authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'coa-reports'
    AND public.get_user_role() IN ('analyst', 'manager')
);

-- UPDATE: Deny all (CoA files are immutable)
-- No policy = deny by default for UPDATE

-- DELETE: Deny all (use soft delete in coa_reports table instead)
-- No policy = deny by default for DELETE

COMMENT ON POLICY "coa_storage_insert_authenticated" ON storage.objects
IS 'Analysts and managers can upload CoA HTML files to coa-reports bucket';

COMMENT ON POLICY "coa_storage_select_authenticated" ON storage.objects
IS 'Authenticated staff can read CoA files; public access via signed URLs handled by Supabase API';

-- ============================================================================
-- 4. Grant permissions
-- ============================================================================

-- Grant usage on storage schema to authenticated users
GRANT USAGE ON SCHEMA storage TO authenticated;

-- Grant SELECT on buckets table to authenticated users
GRANT SELECT ON storage.buckets TO authenticated;

-- Grant SELECT, INSERT on objects table to authenticated users (RLS will restrict)
GRANT SELECT, INSERT ON storage.objects TO authenticated;

-- ============================================================================
-- 5. Verify bucket configuration
-- ============================================================================

-- Query to verify bucket was created
-- Run after migration: SELECT * FROM storage.buckets WHERE id = 'coa-reports';

-- ============================================================================
-- End of Migration 056
-- ============================================================================
