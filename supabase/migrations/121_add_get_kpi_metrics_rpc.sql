-- Migration 121: Add consolidated KPI metrics RPC
-- Security Impact: Low - Read-only reporting function with SECURITY INVOKER and existing RLS enforcement
-- Changes: Adds public.get_kpi_metrics(start_date, end_date) while leaving legacy KPI RPCs unchanged

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.get_kpi_metrics(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE (
  avg_tat_hours NUMERIC,
  median_tat_hours NUMERIC,
  sample_count BIGINT,
  on_time_count BIGINT,
  status_breakdown JSONB,
  pending_count BIGINT,
  avg_wait_hours NUMERIC,
  overdue_count BIGINT,
  error_rate NUMERIC,
  total_modifications BIGINT,
  total_results BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
  RETURN QUERY
  WITH completed_samples AS (
    SELECT EXTRACT(EPOCH FROM (s.completed_at - s.received_at)) / 3600 AS tat_hours
    FROM samples s
    WHERE s.status = 'completed'
      AND s.completed_at BETWEEN start_date AND end_date
      AND s.completed_at IS NOT NULL
      AND s.deleted_at IS NULL
  ),
  window_samples AS (
    SELECT
      s.status::TEXT AS status,
      COUNT(*)::BIGINT AS count,
      CASE s.status
        WHEN 'received' THEN 1
        WHEN 'assigned' THEN 2
        WHEN 'in_progress' THEN 3
        WHEN 'review' THEN 4
        WHEN 'completed' THEN 5
        WHEN 'discarded' THEN 6
        ELSE 7
      END AS sort_order
    FROM samples s
    WHERE s.received_at BETWEEN start_date AND end_date
      AND s.deleted_at IS NULL
    GROUP BY s.status
  ),
  review_queue AS (
    SELECT s.review_started_at
    FROM samples s
    WHERE s.status = 'review'
      AND s.received_at BETWEEN start_date AND end_date
      AND s.review_started_at IS NOT NULL
      AND s.deleted_at IS NULL
  ),
  result_window AS (
    SELECT r.id
    FROM results r
    WHERE r.created_at BETWEEN start_date AND end_date
  ),
  result_counts AS (
    SELECT COUNT(*)::BIGINT AS total_results
    FROM result_window
  ),
  result_modifications AS (
    SELECT COUNT(DISTINCT al.id)::BIGINT AS total_modifications
    FROM audit_logs al
    INNER JOIN result_window rw ON rw.id = al.record_id
    WHERE al.table_name = 'results'
      AND al.operation = 'UPDATE'
      AND al.changed_at BETWEEN start_date AND end_date
      AND al.old_values::JSONB->>'value' IS DISTINCT FROM al.new_values::JSONB->>'value'
  )
  SELECT
    (
      SELECT AVG(cs.tat_hours)::NUMERIC(10,2)
      FROM completed_samples cs
    ) AS avg_tat_hours,
    (
      SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY cs.tat_hours)::NUMERIC(10,2)
      FROM completed_samples cs
    ) AS median_tat_hours,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM completed_samples cs
    ), 0::BIGINT) AS sample_count,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM completed_samples cs
      WHERE cs.tat_hours <= 72
    ), 0::BIGINT) AS on_time_count,
    COALESCE((
      SELECT JSONB_AGG(
        JSONB_BUILD_OBJECT('status', ws.status, 'count', ws.count)
        ORDER BY ws.sort_order
      )
      FROM window_samples ws
    ), '[]'::JSONB) AS status_breakdown,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM review_queue rq
    ), 0::BIGINT) AS pending_count,
    (
      SELECT AVG(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - rq.review_started_at)) / 3600)::NUMERIC(10,2)
      FROM review_queue rq
    ) AS avg_wait_hours,
    COALESCE((
      SELECT COUNT(*)::BIGINT
      FROM review_queue rq
      WHERE CURRENT_TIMESTAMP - rq.review_started_at > INTERVAL '24 hours'
    ), 0::BIGINT) AS overdue_count,
    CASE
      WHEN rc.total_results > 0
        THEN (rm.total_modifications::NUMERIC / rc.total_results * 100)::NUMERIC(10,2)
      ELSE 0::NUMERIC(10,2)
    END AS error_rate,
    rm.total_modifications,
    rc.total_results
  FROM result_counts rc
  CROSS JOIN result_modifications rm;
END;
$$;

COMMENT ON FUNCTION public.get_kpi_metrics IS 'Consolidated KPI metrics RPC for reports dashboard. Preserves legacy KPI semantics while returning one row with status breakdown JSON.';

GRANT EXECUTE ON FUNCTION public.get_kpi_metrics TO authenticated;
