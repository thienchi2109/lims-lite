-- Migration 055: Add CoA Reports and Access Log Tables
-- Description: Create tables for Certificate of Analysis (CoA) generation and access tracking
-- Security Impact: Medium (new public-facing authentication vector)
-- Related: openspec/changes/add-coa-generation-and-access/

SET search_path TO public;

-- ============================================================================
-- 1. Create coa_reports table
-- ============================================================================

CREATE TABLE IF NOT EXISTS coa_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sample_id UUID NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL, -- SHA-256 hash for integrity verification
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ready', 'failed')),
    superseded_by UUID NULL REFERENCES coa_reports(id), -- For amendment trail
    error_message TEXT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL -- Soft delete for retention policy
);

-- Add comment explaining the table
COMMENT ON TABLE coa_reports IS 'Stores metadata for Certificate of Analysis HTML files';
COMMENT ON COLUMN coa_reports.file_hash IS 'SHA-256 hash of HTML content for integrity verification';
COMMENT ON COLUMN coa_reports.version IS 'Version number, increments for amendments';
COMMENT ON COLUMN coa_reports.superseded_by IS 'Links to newer version if this report was amended';
COMMENT ON COLUMN coa_reports.deleted_at IS 'Soft delete timestamp for retention policy (2 years minimum)';

-- ============================================================================
-- 2. Create coa_access_log table
-- ============================================================================

CREATE TABLE IF NOT EXISTS coa_access_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NULL REFERENCES clients(id), -- Nullable for failed auth attempts
    sample_id UUID NULL REFERENCES samples(id),
    coa_report_id UUID NULL REFERENCES coa_reports(id),
    accessed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ip_address TEXT NULL,
    user_agent TEXT NULL,
    success BOOLEAN NOT NULL,
    failure_reason TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at TIMESTAMPTZ NULL
);

-- Add comment explaining the table
COMMENT ON TABLE coa_access_log IS 'Audit log for all CoA access attempts (success and failure)';
COMMENT ON COLUMN coa_access_log.success IS 'True if authentication/download succeeded';
COMMENT ON COLUMN coa_access_log.failure_reason IS 'Error message for failed attempts (generic for security)';

-- ============================================================================
-- 3. Create indexes
-- ============================================================================

-- coa_reports indexes
CREATE INDEX IF NOT EXISTS idx_coa_reports_sample_id
    ON coa_reports(sample_id) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coa_reports_version
    ON coa_reports(sample_id, version) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coa_reports_status
    ON coa_reports(status) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coa_reports_generated_at
    ON coa_reports(generated_at) WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_coa_reports_superseded_by
    ON coa_reports(superseded_by) WHERE superseded_by IS NOT NULL;

-- coa_access_log indexes
CREATE INDEX IF NOT EXISTS idx_coa_access_log_client_id
    ON coa_access_log(client_id);

CREATE INDEX IF NOT EXISTS idx_coa_access_log_sample_id
    ON coa_access_log(sample_id);

CREATE INDEX IF NOT EXISTS idx_coa_access_log_accessed_at
    ON coa_access_log(accessed_at);

CREATE INDEX IF NOT EXISTS idx_coa_access_log_ip_address
    ON coa_access_log(ip_address, accessed_at) WHERE success = false;

CREATE INDEX IF NOT EXISTS idx_coa_access_log_coa_report_id
    ON coa_access_log(coa_report_id);

-- ============================================================================
-- 4. Create audit triggers
-- ============================================================================

-- Trigger for coa_reports
DROP TRIGGER IF EXISTS audit_coa_reports_trigger ON coa_reports;
CREATE TRIGGER audit_coa_reports_trigger
    AFTER INSERT OR UPDATE OR DELETE ON coa_reports
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- Trigger for coa_access_log
DROP TRIGGER IF EXISTS audit_coa_access_log_trigger ON coa_access_log;
CREATE TRIGGER audit_coa_access_log_trigger
    AFTER INSERT OR UPDATE OR DELETE ON coa_access_log
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

-- ============================================================================
-- 5. Enable Row Level Security (RLS)
-- ============================================================================

ALTER TABLE coa_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE coa_access_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 6. Create RLS Policies for coa_reports
-- ============================================================================

-- SELECT: Authenticated staff (analysts and managers)
DROP POLICY IF EXISTS "coa_reports_select_authenticated" ON coa_reports;
CREATE POLICY "coa_reports_select_authenticated"
ON coa_reports FOR SELECT
USING (
    get_user_role() IN ('analyst', 'manager')
);

-- INSERT: Service role only (server actions bypass RLS)
-- No policy needed - service role bypasses RLS

