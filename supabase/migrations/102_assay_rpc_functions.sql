-- Migration: 102_assay_rpc_functions.sql
-- Purpose: Create RPC functions for assay definitions to reduce TypeScript complexity
-- Part of: Assays Actions Refactor (docs/plans/2025-12-28-assays-actions-refactor-design.md)

-- ============================================================================
-- get_assay_definitions: List assays with search, filter, pagination
-- ============================================================================

CREATE OR REPLACE FUNCTION get_assay_definitions(
    p_search text DEFAULT NULL,
    p_method_id uuid DEFAULT NULL,
    p_specialty_id uuid DEFAULT NULL,
    p_page int DEFAULT 1,
    p_page_size int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    name text,
    specialty_id uuid,
    specialty_name text,
    specialty_order int,
    units text,
    validation_rules jsonb,
    methods jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_offset int;
    v_total bigint;
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    -- Use a CTE for filtering and counting, then join for aggregation
    RETURN QUERY
    WITH filtered_assays AS (
        SELECT
            ad.id,
            ad.name,
            ad.specialty_id,
            ls.name AS specialty_name,
            ls.display_order AS specialty_order,
            ad.units,
            ad.validation_rules,
            ad.created_at,
            ad.updated_at
        FROM assay_definitions ad
        LEFT JOIN lab_specialties ls ON ls.id = ad.specialty_id AND ls.deleted_at IS NULL
        WHERE ad.deleted_at IS NULL
            -- Specialty filter
            AND (p_specialty_id IS NULL OR ad.specialty_id = p_specialty_id)
            -- Method filter (via EXISTS subquery)
            AND (
                p_method_id IS NULL
                OR EXISTS (
                    SELECT 1 FROM assay_methods am
                    WHERE am.assay_id = ad.id AND am.method_id = p_method_id
                )
            )
            -- Search filter: match assay name, specialty name, or method name
            AND (
                p_search IS NULL
                OR p_search = ''
                OR ad.name ILIKE '%' || p_search || '%'
                OR ls.name ILIKE '%' || p_search || '%'
                OR EXISTS (
                    SELECT 1 FROM assay_methods am2
                    JOIN methods m ON m.id = am2.method_id
                    WHERE am2.assay_id = ad.id AND m.name ILIKE '%' || p_search || '%'
                )
            )
    ),
    counted AS (
        SELECT COUNT(*) AS cnt FROM filtered_assays
    ),
    paginated AS (
        SELECT fa.*
        FROM filtered_assays fa
        ORDER BY
            COALESCE(fa.specialty_order, 9999),
            COALESCE(fa.specialty_name, 'zzz'),
            fa.name
        LIMIT p_page_size
        OFFSET v_offset
    )
    SELECT
        p.id,
        p.name,
        p.specialty_id,
        p.specialty_name,
        p.specialty_order,
        p.units,
        p.validation_rules,
        -- Aggregate methods as JSONB array
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', am.id,
                        'method_id', am.method_id,
                        'name', m.name,
                        'is_default', am.is_default,
                        'notes', am.notes
                    )
                    ORDER BY am.is_default DESC, m.name
                )
                FROM assay_methods am
                JOIN methods m ON m.id = am.method_id
                WHERE am.assay_id = p.id
            ),
            '[]'::jsonb
        ) AS methods,
        p.created_at,
        p.updated_at,
        (SELECT cnt FROM counted) AS total_count
    FROM paginated p;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_assay_definitions(text, uuid, uuid, int, int) TO authenticated;

COMMENT ON FUNCTION get_assay_definitions IS
    'Returns paginated assay definitions with specialty info and aggregated methods. Supports search by name/specialty/method, and filter by specialty_id or method_id.';

-- ============================================================================
-- get_assay_definition_by_id: Get single assay with methods
-- ============================================================================

CREATE OR REPLACE FUNCTION get_assay_definition_by_id(p_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    specialty_id uuid,
    units text,
    validation_rules jsonb,
    methods jsonb,
    created_at timestamptz,
    updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ad.id,
        ad.name,
        ad.specialty_id,
        ad.units,
        ad.validation_rules,
        -- Aggregate methods as JSONB array
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', am.id,
                        'method_id', am.method_id,
                        'name', m.name,
                        'is_default', am.is_default,
                        'notes', am.notes
                    )
                    ORDER BY am.is_default DESC, m.name
                )
                FROM assay_methods am
                JOIN methods m ON m.id = am.method_id
                WHERE am.assay_id = ad.id
            ),
            '[]'::jsonb
        ) AS methods,
        ad.created_at,
        ad.updated_at
    FROM assay_definitions ad
    WHERE ad.id = p_id
      AND ad.deleted_at IS NULL;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_assay_definition_by_id(uuid) TO authenticated;

COMMENT ON FUNCTION get_assay_definition_by_id IS
    'Returns a single assay definition by ID with aggregated methods array.';
