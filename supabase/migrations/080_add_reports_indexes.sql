-- Migration 080: Add Performance Indexes for Reports Dashboard
-- Security Impact: None - Performance optimization only
-- Changes: Adding missing indexes on results and audit_logs for fast report queries
-- Note: Some indexes already exist (idx_samples_received_at, idx_samples_status_received, idx_results_created_at)

SET search_path TO public;

-- ============================================================================
-- Note: The following indexes ALREADY EXIST and do not need to be created:
-- - idx_samples_received_at (samples.received_at WHERE deleted_at IS NULL)
-- - idx_samples_status_received (samples.status, received_at WHERE deleted_at IS NULL)
-- - idx_results_created_at (results.created_at)
-- ============================================================================

-- ============================================================================
-- Index 1: audit_logs(changed_at, table_name) - For error rate calculations
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at_results
ON audit_logs(changed_at, table_name)
WHERE table_name = 'results';

COMMENT ON INDEX idx_audit_logs_changed_at_results IS 'Partial index for result modification tracking. Optimizes get_error_rate_metrics() by filtering audit logs for results table only. LIMS best practice for <500ms query times.';

-- ============================================================================
-- Index 2: results.entered_by (for staff productivity queries)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_results_entered_by
ON results(entered_by);

COMMENT ON INDEX idx_results_entered_by IS 'Performance index for analyst productivity tracking. Used in get_staff_productivity() to aggregate tests completed per analyst.';

-- ============================================================================
-- Index 3: results(approved_at) - For TAT calculations
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_results_approved_at
ON results(approved_at)
WHERE approved_at IS NOT NULL;

COMMENT ON INDEX idx_results_approved_at IS 'Partial index for approved results. Optimizes calculate_average_tat() by filtering only approved results for TAT calculations.';

-- ============================================================================
-- Verification: EXPLAIN ANALYZE will be run manually after applying migration
-- Target: All RPC functions should execute in <500ms with 100k sample dataset
-- Run: docker exec lims-postgres psql -U postgres -d postgres -c "EXPLAIN ANALYZE SELECT * FROM calculate_average_tat(NOW() - INTERVAL '30 days', NOW());"
-- ============================================================================
