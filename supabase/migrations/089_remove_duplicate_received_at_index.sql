-- Migration 089: Remove Duplicate Index on samples.received_at
-- Security Impact: None - Performance optimization (removes duplicate index)
-- Changes: Drops duplicate index idx_samples_received_at_not_deleted, keeps idx_samples_received_at
-- Reason: Both indexes are identical - btree(received_at) WHERE deleted_at IS NULL

SET search_path TO public;

-- ============================================================================
-- Drop Duplicate Index
-- ============================================================================

-- Both indexes are functionally identical:
-- - idx_samples_received_at (created earlier, keeping this one)
-- - idx_samples_received_at_not_deleted (created in migration 083, dropping this one)

-- Drop the duplicate index
-- Note: For zero-downtime in production, use DROP INDEX CONCURRENTLY
DROP INDEX IF EXISTS idx_samples_received_at_not_deleted;

-- Keep the original index with same definition
-- No action needed - idx_samples_received_at already exists

-- ============================================================================
-- Verification
-- ============================================================================

-- After migration, verify only one index exists:
-- SELECT indexname, indexdef FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'samples' AND indexname LIKE '%received_at%';

-- Expected result: Only idx_samples_received_at should remain

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON INDEX idx_samples_received_at IS 'Performance index for date range queries on samples. Partial index excludes soft-deleted samples (deleted_at IS NULL). Used by: get_sample_accession_trend(), get_samples_by_status(), dashboard queries.';
