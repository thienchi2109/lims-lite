-- Migration 082: Add TAT Trend Daily Aggregation Function
-- Security Impact: Low - Read-only reporting function with SECURITY INVOKER
-- Changes: Create optimized RPC function for daily TAT trend calculation
--
-- Purpose: Replaces JavaScript-side aggregation in getTATTrendData/fetchTATTrendData
--          with database-side GROUP BY for better performance on large datasets.
--
-- Performance Impact: High improvement - reduces memory usage and network transfer
--                     for wide date ranges (e.g., "Last Year" with 10,000+ samples).

SET search_path TO public;

-- ============================================================================
-- Function: Get TAT Trend Daily Aggregation
-- ============================================================================
CREATE OR REPLACE FUNCTION get_tat_trend_daily(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  date TEXT,
  avg_tat_hours NUMERIC,
  sample_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Enforces RLS policies automatically
AS $$
BEGIN
  RETURN QUERY
  SELECT
    DATE(completed_at)::TEXT as date,
    AVG(EXTRACT(EPOCH FROM (completed_at - received_at))/3600)::NUMERIC(10,2) as avg_tat_hours,
    COUNT(*)::BIGINT as sample_count
  FROM samples
  WHERE status = 'completed'
    AND completed_at BETWEEN start_date AND end_date
    AND completed_at IS NOT NULL
    AND received_at IS NOT NULL
    AND deleted_at IS NULL
  GROUP BY DATE(completed_at)
  ORDER BY date ASC;
END;
$$;

COMMENT ON FUNCTION get_tat_trend_daily IS 'Calculate daily average TAT for trend chart. Groups samples by completion date (DATE cast) and returns average TAT hours per day. Performance: O(n) with GROUP BY instead of O(n) in-memory aggregation in JavaScript.';

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_tat_trend_daily TO authenticated;

-- ============================================================================
-- Verification Query (Run manually after migration)
-- ============================================================================

-- Test daily aggregation with last 30 days
-- SELECT * FROM get_tat_trend_daily(NOW() - INTERVAL '30 days', NOW());

-- Expected output:
-- | date       | avg_tat_hours | sample_count |
-- |------------|---------------|--------------|
-- | 2025-11-20 | 48.50         | 12           |
-- | 2025-11-21 | 52.30         | 8            |
-- | ...        | ...           | ...          |

-- Compare performance with old approach:
-- Old: SELECT completed_at, received_at FROM samples WHERE ... (fetches all rows)
-- New: SELECT * FROM get_tat_trend_daily(...) (aggregates in database)

-- Estimated improvement: 10-100x reduction in network payload for wide date ranges
