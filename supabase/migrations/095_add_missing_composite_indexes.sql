-- Migration 095: Add missing composite indexes for performance optimization
-- Security Impact: None - Performance optimization only
-- Reference: docs/DATABASE_PERFORMANCE_OPTIMIZATION_PLAN.md
--
-- Analysis (2025-12-24):
-- - idx_samples_status_received_at already exists as idx_samples_status_received (migration 081)
-- - idx_results_entered_by_created_at already exists as idx_results_entered_by_created (migration 081)
-- - This migration adds only the 3 MISSING composite indexes

SET search_path TO public;

-- ============================================================================
-- Composite Index 1: samples(received_by, status) for analyst workload queries
-- ============================================================================
-- Use Case: Analyst dashboard, workload distribution, "My Samples" views
-- Query Pattern: WHERE received_by = ? AND status IN (?) AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_samples_received_by_status
ON samples(received_by, status)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_samples_received_by_status IS
'Composite index for analyst workload queries. Optimizes "My Samples" dashboard views.';

-- ============================================================================
-- Composite Index 2: results(sample_id, status) for batch result queries
-- ============================================================================
-- Use Case: Sample detail page, test assignment verification
-- Query Pattern: WHERE sample_id = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_results_sample_status
ON results(sample_id, status);

COMMENT ON INDEX idx_results_sample_status IS
'Composite index for sample-specific result queries with status filter. Reduces query time from O(n) to O(log n).';

-- ============================================================================
-- Composite Index 3: coa_reports(sample_id, generated_at) for CoA queries
-- ============================================================================
-- Use Case: get_coa_statistics(), CoA generation status checks
-- Query Pattern: WHERE sample_id = ? AND generated_at IS NOT NULL AND deleted_at IS NULL
CREATE INDEX IF NOT EXISTS idx_coa_reports_sample_generated
ON coa_reports(sample_id, generated_at)
WHERE deleted_at IS NULL;

COMMENT ON INDEX idx_coa_reports_sample_generated IS
'Composite index for CoA existence checks. Optimizes get_coa_statistics() and CoA status queries.';
