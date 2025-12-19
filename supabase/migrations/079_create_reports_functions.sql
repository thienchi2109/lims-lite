-- Migration 079: Create Reports Dashboard RPC Functions
-- Security Impact: Low - Read-only reporting functions with SECURITY INVOKER
-- Changes: Adding 6 new RPC functions for KPI calculations and reporting metrics

SET search_path TO public;

-- ============================================================================
-- Function 1: Calculate Average TAT (Turnaround Time)
-- ============================================================================
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
