-- Migration 122: Add composite partial index for approval queue reads
-- Security Impact: Low - read-performance only; no change to RLS policies, grants, or policy semantics
-- Purpose: Support approval queue queries that filter by status and sort by updated_at DESC on active samples

SET search_path TO public;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_samples_status_updated_at_not_deleted
ON samples(status, updated_at DESC)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_samples_status_updated_at_not_deleted IS
'Composite partial index for approval queue read paths. Improves status-filtered, updated_at DESC scans on active samples only. Security impact: read-performance only; does not change RLS policy semantics.';
