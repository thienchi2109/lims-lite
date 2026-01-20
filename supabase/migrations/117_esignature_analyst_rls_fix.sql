-- Migration 117: Fix RLS policies for analyst e-signature support
-- Security Impact: Critical - Enables analyst access to signature infrastructure
-- 21 CFR Part 11: Required for electronic signature compliance
--
-- Issue: lims-h4x8 (P0 BLOCKING)
-- Context: Current user_signatures and user-signatures storage bucket have
--          RLS policies that only allow managers. This migration extends
--          policies to also allow analysts to manage their own signatures.
--
-- Changes:
--   1. Drop existing manager-only policies on user_signatures table
--   2. Create role-agnostic policies for SELECT, INSERT, UPDATE (manager + analyst)
--   3. Add service role policy for CoA generation (cross-user signature access)
--   4. Document storage bucket policy updates (apply via storage schema migration)

SET search_path TO public;

-- ============================================================================
-- 1. UPDATE user_signatures TABLE RLS POLICIES
-- ============================================================================

-- Drop existing manager-only policies
DROP POLICY IF EXISTS "user_signatures_select_own" ON user_signatures;
DROP POLICY IF EXISTS "user_signatures_insert_own" ON user_signatures;
DROP POLICY IF EXISTS "user_signatures_update_own" ON user_signatures;

-- Also drop any variant names that might exist
DROP POLICY IF EXISTS "Managers can view own signatures" ON user_signatures;
DROP POLICY IF EXISTS "Managers can insert signatures" ON user_signatures;
DROP POLICY IF EXISTS "Managers can update own signatures" ON user_signatures;

-- Create role-agnostic policies (managers AND analysts)
-- These follow the naming convention from the security audit recommendations

-- SELECT: Both managers and analysts can view their own signatures
CREATE POLICY "Users can view own signatures" ON user_signatures
    FOR SELECT USING (
        user_id = auth.uid()
        AND get_user_role() IN ('manager', 'analyst')
    );

-- INSERT: Both managers and analysts can insert their own signatures
CREATE POLICY "Users can insert own signatures" ON user_signatures
    FOR INSERT WITH CHECK (
        user_id = auth.uid()
        AND get_user_role() IN ('manager', 'analyst')
    );

-- UPDATE: Both managers and analysts can update their own signatures
-- (e.g., set is_active to false when uploading new signature)
CREATE POLICY "Users can update own signatures" ON user_signatures
    FOR UPDATE USING (
        user_id = auth.uid()
        AND get_user_role() IN ('manager', 'analyst')
    ) WITH CHECK (
        user_id = auth.uid()
        AND get_user_role() IN ('manager', 'analyst')
    );

-- Service role bypass for CoA generation (cross-user access)
-- This allows the system to read any user's signature when generating CoA
-- Note: service_role already has BYPASSRLS, but explicit policy is clearer
CREATE POLICY "Service role can read all signatures" ON user_signatures
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- Add policy comments for documentation
COMMENT ON POLICY "Users can view own signatures" ON user_signatures
IS 'Analysts and managers can view their own signatures for profile management';

COMMENT ON POLICY "Users can insert own signatures" ON user_signatures
IS 'Analysts and managers can upload their own signatures for 21 CFR Part 11 compliance';

COMMENT ON POLICY "Users can update own signatures" ON user_signatures
IS 'Analysts and managers can update their own signatures (e.g., deactivate old signature)';

COMMENT ON POLICY "Service role can read all signatures" ON user_signatures
IS 'Service role access required for CoA generation to embed performer/approver signature';

-- ============================================================================
-- 2. STORAGE BUCKET POLICIES
-- ============================================================================
-- Storage policies are applied via storage schema
-- These update the existing policies from migration 058

SET search_path TO storage;

-- Drop existing manager-only policies for user-signatures bucket
DROP POLICY IF EXISTS "user_signatures_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "user_signatures_select_own" ON storage.objects;

-- Create new policies that include analysts
-- INSERT: Both managers and analysts can upload their own signatures
CREATE POLICY "user_signatures_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'user-signatures'
        AND public.get_user_role() IN ('manager', 'analyst')
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- SELECT: Both managers and analysts can read their own signatures
CREATE POLICY "user_signatures_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'user-signatures'
        AND public.get_user_role() IN ('manager', 'analyst')
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- Service role can read all signatures (for CoA generation)
DROP POLICY IF EXISTS "user_signatures_service_role_select" ON storage.objects;
CREATE POLICY "user_signatures_service_role_select" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'user-signatures'
        AND auth.jwt() ->> 'role' = 'service_role'
    );

-- Add policy comments
COMMENT ON POLICY "user_signatures_insert_own" ON storage.objects
IS 'Managers and analysts can upload signature files to their own folder only (user-signatures/{user_id}/...)';

COMMENT ON POLICY "user_signatures_select_own" ON storage.objects
IS 'Managers and analysts can read their own signature files';

COMMENT ON POLICY "user_signatures_service_role_select" ON storage.objects
IS 'Service role can read all signature files for CoA generation';

-- Reset search path
SET search_path TO public;

-- ============================================================================
-- 3. VERIFY POLICIES
-- ============================================================================

DO $$
BEGIN
    -- Verify new user_signatures table policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_signatures'
        AND policyname = 'Users can view own signatures'
    ) THEN
        RAISE EXCEPTION 'Critical: user_signatures SELECT policy not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_signatures'
        AND policyname = 'Users can insert own signatures'
    ) THEN
        RAISE EXCEPTION 'Critical: user_signatures INSERT policy not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_signatures'
        AND policyname = 'Users can update own signatures'
    ) THEN
        RAISE EXCEPTION 'Critical: user_signatures UPDATE policy not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'user_signatures'
        AND policyname = 'Service role can read all signatures'
    ) THEN
        RAISE EXCEPTION 'Critical: Service role policy not created';
    END IF;

    RAISE NOTICE 'All user_signatures RLS policies verified successfully';

    -- Verify storage policies exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'user_signatures_insert_own'
    ) THEN
        RAISE EXCEPTION 'Critical: storage INSERT policy not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'user_signatures_select_own'
    ) THEN
        RAISE EXCEPTION 'Critical: storage SELECT policy not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
        AND tablename = 'objects'
        AND policyname = 'user_signatures_service_role_select'
    ) THEN
        RAISE EXCEPTION 'Critical: storage service role SELECT policy not created';
    END IF;

    RAISE NOTICE 'All storage.objects RLS policies verified successfully';
END $$;

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- End of Migration 117
-- ============================================================================
