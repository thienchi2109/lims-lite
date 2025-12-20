-- Migration 079: Create Reports Dashboard RPC Functions
-- Security Impact: Low - Read-only reporting functions with SECURITY INVOKER
-- Changes: Adding 6 new RPC functions for KPI calculations and reporting metrics

SET search_path TO public;

-- ============================================================================
-- Function 1: Calculate Average TAT (Turnaround Time)
-- ============================================================================
/**
 * KPI Formula: TAT (Turnaround Time) Calculation
 *
 * Purpose: Calculate average and median TAT for completed samples to measure lab efficiency
 *
 * Formula:
 *   TAT (hours) = (Sample Completion Time - Sample Receipt Time) / 3600
 *
 * Components:
 *   - Start Time: received_at (when sample was accessioned into LIMS)
 *   - End Time: updated_at (when sample reached 'completed' status)
 *   - Calculation: EXTRACT(EPOCH FROM (updated_at - received_at)) / 3600
 *
 * Aggregations:
 *   1. Average TAT: AVG(TAT in hours) - Mean turnaround time
 *   2. Median TAT: PERCENTILE_CONT(0.5) - 50th percentile, robust to outliers
 *   3. Sample Count: COUNT(*) - Total samples completed
 *   4. On-Time Count: COUNT(*) FILTER (TAT <= 72 hours) - Samples meeting SLA
 *
 * SLA Threshold:
 *   - On-Time Definition: TAT <= 72 hours (3 days)
 *   - ISO 17025 requirement for timely reporting
 *   - Used to calculate On-Time Completion Rate KPI
 *
 * Example Query:
 *   SELECT * FROM calculate_average_tat(
 *     '2024-01-01 00:00:00+07'::TIMESTAMPTZ,
 *     '2024-01-31 23:59:59+07'::TIMESTAMPTZ
 *   );
 *
 * Example Result:
 *   avg_tat_hours  | median_tat_hours | sample_count | on_time_count
 *   48.50          | 45.25            | 150          | 142
 *
 * Business Logic:
 *   - Only includes samples with status = 'completed' (approved by manager)
 *   - Filters by completion date (updated_at), not receipt date
 *   - Excludes soft-deleted samples (deleted_at IS NULL)
 *   - Returns NULL for avg/median if no samples found (no division by zero)
 */
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
SECURITY INVOKER  -- Enforces RLS policies automatically
AS $$
BEGIN
  -- TAT = Time from sample receipt (received_at) to completion (updated_at when status = 'completed')
  -- For completed samples, updated_at represents when they reached completed status
  RETURN QUERY
  SELECT
    AVG(EXTRACT(EPOCH FROM (updated_at - received_at))/3600)::NUMERIC(10,2) as avg_tat_hours,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM (updated_at - received_at))/3600)::NUMERIC(10,2) as median_tat_hours,
    COUNT(*)::BIGINT as sample_count,
    COUNT(*) FILTER (WHERE (updated_at - received_at) <= INTERVAL '72 hours')::BIGINT as on_time_count
  FROM samples
  WHERE status = 'completed'
    AND updated_at BETWEEN start_date AND end_date
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION calculate_average_tat IS 'Calculate average and median TAT with on-time delivery count for samples completed in date range. Returns NULL values if no samples found.';

GRANT EXECUTE ON FUNCTION calculate_average_tat TO authenticated;

-- ============================================================================
-- Function 2: Get Samples by Status Distribution
-- ============================================================================
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
      ELSE 6
    END;
END;
$$;

COMMENT ON FUNCTION get_samples_by_status IS 'Get sample count by workflow status, sorted by workflow order (received → assigned → in_progress → review → completed).';

GRANT EXECUTE ON FUNCTION get_samples_by_status TO authenticated;

-- ============================================================================
-- Function 3: Get Approval Queue Metrics
-- ============================================================================
/**
 * KPI Formula: Approval Queue Metrics
 *
 * Purpose: Monitor pending approvals to prevent bottlenecks and ensure timely manager review
 *
 * Metrics:
 *   1. Pending Count: COUNT(*) WHERE status = 'review'
 *      - Total samples waiting for manager approval
 *
 *   2. Average Wait Time (hours):
 *      - Formula: AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - updated_at)) / 3600)
 *      - Time since sample entered 'review' status
 *      - updated_at = timestamp when status changed to 'review'
 *
 *   3. Overdue Count: COUNT(*) FILTER (wait_time > 24 hours)
 *      - Samples exceeding 24-hour review SLA
 *      - Indicates approval bottleneck
 *
 * Alert Thresholds:
 *   - High Priority: pending_count > 20 samples
 *   - High Priority: avg_wait_hours > 24 hours
 *   - Visual Alert: overdue_count > 0
 *
 * Example Query:
 *   SELECT * FROM get_approval_queue_metrics(
 *     '2024-01-01 00:00:00+07'::TIMESTAMPTZ,
 *     '2024-01-31 23:59:59+07'::TIMESTAMPTZ
 *   );
 *
 * Example Result:
 *   pending_count | avg_wait_hours | overdue_count
 *   15            | 8.5            | 2
 *
 * Business Logic:
 *   - Only includes samples in 'review' status (awaiting approval)
 *   - Filters by received_at (accession date) for period comparison
 *   - 24-hour SLA ensures timely reporting to clients
 *   - Real-time calculation using CURRENT_TIMESTAMP
 */
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
    AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - updated_at))/3600)::NUMERIC(10,2) as avg_wait_hours,
    COUNT(*) FILTER (WHERE (CURRENT_TIMESTAMP - updated_at) > INTERVAL '24 hours')::BIGINT as overdue_count
  FROM samples
  WHERE status = 'review'
    AND received_at BETWEEN start_date AND end_date
    AND deleted_at IS NULL;
