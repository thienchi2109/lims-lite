-- Migration 081: Fix Critical Issues in Reports Dashboard
-- Security Impact: Medium - Fixes RLS policy alignment and calculation accuracy
-- Changes:
--   1. Add transition timestamp columns (completed_at, review_started_at)
--   2. Create triggers to track status transitions
--   3. Fix RPC function calculations to use explicit timestamps
--   4. Optimize indexes based on actual query patterns
--   5. Fix workflow ordering to include 'discarded' status
--
-- Codex Review Findings:
--   - TAT calculation using updated_at (any edit inflates TAT) → use completed_at
--   - Approval queue using updated_at (metadata changes reset clock) → use review_started_at
--   - Error rate mixing windows and RLS policies → align windows, count value changes
--   - Missing composite indexes → add proper indexes for query patterns
--   - Missing 'discarded' status in ordering → add to CASE statement

SET search_path TO public;

-- ============================================================================
-- STEP 1: Add Transition Timestamp Columns
-- ============================================================================

-- Add completed_at column to track when sample reaches 'completed' status
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

COMMENT ON COLUMN samples.completed_at IS 'Timestamp when sample status changed to completed. Used for accurate TAT calculations. Populated by trigger.';

-- Add review_started_at column to track when sample enters 'review' status
ALTER TABLE samples
ADD COLUMN IF NOT EXISTS review_started_at TIMESTAMPTZ;

COMMENT ON COLUMN samples.review_started_at IS 'Timestamp when sample status changed to review. Used for approval queue wait time calculations. Populated by trigger.';

-- ============================================================================
-- STEP 2: Create Trigger to Track Status Transitions
-- ============================================================================

CREATE OR REPLACE FUNCTION track_sample_status_transitions()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Track when sample enters 'review' status
  IF NEW.status = 'review' AND (OLD.status IS NULL OR OLD.status != 'review') THEN
    NEW.review_started_at := CURRENT_TIMESTAMP;
  END IF;

  -- Track when sample reaches 'completed' status
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    NEW.completed_at := CURRENT_TIMESTAMP;
  END IF;

  -- Reset review_started_at if sample moves out of review
  IF OLD.status = 'review' AND NEW.status != 'review' AND NEW.status != 'completed' THEN
    NEW.review_started_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION track_sample_status_transitions IS 'Trigger function to automatically populate completed_at and review_started_at timestamps when sample status changes. Critical for accurate TAT and queue metrics.';

-- Create trigger
DROP TRIGGER IF EXISTS track_status_transitions ON samples;

CREATE TRIGGER track_status_transitions
BEFORE INSERT OR UPDATE OF status ON samples
FOR EACH ROW
EXECUTE FUNCTION track_sample_status_transitions();

-- ============================================================================
-- STEP 3: Backfill Existing Data from Audit Logs
-- ============================================================================

-- Backfill completed_at for existing completed samples
-- Use audit logs to find when status changed to 'completed', fallback to updated_at
UPDATE samples s
SET completed_at = COALESCE(
  (
    SELECT al.changed_at
    FROM audit_logs al
    WHERE al.table_name = 'samples'
      AND al.record_id = s.id
      AND al.operation = 'UPDATE'
      AND al.new_values::jsonb->>'status' = 'completed'
      AND al.old_values::jsonb->>'status' != 'completed'
    ORDER BY al.changed_at ASC
    LIMIT 1
  ),
  s.updated_at  -- Fallback if no audit log found
)
WHERE s.status = 'completed'
  AND s.completed_at IS NULL;

-- Backfill review_started_at for existing samples in review status
UPDATE samples s
SET review_started_at = COALESCE(
  (
    SELECT al.changed_at
    FROM audit_logs al
    WHERE al.table_name = 'samples'
      AND al.record_id = s.id
      AND al.operation = 'UPDATE'
      AND al.new_values::jsonb->>'status' = 'review'
      AND al.old_values::jsonb->>'status' != 'review'
    ORDER BY al.changed_at DESC
    LIMIT 1
  ),
  s.updated_at  -- Fallback if no audit log found
)
WHERE s.status = 'review'
  AND s.review_started_at IS NULL;

