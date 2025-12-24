-- Migration 099: Create RPC function for specialty sample statistics
-- Security Impact: None - uses SECURITY INVOKER for RLS enforcement
-- Purpose: Aggregate sample counts by lab specialty and status for Reports page chart

SET search_path TO public;

-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS get_specialty_sample_stats(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]);

/**
 * Returns sample statistics grouped by lab specialty and status.
 *
 * Used by the "Thống kê Mẫu theo Nhóm Kỹ Thuật" chart on Reports page.
 * Aggregates sample counts and test counts per specialty/status combination.
 *
 * @param p_from_date - Start of date range (inclusive)
 * @param p_to_date - End of date range (inclusive)
 * @param p_statuses - Array of status codes to filter by (empty = no results)
 * @returns TABLE with specialty info, status, sample count, test count
 *
 * Performance: Uses indexes on samples.received_at and assay_definitions.specialty_id
 * Security: SECURITY INVOKER enforces RLS policies
 */
CREATE OR REPLACE FUNCTION get_specialty_sample_stats(
    p_from_date TIMESTAMPTZ,
    p_to_date TIMESTAMPTZ,
    p_statuses TEXT[]
)
RETURNS TABLE (
    specialty_code TEXT,
    specialty_name TEXT,
    status TEXT,
    sample_count BIGINT,
    test_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Enforces RLS policies
STABLE            -- Can be cached within transaction
AS $$
BEGIN
    -- Return empty if no statuses provided
    IF p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT
        ls.code::TEXT,
        ls.name::TEXT,
        s.status::TEXT,
        COUNT(DISTINCT s.id)::BIGINT AS sample_count,
        COUNT(r.id)::BIGINT AS test_count
    FROM samples s
    INNER JOIN results r ON r.sample_id = s.id
    INNER JOIN assay_definitions ad ON ad.id = r.assay_id
    INNER JOIN lab_specialties ls ON ls.id = ad.specialty_id
    WHERE s.received_at BETWEEN p_from_date AND p_to_date
      AND s.status::TEXT = ANY(p_statuses)
      AND s.deleted_at IS NULL
      AND ad.deleted_at IS NULL
      AND ls.deleted_at IS NULL
    GROUP BY ls.code, ls.name, ls.display_order, s.status
    ORDER BY ls.display_order, s.status;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_specialty_sample_stats(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_specialty_sample_stats(TIMESTAMPTZ, TIMESTAMPTZ, TEXT[]) IS
'Returns sample counts and test counts grouped by lab specialty and status.
Used by Reports page chart "Thống kê Mẫu theo Nhóm Kỹ Thuật".
Filters by date range and status array. Uses SECURITY INVOKER for RLS.';