END;
$$;

COMMENT ON FUNCTION get_approval_queue_metrics IS 'Get pending approval metrics: count, average wait time, and overdue count (>24h). Alert threshold: >20 samples OR avg wait >24 hours.';

GRANT EXECUTE ON FUNCTION get_approval_queue_metrics TO authenticated;

-- ============================================================================
-- Function 4: Get Error Rate Metrics from Audit Logs
-- ============================================================================
/**
 * KPI Formula: Error Rate Calculation
 *
 * Purpose: Measure data quality by tracking result corrections as a percentage
 *
 * Formula:
 *   Error Rate (%) = (Number of Result Modifications / Total Results Created) * 100
 *
 * Components:
 *   1. Total Results Created:
 *      - COUNT(*) FROM results WHERE created_at BETWEEN start_date AND end_date
 *      - Denominator: all results entered in the period
 *
 *   2. Result Modifications:
 *      - COUNT(*) FROM audit_logs WHERE:
 *        - table_name = 'results'
 *        - operation = 'UPDATE'
 *        - old_values->>'status' IS DISTINCT FROM new_values->>'status'
 *      - Excludes approval workflow actions (status changes)
 *      - Only counts corrections to entered data
 *
 *   3. Error Rate Calculation:
 *      - If total_results > 0: (modifications / total_results) * 100
 *      - If total_results = 0: 0% (prevents division by zero)
 *
 * Example Query:
 *   SELECT * FROM get_error_rate_metrics(
 *     '2024-01-01 00:00:00+07'::TIMESTAMPTZ,
 *     '2024-01-31 23:59:59+07'::TIMESTAMPTZ
 *   );
 *
 * Example Result:
 *   error_rate | total_modifications | total_results
 *   3.25       | 13                  | 400
 *
 * Business Logic:
 *   - High error rate (>5%) indicates need for additional training
 *   - Low error rate (<2%) indicates good data quality practices
 *   - ISO 17025 compliance metric for quality assurance
 *   - Excludes legitimate workflow actions (approval status changes)
 *   - Tracks only corrections that indicate entry errors
 *
 * Audit Log Schema:
 *   - operation: 'UPDATE' (not 'action')
 *   - old_values/new_values: JSONB columns (not old_value/new_value)
 *   - Status field check excludes approval workflow from error count
 */
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

  -- Count result modifications from audit logs (exclude approval actions)
  -- audit_logs uses: operation (not action), old_values/new_values (not old_value/new_value)
  SELECT COUNT(*)
  INTO v_total_modifications
  FROM audit_logs
  WHERE table_name = 'results'
    AND operation = 'UPDATE'
    AND changed_at BETWEEN start_date AND end_date
    -- Exclude approval-related updates (these are legitimate workflow actions)
    AND old_values::jsonb->>'status' IS DISTINCT FROM new_values::jsonb->>'status';

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

COMMENT ON FUNCTION get_error_rate_metrics IS 'Calculate error rate as (result modifications / total results) * 100. Excludes approval actions, only counts corrections. ISO 17025 compliance metric.';

GRANT EXECUTE ON FUNCTION get_error_rate_metrics TO authenticated;

-- ============================================================================
-- Function 5: Get CoA Statistics
-- ============================================================================
-- Function 5: Get CoA Statistics
-- ============================================================================
CREATE OR REPLACE FUNCTION get_coa_statistics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  segment TEXT,
  count BIGINT,
  percentage NUMERIC
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_total BIGINT;
BEGIN
  -- Get total sample count for percentage calculation
  SELECT COUNT(*)
  INTO v_total
  FROM samples
  WHERE received_at BETWEEN start_date AND end_date
    AND deleted_at IS NULL;

  RETURN QUERY
  -- Generated: Samples with CoA in coa_reports table
  SELECT
    'Generated'::TEXT as segment,
    COUNT(DISTINCT s.id)::BIGINT as count,
    CASE WHEN v_total > 0 THEN (COUNT(DISTINCT s.id)::NUMERIC / v_total * 100)::NUMERIC(10,2) ELSE 0::NUMERIC(10,2) END as percentage
  FROM samples s
  INNER JOIN coa_reports c ON c.sample_id = s.id
  WHERE s.received_at BETWEEN start_date AND end_date
    AND s.deleted_at IS NULL
    AND c.generated_at IS NOT NULL
    AND c.deleted_at IS NULL

  UNION ALL

  -- Pending CoA: Completed samples without CoA
  SELECT
    'Pending CoA'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN v_total > 0 THEN (COUNT(*)::NUMERIC / v_total * 100)::NUMERIC(10,2) ELSE 0::NUMERIC(10,2) END
  FROM samples s
  WHERE s.received_at BETWEEN start_date AND end_date
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM coa_reports c
      WHERE c.sample_id = s.id
        AND c.generated_at IS NOT NULL
        AND c.deleted_at IS NULL
    )

  UNION ALL

  -- Not Approved: Samples not yet completed
  SELECT
    'Not Approved'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN v_total > 0 THEN (COUNT(*)::NUMERIC / v_total * 100)::NUMERIC(10,2) ELSE 0::NUMERIC(10,2) END
  FROM samples
  WHERE received_at BETWEEN start_date AND end_date
    AND deleted_at IS NULL
    AND status != 'completed';
