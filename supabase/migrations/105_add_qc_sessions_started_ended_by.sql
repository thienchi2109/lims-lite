-- Migration: Add started_by and ended_by columns to qc_sessions
-- Description: Adds columns to track who started and ended QC sessions
-- Issue: Code uses started_by/ended_by but table only has created_by

-- ============================================================================
-- ADD COLUMNS
-- ============================================================================

-- Add started_by column (who started the session)
ALTER TABLE qc_sessions
ADD COLUMN IF NOT EXISTS started_by UUID REFERENCES users(id);

-- Add ended_by column (who ended the session)
ALTER TABLE qc_sessions
ADD COLUMN IF NOT EXISTS ended_by UUID REFERENCES users(id);

-- ============================================================================
-- BACKFILL EXISTING DATA
-- ============================================================================

-- For existing sessions, use created_by as started_by
UPDATE qc_sessions
SET started_by = created_by
WHERE started_by IS NULL AND created_by IS NOT NULL;

-- ============================================================================
-- ADD INDEXES FOR FOREIGN KEY LOOKUPS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_qc_sessions_started_by ON qc_sessions(started_by);
CREATE INDEX IF NOT EXISTS idx_qc_sessions_ended_by ON qc_sessions(ended_by);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON COLUMN qc_sessions.started_by IS 'User who started this QC session';
COMMENT ON COLUMN qc_sessions.ended_by IS 'User who ended this QC session';