-- UPDATE: Managers can update failed status for retry
DROP POLICY IF EXISTS "coa_reports_update_managers" ON coa_reports;
CREATE POLICY "coa_reports_update_managers"
ON coa_reports FOR UPDATE
USING (
    get_user_role() = 'manager'
    AND status = 'failed'
)
WITH CHECK (
    get_user_role() = 'manager'
    AND status IN ('pending', 'ready', 'failed')
);

-- DELETE: Deny all (use soft delete via deleted_at)
-- No policy = deny by default

COMMENT ON POLICY "coa_reports_select_authenticated" ON coa_reports
IS 'Analysts and managers can view all CoA records';

COMMENT ON POLICY "coa_reports_update_managers" ON coa_reports
IS 'Managers can update failed CoA status for retry';

-- ============================================================================
-- 7. Create RLS Policies for coa_access_log
-- ============================================================================

-- SELECT: Managers only (audit log viewer)
DROP POLICY IF EXISTS "coa_access_log_select_managers" ON coa_access_log;
CREATE POLICY "coa_access_log_select_managers"
ON coa_access_log FOR SELECT
USING (
    get_user_role() = 'manager'
);

-- INSERT: Service role only (server actions bypass RLS)
-- No policy needed - service role bypasses RLS

-- UPDATE/DELETE: Deny all (audit logs are immutable)
-- No policy = deny by default

COMMENT ON POLICY "coa_access_log_select_managers" ON coa_access_log
IS 'Only managers can view audit logs';

-- ============================================================================
-- 8. Create trigger function for CoA generation on sample approval
-- ============================================================================

-- Note: This trigger will call a server action (not direct SQL generation)
-- The actual HTML generation will be done in Next.js server action
-- This function will insert a 'pending' record that the server action will pick up

CREATE OR REPLACE FUNCTION trigger_generate_coa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only generate CoA when sample status changes to 'approved'
    -- and no existing CoA record exists for this sample
    IF NEW.status = 'approved'
       AND (OLD.status IS NULL OR OLD.status != 'approved')
       AND NOT EXISTS (
           SELECT 1 FROM coa_reports
           WHERE sample_id = NEW.id
           AND deleted_at IS NULL
       )
    THEN
        -- Insert pending CoA record
        -- Server action will pick this up and generate HTML
        INSERT INTO coa_reports (
            sample_id,
            file_path,
            file_hash,
            version,
            status
        ) VALUES (
            NEW.id,
            '', -- Will be populated by server action
            '', -- Will be populated by server action
            1,
            'pending'
        );

        RAISE NOTICE 'CoA generation queued for sample %', NEW.sample_id;
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION trigger_generate_coa()
IS 'Queues CoA generation when sample is approved (server action will process)';

-- ============================================================================
-- 9. Attach trigger to samples table
-- ============================================================================

DROP TRIGGER IF EXISTS trigger_generate_coa_on_approval ON samples;
CREATE TRIGGER trigger_generate_coa_on_approval
    AFTER INSERT OR UPDATE OF status ON samples
    FOR EACH ROW
    EXECUTE FUNCTION trigger_generate_coa();

COMMENT ON TRIGGER trigger_generate_coa_on_approval ON samples
IS 'Automatically queues CoA generation when sample status changes to approved';

-- ============================================================================
-- 10. Grant permissions
-- ============================================================================

-- Grant SELECT to authenticated users (RLS will further restrict)
GRANT SELECT ON coa_reports TO authenticated;
GRANT SELECT ON coa_access_log TO authenticated;

-- Grant UPDATE on coa_reports to authenticated (RLS will restrict to managers)
GRANT UPDATE ON coa_reports TO authenticated;

-- Service role will use INSERT via server actions (bypasses RLS)

-- ============================================================================
-- 11. Add constraints for data integrity
-- ============================================================================

-- Ensure file_hash is not empty when status is 'ready'
ALTER TABLE coa_reports
ADD CONSTRAINT check_file_hash_on_ready
CHECK (
    status != 'ready' OR (file_hash IS NOT NULL AND file_hash != '')
);

-- Ensure file_path is not empty when status is 'ready'
ALTER TABLE coa_reports
ADD CONSTRAINT check_file_path_on_ready
CHECK (
    status != 'ready' OR (file_path IS NOT NULL AND file_path != '')
);

-- Ensure error_message is provided when status is 'failed'
ALTER TABLE coa_reports
ADD CONSTRAINT check_error_message_on_failed
CHECK (
    status != 'failed' OR (error_message IS NOT NULL AND error_message != '')
);

-- Ensure version is positive
ALTER TABLE coa_reports
ADD CONSTRAINT check_version_positive
CHECK (version > 0);

-- Ensure unique (sample_id, version) combination
CREATE UNIQUE INDEX IF NOT EXISTS idx_coa_reports_sample_version_unique
ON coa_reports(sample_id, version)
WHERE deleted_at IS NULL;

-- ============================================================================
-- End of Migration 055
-- ============================================================================
