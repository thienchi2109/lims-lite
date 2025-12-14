-- Migration 058: Create User Signatures Storage Bucket
-- Description: Create storage bucket for manager e-signature images with RLS policies
-- Security Impact: Medium (new file upload vector with validation)
-- Related: openspec/changes/add-coa-generation-and-access/phase3.5-e-signature-tasks.md

SET search_path TO storage;

-- ============================================================================
-- 1. Create storage bucket
-- ============================================================================

-- Insert bucket into storage.buckets table
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'user-signatures',
    'user-signatures',
    false,  -- Private bucket (managers access own signatures only)
    512000,  -- 500KB file size limit
    ARRAY['image/png', 'image/jpeg']::text[]  -- Only PNG and JPEG allowed
)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE storage.buckets IS 'Storage buckets configuration';

-- ============================================================================
-- 2. Enable Row Level Security on storage.objects
-- ============================================================================

-- RLS should already be enabled on storage.objects, but verify
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 3. Create RLS Policies for user-signatures bucket
-- ============================================================================

-- DROP existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "user_signatures_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_select_own" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_update_deny" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_delete_deny" ON storage.objects;

-- INSERT: Managers can upload their own signatures only
-- Path must be: user-signatures/{user_id}/{filename}
CREATE POLICY "user_signatures_insert_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'user-signatures'
    AND public.get_user_role() = 'manager'
    AND (storage.foldername(name))[1] = auth.uid()::text  -- First folder must be user's UUID
);

-- SELECT: Managers can read their own signatures
-- Service role can read all signatures (for CoA generation)
CREATE POLICY "user_signatures_select_own"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'user-signatures'
    AND public.get_user_role() = 'manager'
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- UPDATE: Deny all (signature files are immutable - use is_active flag instead)
-- No policy = deny by default for UPDATE

-- DELETE: Deny all (use soft delete in user_signatures table instead)
-- No policy = deny by default for DELETE

COMMENT ON POLICY "user_signatures_insert_own" ON storage.objects
IS 'Managers can upload signature files to their own folder only (user-signatures/{user_id}/...)';

COMMENT ON POLICY "user_signatures_select_own" ON storage.objects
IS 'Managers can read their own signature files; service role reads all for CoA generation';

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
-- Run after migration: SELECT * FROM storage.buckets WHERE id = 'user-signatures';

-- ============================================================================
-- End of Migration 058
-- ============================================================================
