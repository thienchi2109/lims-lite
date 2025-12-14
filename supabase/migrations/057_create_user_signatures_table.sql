-- Migration 057: Create User Signatures Table
-- Description: Create table for manager e-signatures with version tracking and integrity verification
-- Security Impact: Medium (new manager-facing feature with file upload)
-- Related: openspec/changes/add-coa-generation-and-access/phase3.5-e-signature-tasks.md

SET search_path TO public;

-- ============================================================================
-- 1. Create user_signatures table
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_signatures (
    id UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    signature_path TEXT NOT NULL,  -- Storage path: user-signatures/{user_id}/{timestamp}.png
    signature_hash TEXT NOT NULL,  -- SHA-256 hash for integrity verification
    file_size INT NOT NULL,  -- File size in bytes
    mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg')),
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN DEFAULT true,  -- Only one active signature per user
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL  -- Soft delete for audit trail
);

-- Add comments explaining the table
COMMENT ON TABLE user_signatures IS 'Stores manager e-signature images with version tracking for 21 CFR Part 11 compliance';
COMMENT ON COLUMN user_signatures.signature_hash IS 'SHA-256 hash of signature file for integrity verification';
COMMENT ON COLUMN user_signatures.is_active IS 'Only one signature can be active per user at a time';
COMMENT ON COLUMN user_signatures.deleted_at IS 'Soft delete timestamp - preserves signature history for audit trail';

-- ============================================================================
-- 2. Add signature reference to coa_reports table
-- ============================================================================

ALTER TABLE coa_reports
ADD COLUMN IF NOT EXISTS signature_id UUID REFERENCES user_signatures(id);

COMMENT ON COLUMN coa_reports.signature_id IS 'Links to exact signature version used for approval (21 CFR Part 11 compliance)';

-- ============================================================================
-- 3. Create indexes
-- ============================================================================

-- Index on user_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_user_signatures_user_id
ON user_signatures(user_id) WHERE deleted_at IS NULL;

-- Index on active signatures
CREATE INDEX IF NOT EXISTS idx_user_signatures_is_active
ON user_signatures(user_id, is_active) WHERE is_active = true AND deleted_at IS NULL;

-- Index on uploaded_at for history queries
CREATE INDEX IF NOT EXISTS idx_user_signatures_uploaded_at
ON user_signatures(uploaded_at DESC) WHERE deleted_at IS NULL;

-- Index on signature_id in coa_reports
CREATE INDEX IF NOT EXISTS idx_coa_reports_signature_id
ON coa_reports(signature_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- 4. Create unique constraint
-- ============================================================================

-- Ensure only one active signature per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_signatures_active_unique
ON user_signatures(user_id)
WHERE is_active = true AND deleted_at IS NULL;

-- ============================================================================
-- 5. Add data integrity constraints
-- ============================================================================

-- File size must be positive and under 500KB
ALTER TABLE user_signatures
ADD CONSTRAINT check_signature_file_size
CHECK (file_size > 0 AND file_size <= 512000);  -- 500KB = 512000 bytes

-- Signature hash must not be empty
ALTER TABLE user_signatures
ADD CONSTRAINT check_signature_hash_not_empty
CHECK (signature_hash IS NOT NULL AND signature_hash != '');

-- Signature path must not be empty
ALTER TABLE user_signatures
ADD CONSTRAINT check_signature_path_not_empty
CHECK (signature_path IS NOT NULL AND signature_path != '');

-- ============================================================================
-- 6. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE user_signatures ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. Create RLS Policies for user_signatures
-- ============================================================================

-- SELECT: Managers can view their own signatures, analysts cannot view any
DROP POLICY IF EXISTS "user_signatures_select_own" ON user_signatures;
CREATE POLICY "user_signatures_select_own"
ON user_signatures FOR SELECT
USING (
    get_user_role() = 'manager'
    AND user_id = auth.uid()
);

-- INSERT: Managers can insert their own signatures only
DROP POLICY IF EXISTS "user_signatures_insert_own" ON user_signatures;
CREATE POLICY "user_signatures_insert_own"
ON user_signatures FOR INSERT
WITH CHECK (
    get_user_role() = 'manager'
    AND user_id = auth.uid()
);

-- UPDATE: Managers can update their own signatures (e.g., set is_active to false)
DROP POLICY IF EXISTS "user_signatures_update_own" ON user_signatures;
CREATE POLICY "user_signatures_update_own"
ON user_signatures FOR UPDATE
USING (
    get_user_role() = 'manager'
    AND user_id = auth.uid()
)
WITH CHECK (
    get_user_role() = 'manager'
    AND user_id = auth.uid()
);

-- DELETE: Deny all (use soft delete via deleted_at instead)
-- No policy = deny by default

COMMENT ON POLICY "user_signatures_select_own" ON user_signatures
IS 'Managers can view only their own signature history';

COMMENT ON POLICY "user_signatures_insert_own" ON user_signatures
IS 'Managers can upload their own signatures only';

COMMENT ON POLICY "user_signatures_update_own" ON user_signatures
IS 'Managers can update their own signatures (e.g., deactivate old signature)';

-- ============================================================================
-- 8. Create audit trigger
-- ============================================================================

DROP TRIGGER IF EXISTS audit_user_signatures_trigger ON user_signatures;
CREATE TRIGGER audit_user_signatures_trigger
    AFTER INSERT OR UPDATE OR DELETE ON user_signatures
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

COMMENT ON TRIGGER audit_user_signatures_trigger ON user_signatures
IS 'Audit log for all signature uploads, updates, and soft deletes';

-- ============================================================================
-- 9. Grant permissions
-- ============================================================================

-- Grant SELECT, INSERT, UPDATE to authenticated users (RLS will further restrict)
GRANT SELECT ON user_signatures TO authenticated;
GRANT INSERT ON user_signatures TO authenticated;
GRANT UPDATE ON user_signatures TO authenticated;

-- ============================================================================
-- 10. Create helper function to get active signature
-- ============================================================================

CREATE OR REPLACE FUNCTION get_active_signature(p_user_id UUID)
RETURNS TABLE (
    signature_id UUID,
    signature_path TEXT,
    signature_hash TEXT,
    mime_type TEXT,
    uploaded_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        id,
        user_signatures.signature_path,
        signature_hash,
        user_signatures.mime_type,
        uploaded_at
    FROM user_signatures
    WHERE user_id = p_user_id
      AND is_active = true
      AND deleted_at IS NULL
    LIMIT 1;
END;
$$;

COMMENT ON FUNCTION get_active_signature(UUID)
IS 'Retrieves the active signature for a given user (used in CoA generation)';

GRANT EXECUTE ON FUNCTION get_active_signature(UUID) TO authenticated;

-- ============================================================================
-- End of Migration 057
-- ============================================================================