-- ============================================================================
-- STEP 4: Drop Incorrect Index
-- ============================================================================

-- Drop idx_results_approved_at - it was targeting wrong table for TAT calculation
DROP INDEX IF EXISTS idx_results_approved_at;

-- ============================================================================
-- STEP 5: Add Optimized Indexes Based on Query Patterns
-- ============================================================================

-- Index 1: Composite index for TAT calculations
CREATE INDEX IF NOT EXISTS idx_samples_completed_at
ON samples(completed_at, status)
WHERE deleted_at IS NULL AND completed_at IS NOT NULL;

COMMENT ON INDEX idx_samples_completed_at IS 'Composite index for calculate_average_tat(). Optimizes queries filtering by completed_at date range and status=completed.';

-- Index 2: Composite index for staff productivity
CREATE INDEX IF NOT EXISTS idx_results_entered_by_created
ON results(entered_by, created_at)
WHERE entered_by IS NOT NULL;

COMMENT ON INDEX idx_results_entered_by_created IS 'Composite index for get_staff_productivity(). Optimizes aggregation by analyst with date range filtering.';

-- Index 3: Partial index for audit log productivity queries
DROP INDEX IF EXISTS idx_audit_logs_changed_at_results;

CREATE INDEX IF NOT EXISTS idx_audit_logs_productivity
ON audit_logs(changed_by, changed_at, operation)
WHERE table_name = 'results' AND operation = 'UPDATE';

COMMENT ON INDEX idx_audit_logs_productivity IS 'Composite partial index for get_staff_productivity(). Optimizes filtering by analyst, date range, and operation type for results table only.';

-- Index 4: Index for review queue queries
CREATE INDEX IF NOT EXISTS idx_samples_review_started
ON samples(review_started_at, status)
WHERE status = 'review' AND deleted_at IS NULL;

COMMENT ON INDEX idx_samples_review_started IS 'Partial index for get_approval_queue_metrics(). Optimizes filtering samples in review status by review_started_at timestamp.';

-- ============================================================================
-- STEP 6: Fix RPC Functions
-- ============================================================================

-- Fix Function 1: Calculate Average TAT using completed_at
CREATE OR REPLACE FUNCTION calculate_average_tat(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  avg_tat_hours NUMERIC,
  median_tat_hours NUMERIC,
  sample_count BIGINT,
  on_time_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- TAT = Time from sample receipt (received_at) to completion (completed_at)
  -- completed_at is now explicitly tracked via trigger, not affected by post-completion edits
  RETURN QUERY
  SELECT
    AVG(EXTRACT(EPOCH FROM (completed_at - received_at))/3600)::NUMERIC(10,2) as avg_tat_hours,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (completed_at - received_at))/3600)::NUMERIC(10,2) as median_tat_hours,
    COUNT(*)::BIGINT as sample_count,
    COUNT(*) FILTER (WHERE (completed_at - received_at) <= INTERVAL '72 hours')::BIGINT as on_time_count
  FROM samples
  WHERE status = 'completed'
    AND completed_at BETWEEN start_date AND end_date
    AND completed_at IS NOT NULL
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION calculate_average_tat IS 'Calculate average and median TAT with on-time delivery count. Uses completed_at timestamp (not updated_at) to avoid inflation from post-completion edits. FIXED: Migration 081.';

-- Fix Function 3: Get Approval Queue Metrics using review_started_at
CREATE OR REPLACE FUNCTION get_approval_queue_metrics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  pending_count BIGINT,
  avg_wait_hours NUMERIC,
  overdue_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COUNT(*)::BIGINT as pending_count,
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - review_started_at))/3600)::NUMERIC(10,2) as avg_wait_hours,
    COUNT(*) FILTER (WHERE (CURRENT_TIMESTAMP - review_started_at) > INTERVAL '24 hours')::BIGINT as overdue_count
  FROM samples
  WHERE status = 'review'
    AND received_at BETWEEN start_date AND end_date
    AND review_started_at IS NOT NULL
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION get_approval_queue_metrics IS 'Get pending approval metrics using review_started_at timestamp (not updated_at) to avoid reset from metadata changes. Alert threshold: >20 samples OR avg wait >24 hours. FIXED: Migration 081.';

