-- Migration 096: Convert idx_samples_status to partial index
-- Security Impact: None - Performance optimization only
-- Reference: docs/DATABASE_PERFORMANCE_OPTIMIZATION_PLAN.md
--
-- Analysis (2025-12-24):
-- - idx_samples_status exists as FULL index (no WHERE clause)
-- - idx_samples_received_at already partial (created in migration 081)
-- - This migration converts only idx_samples_status to partial
--
-- Expected Impact:
-- - Index size reduction: ~15% (excludes soft-deleted records)
-- - Query performance: ~10% faster (smaller index = faster scans)

SET search_path TO public;

-- ============================================================================
-- Convert idx_samples_status to partial index
-- ============================================================================
-- Current: CREATE INDEX idx_samples_status ON samples(status);
-- New: CREATE INDEX idx_samples_status ON samples(status) WHERE deleted_at IS NULL;

-- Drop old full index
DROP INDEX IF EXISTS idx_samples_status;

-- Create new partial index (excludes soft-deleted samples)
CREATE INDEX idx_samples_status
ON samples(status)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_samples_status IS
'Partial index excluding soft-deleted samples. Reduces index size and improves query performance for active sample status queries.';
