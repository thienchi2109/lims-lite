-- Migration 090: Create RPC function for scalable specialty filtering
-- Security Impact: None - uses SECURITY INVOKER for RLS enforcement
-- Purpose: Avoid URI Too Long (HTTP 414) by filtering samples server-side

SET search_path TO public;

-- Drop if exists for idempotency
DROP FUNCTION IF EXISTS get_sample_ids_by_specialty(UUID[]);

/**
 * Returns sample IDs that have at least one result with an assay
 * belonging to any of the specified lab specialties.
 *
 * Uses OR logic: sample appears if ANY specialty matches.
 *
 * @param p_specialty_ids - Array of lab_specialties.id UUIDs
 * @returns TABLE of sample UUIDs
 *
 * Performance: Uses index on assay_definitions.specialty_id
 * Security: SECURITY INVOKER enforces RLS policies
 */
CREATE OR REPLACE FUNCTION get_sample_ids_by_specialty(
    p_specialty_ids UUID[]
)
RETURNS TABLE (sample_id UUID)
LANGUAGE plpgsql
SECURITY INVOKER  -- Enforces RLS policies
STABLE            -- Can be cached within transaction
AS $$
BEGIN
    -- Return empty if no specialty IDs provided
    IF p_specialty_ids IS NULL OR array_length(p_specialty_ids, 1) IS NULL THEN
        RETURN;
    END IF;

    RETURN QUERY
    SELECT DISTINCT r.sample_id
    FROM results r
    INNER JOIN assay_definitions ad ON ad.id = r.assay_id
    WHERE ad.specialty_id = ANY(p_specialty_ids)
      AND ad.deleted_at IS NULL;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_sample_ids_by_specialty(UUID[]) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION get_sample_ids_by_specialty(UUID[]) IS
'Returns sample IDs that have results with assays belonging to specified specialties.
Used by Samples page filter to avoid HTTP 414 (URI Too Long) with large result sets.
Uses OR logic - samples with ANY matching specialty are returned.';
