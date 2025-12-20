-- Migration 083: Sample Accession Trend RPC Function
-- Description: Add get_sample_accession_trend RPC function with auto-granularity
-- Security Impact: Low - Read-only function with SECURITY INVOKER (enforces RLS)
-- Changes: Creates new RPC function for sample accession trend chart

SET search_path TO public;

-- RPC Function: get_sample_accession_trend
-- Auto-adjusts granularity based on date range:
-- - ≤ 31 days → Daily aggregation
-- - ≤ 365 days → Monthly aggregation
-- - > 365 days → Yearly aggregation
CREATE OR REPLACE FUNCTION get_sample_accession_trend(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
RETURNS TABLE (
    period TEXT,
    sample_count BIGINT,
    cumulative_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Enforces RLS policies
AS $$
DECLARE
    day_diff INT;
    granularity TEXT;
BEGIN
    -- Calculate date range in days
    day_diff := EXTRACT(EPOCH FROM (end_date - start_date)) / 86400;

    -- Determine granularity
    IF day_diff <= 31 THEN
        granularity := 'daily';
    ELSIF day_diff <= 365 THEN
        granularity := 'monthly';
    ELSE
        granularity := 'yearly';
    END IF;

    -- Return aggregated data based on granularity
    -- Uses CTE to group by date, then format and calculate cumulative
    RETURN QUERY
    WITH aggregated AS (
        SELECT
            CASE granularity
                WHEN 'daily' THEN DATE(received_at)
                WHEN 'monthly' THEN DATE_TRUNC('month', received_at)::DATE
                WHEN 'yearly' THEN DATE_TRUNC('year', received_at)::DATE
            END AS period_date,
            COUNT(*) AS sample_count
        FROM samples
        WHERE received_at >= start_date
          AND received_at <= end_date
          AND deleted_at IS NULL  -- Exclude soft-deleted samples
        GROUP BY period_date
    )
    SELECT
        CASE granularity
            WHEN 'daily' THEN TO_CHAR(a.period_date, 'YYYY-MM-DD')
            WHEN 'monthly' THEN TO_CHAR(a.period_date, 'YYYY-MM')
            WHEN 'yearly' THEN TO_CHAR(a.period_date, 'YYYY')
        END AS period,
        a.sample_count::BIGINT,
        SUM(a.sample_count) OVER (ORDER BY a.period_date)::BIGINT AS cumulative_count
    FROM aggregated a
    ORDER BY a.period_date ASC;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_sample_accession_trend TO authenticated;

-- Add comment explaining the function
COMMENT ON FUNCTION get_sample_accession_trend(TIMESTAMPTZ, TIMESTAMPTZ)
IS 'Returns sample accession trend with auto-granularity (daily/monthly/yearly) and cumulative counts. Enforces RLS via SECURITY INVOKER.';

-- Add index for performance (avoid full table scan)
-- Use regular CREATE INDEX for development (faster, locks table briefly)
-- For production, use: CREATE INDEX CONCURRENTLY (slower, zero downtime)
CREATE INDEX IF NOT EXISTS idx_samples_received_at_not_deleted
ON samples(received_at) WHERE deleted_at IS NULL;

-- Add comment explaining the index
COMMENT ON INDEX idx_samples_received_at_not_deleted
IS 'Performance index for sample accession trend queries. Filters soft-deleted samples.';