END;
$$;

COMMENT ON FUNCTION get_coa_statistics IS 'Get CoA generation pipeline statistics: Generated (has coa_generated_at), Pending CoA (completed but no CoA), Not Approved (not completed). Returns counts and percentages.';

GRANT EXECUTE ON FUNCTION get_coa_statistics TO authenticated;

-- ============================================================================
-- Function 6: Get Staff Productivity (Manager-Only)
-- ============================================================================
/**
 * KPI Formula: Staff Productivity Metrics
 *
 * Purpose: Track individual analyst performance for workload balancing and training needs
 *
 * Metrics Per Analyst:
 *   1. Tests Completed:
 *      - Formula: COUNT(DISTINCT results.id) WHERE created_at BETWEEN start_date AND end_date
 *      - Number of test results entered by analyst
 *      - Primary productivity indicator
 *
 *   2. Results Modified:
 *      - Formula: COUNT(DISTINCT audit_logs.id) WHERE:
 *        - table_name = 'results'
 *        - operation = 'UPDATE'
 *        - changed_by = analyst_id
 *      - Corrections made to previously entered results
 *      - Quality indicator (high modifications may indicate training needs)
 *
 * Access Control:
 *   - MANAGER-ONLY: Raises exception if called by non-manager
 *   - get_user_role() must return 'manager'
 *   - Protects analyst privacy per RBAC requirements
 *
 * Example Query:
 *   SELECT * FROM get_staff_productivity(
 *     '2024-01-01 00:00:00+07'::TIMESTAMPTZ,
 *     '2024-01-31 23:59:59+07'::TIMESTAMPTZ
 *   );
 *
 * Example Result:
 *   analyst_id                            | analyst_name    | tests_completed | results_modified
 *   a1b2c3d4-e5f6-7890-abcd-ef1234567890 | Nguyễn Văn A   | 150             | 5
 *   b2c3d4e5-f6a7-8901-bcde-f12345678901 | Trần Thị B     | 142             | 3
 *
 * Business Logic:
 *   - Only includes analysts (role = 'analyst')
 *   - Excludes soft-deleted users (deleted_at IS NULL)
 *   - HAVING clause filters out analysts with zero tests in period
 *   - Sorted by tests_completed DESC (most productive first)
 *   - Used for workload balancing and performance reviews
 *
 * Performance Interpretation:
 *   - High tests_completed = Good productivity
 *   - High results_modified = May need additional training or quality checks
 *   - Modification rate = (results_modified / tests_completed) * 100
 */
CREATE OR REPLACE FUNCTION get_staff_productivity(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  analyst_id UUID,
  analyst_name TEXT,
  tests_completed BIGINT,
  results_modified BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  -- Manager-only check: This function should only be called by managers
  -- RLS policies on underlying tables will enforce this, but we add explicit check
  IF get_user_role() NOT IN ('manager') THEN
    RAISE EXCEPTION 'Permission denied: manager role required for staff productivity reports';
  END IF;

  RETURN QUERY
  SELECT
    u.id as analyst_id,
    u.full_name::TEXT as analyst_name,
    COUNT(DISTINCT r.id) FILTER (WHERE r.created_at BETWEEN start_date AND end_date)::BIGINT as tests_completed,
    COUNT(DISTINCT al.id) FILTER (
      WHERE al.table_name = 'results'
        AND al.operation = 'UPDATE'
        AND al.changed_at BETWEEN start_date AND end_date
    )::BIGINT as results_modified
  FROM users u
  LEFT JOIN results r ON r.entered_by = u.id
  LEFT JOIN audit_logs al ON al.changed_by = u.id
  WHERE u.role = 'analyst'
    AND u.deleted_at IS NULL
  GROUP BY u.id, u.full_name
  HAVING COUNT(DISTINCT r.id) FILTER (WHERE r.created_at BETWEEN start_date AND end_date) > 0
  ORDER BY tests_completed DESC;
END;
$$;

COMMENT ON FUNCTION get_staff_productivity IS 'Get analyst productivity metrics (tests completed, results modified). MANAGER-ONLY: Raises exception if called by non-manager role. Sorted by tests_completed descending.';

GRANT EXECUTE ON FUNCTION get_staff_productivity TO authenticated;
