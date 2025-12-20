-- Migration 084: Fix CoA Statistics Calculation
-- Description: Update get_coa_statistics to calculate percentage based on approved samples only
-- Security Impact: None - Read-only function with SECURITY INVOKER (enforces RLS)
-- Changes: Modifies get_coa_statistics to use approved samples as base for percentage calculation

SET search_path TO public;

-- Drop and recreate function with corrected formula
-- Formula: (Number of samples with CoA created) / (Total number of samples approved by manager) * 100
/**
 * KPI Formula: Certificate of Analysis (CoA) Statistics
 *
 * Purpose: Track CoA generation progress for approved samples
 *
 * Formula:
 *   Percentage (%) = (Segment Count / Total Approved Samples) * 100
 *
 * Base Calculation:
 *   Total Approved Samples = COUNT(*) WHERE status = 'completed' AND deleted_at IS NULL
 *   - Only samples approved by manager are included in denominator
 *   - Excludes non-approved samples (received, assigned, in_progress, review)
 *
 * Segments:
 *   1. Generated:
 *      - Samples with CoA created (exists in coa_reports with generated_at IS NOT NULL)
 *      - Percentage = (Generated Count / Total Approved) * 100
 *
 *   2. Pending CoA:
 *      - Approved samples without CoA yet
 *      - Percentage = (Pending Count / Total Approved) * 100
 *
 * Note: "Not Approved" segment removed in this migration (was incorrectly included)
 *
 * Example Query:
 *   SELECT * FROM get_coa_statistics(
 *     '2024-01-01 00:00:00+07'::TIMESTAMPTZ,
 *     '2024-01-31 23:59:59+07'::TIMESTAMPTZ
 *   );
 *
 * Example Result:
 *   segment      | count | percentage
 *   Generated    | 120   | 80.00
 *   Pending CoA  | 30    | 20.00
 *   (Total approved samples: 150)
 *
 * Business Logic:
 *   - Only counts approved samples (status = 'completed')
 *   - Percentage base changed from ALL samples to APPROVED samples only
 *   - This makes the metric meaningful: "Of approved samples, how many have CoA?"
 *   - Previously used all samples as base, making percentages misleading
 *
 * Compliance:
 *   - ISO 17025 requires timely reporting of results
 *   - Tracks CoA generation backlog
 *   - High "Pending CoA" percentage indicates reporting delay
 */
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
  v_approved_total BIGINT;
BEGIN
  -- Get total APPROVED sample count for percentage calculation
  -- Approved samples = samples with status 'completed' (approved by manager)
  SELECT COUNT(*)
  INTO v_approved_total
  FROM samples
  WHERE received_at BETWEEN start_date AND end_date
    AND deleted_at IS NULL
    AND status = 'completed';

  RETURN QUERY
  -- Generated: Samples with CoA in coa_reports table
  -- Percentage = (samples with CoA) / (approved samples) * 100
  SELECT
    'Generated'::TEXT as segment,
    COUNT(DISTINCT s.id)::BIGINT as count,
    CASE WHEN v_approved_total > 0
      THEN (COUNT(DISTINCT s.id)::NUMERIC / v_approved_total * 100)::NUMERIC(10,2)
      ELSE 0::NUMERIC(10,2)
    END as percentage
  FROM samples s
  INNER JOIN coa_reports c ON c.sample_id = s.id
  WHERE s.received_at BETWEEN start_date AND end_date
    AND s.deleted_at IS NULL
    AND s.status = 'completed'  -- Only count approved samples
    AND c.generated_at IS NOT NULL
    AND c.deleted_at IS NULL

  UNION ALL

  -- Pending CoA: Completed samples without CoA
  -- Percentage = (approved samples without CoA) / (approved samples) * 100
  SELECT
    'Pending CoA'::TEXT,
    COUNT(*)::BIGINT,
    CASE WHEN v_approved_total > 0
      THEN (COUNT(*)::NUMERIC / v_approved_total * 100)::NUMERIC(10,2)
      ELSE 0::NUMERIC(10,2)
    END
  FROM samples s
  WHERE s.received_at BETWEEN start_date AND end_date
    AND s.deleted_at IS NULL
    AND s.status = 'completed'
    AND NOT EXISTS (
      SELECT 1 FROM coa_reports c
      WHERE c.sample_id = s.id
        AND c.generated_at IS NOT NULL
        AND c.deleted_at IS NULL
    );
END;
$$;

-- Update comment to reflect corrected logic
COMMENT ON FUNCTION get_coa_statistics(TIMESTAMPTZ, TIMESTAMPTZ)
IS 'Get CoA generation statistics for APPROVED samples only: Generated (has CoA), Pending CoA (approved but no CoA). Percentage calculated as: (count / approved_samples) * 100. Excludes non-approved samples from calculation.';

-- Grant permissions (already granted in 079, but explicit is better)
GRANT EXECUTE ON FUNCTION get_coa_statistics TO authenticated;