-- Fix Function 4: Get Error Rate Metrics with aligned windows
CREATE OR REPLACE FUNCTION get_error_rate_metrics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  error_rate NUMERIC,
  total_modifications BIGINT,
  total_results BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total_results BIGINT;
  v_total_modifications BIGINT;
BEGIN
  -- Count total results created in date range
  SELECT COUNT(*)
  INTO v_total_results
  FROM results
  WHERE created_at BETWEEN start_date AND end_date;

  -- Count result VALUE modifications (exclude status changes) for results created in same window
  -- This aligns numerator and denominator windows and focuses on data corrections
  SELECT COUNT(DISTINCT al.id)
  INTO v_total_modifications
  FROM audit_logs al
  INNER JOIN results r ON r.id = al.record_id
  WHERE al.table_name = 'results'
    AND al.operation = 'UPDATE'
    AND al.changed_at BETWEEN start_date AND end_date
    AND r.created_at BETWEEN start_date AND end_date  -- Align windows
    -- Count only value changes, exclude approval workflow (status changes)
    AND (
      al.old_values::jsonb->>'value' IS DISTINCT FROM al.new_values::jsonb->>'value'
    );

  -- Calculate error rate
  RETURN QUERY
  SELECT
    CASE
      WHEN v_total_results > 0 THEN (v_total_modifications::NUMERIC / v_total_results * 100)::NUMERIC(10,2)
      ELSE 0::NUMERIC(10,2)
    END as error_rate,
    v_total_modifications,
    v_total_results;
END;
$$;

COMMENT ON FUNCTION get_error_rate_metrics IS 'Calculate error rate counting VALUE modifications (not status changes) with aligned windows. Both numerator and denominator use same date range for consistency. ISO 17025 compliance metric. FIXED: Migration 081.';

-- Fix Function 2: Get Samples by Status with 'discarded' ordering
CREATE OR REPLACE FUNCTION get_samples_by_status(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  status TEXT,
  count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.status::TEXT,
    COUNT(*)::BIGINT
  FROM samples s
  WHERE s.received_at BETWEEN start_date AND end_date
    AND s.deleted_at IS NULL
  GROUP BY s.status
  ORDER BY
    CASE s.status
      WHEN 'received' THEN 1
      WHEN 'assigned' THEN 2
      WHEN 'in_progress' THEN 3
      WHEN 'review' THEN 4
      WHEN 'completed' THEN 5
      WHEN 'discarded' THEN 6  -- Added: missing status from migration 033
      ELSE 7
    END;
END;
$$;

COMMENT ON FUNCTION get_samples_by_status IS 'Get sample count by workflow status, sorted by workflow order including discarded status. FIXED: Migration 081.';

-- ============================================================================
-- STEP 7: Verification Queries (Run manually after migration)
-- ============================================================================

-- Verify backfill succeeded
-- SELECT COUNT(*) as completed_with_timestamp FROM samples WHERE status = 'completed' AND completed_at IS NOT NULL;
-- SELECT COUNT(*) as review_with_timestamp FROM samples WHERE status = 'review' AND review_started_at IS NOT NULL;

-- Verify indexes exist
-- SELECT indexname FROM pg_indexes WHERE indexname LIKE '%samples_completed%' OR indexname LIKE '%results_entered_by%' OR indexname LIKE '%audit_logs_productivity%';

-- Test TAT calculation with new timestamp
-- SELECT * FROM calculate_average_tat(NOW() - INTERVAL '30 days', NOW());

-- Test approval queue with new timestamp
-- SELECT * FROM get_approval_queue_metrics(NOW() - INTERVAL '30 days', NOW());

-- Test error rate with aligned windows
-- SELECT * FROM get_error_rate_metrics(NOW() - INTERVAL '30 days', NOW());

-- Test status ordering includes discarded
-- SELECT * FROM get_samples_by_status(NOW() - INTERVAL '30 days', NOW());
