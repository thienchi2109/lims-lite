-- Migration 126: Conceal confidential-associated samples in the samples page RPC
-- Security Impact: Medium - tightens get_samples_page so unauthorized users cannot discover confidential-associated samples through rows or counts
-- Purpose: Keep sample list and exact sample-id lookups authorization-neutral for confidential-associated samples

SET search_path TO public;

DROP FUNCTION IF EXISTS get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    UUID,
    UUID[],
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
);

CREATE OR REPLACE FUNCTION get_samples_page(
    p_search TEXT DEFAULT NULL,
    p_scope TEXT DEFAULT 'active',
    p_status sample_status DEFAULT NULL,
    p_from_date TIMESTAMPTZ DEFAULT NULL,
    p_to_date TIMESTAMPTZ DEFAULT NULL,
    p_receiver_id UUID DEFAULT NULL,
    p_specialty_ids UUID[] DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'updated_at',
    p_sort_order TEXT DEFAULT 'desc',
    p_page INTEGER DEFAULT 1,
    p_page_size INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
SET search_path = public
AS $$
DECLARE
    v_scope TEXT := CASE WHEN p_scope = 'all' THEN 'all' ELSE 'active' END;
    v_search TEXT := NULLIF(BTRIM(p_search), '');
    v_sort_by TEXT := CASE WHEN p_sort_by = 'received_at' THEN 'received_at' ELSE 'updated_at' END;
    v_sort_order TEXT := CASE WHEN LOWER(COALESCE(p_sort_order, 'desc')) = 'asc' THEN 'asc' ELSE 'desc' END;
    v_page_size INTEGER := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 100);
    v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
    v_offset INTEGER := (v_page - 1) * v_page_size;
    v_result JSONB;
BEGIN
    WITH filtered_samples AS (
        SELECT
            s.id,
            s.sample_id,
            s.client_id,
            s.client_name,
            s.type,
            s.status,
            s.received_at,
            s.received_by,
            u.full_name AS received_by_name,
            s.created_at,
            s.updated_at,
            s.deleted_at,
            s.rejection_reason,
            s.rejected_at,
            s.rejected_by
        FROM samples s
        LEFT JOIN users u
            ON u.id = s.received_by
           AND u.deleted_at IS NULL
        WHERE s.deleted_at IS NULL
          AND (
              (p_status IS NOT NULL AND s.status = p_status)
              OR (p_status IS NULL AND (v_scope = 'all' OR s.status <> 'completed'))
          )
          AND (p_receiver_id IS NULL OR s.received_by = p_receiver_id)
          AND (p_from_date IS NULL OR s.received_at >= p_from_date)
          AND (p_to_date IS NULL OR s.received_at <= p_to_date)
          AND (
              COALESCE(array_length(p_specialty_ids, 1), 0) = 0
              OR EXISTS (
                  SELECT 1
                  FROM results r
                  INNER JOIN assay_definitions ad ON ad.id = r.assay_id
                  WHERE r.sample_id = s.id
                    AND ad.deleted_at IS NULL
                    AND ad.specialty_id = ANY(p_specialty_ids)
              )
          )
          AND (
              v_search IS NULL
              OR s.sample_id ILIKE '%' || v_search || '%'
              OR s.client_name ILIKE '%' || v_search || '%'
              OR COALESCE(u.full_name, '') ILIKE '%' || v_search || '%'
          )
          AND (
              user_can_access_confidential()
              OR NOT EXISTS (
                  SELECT 1
                  FROM results r_conf
                  INNER JOIN assay_definitions ad_conf
                      ON ad_conf.id = r_conf.assay_id
                  WHERE r_conf.sample_id = s.id
                    AND ad_conf.deleted_at IS NULL
                    AND ad_conf.is_confidential = true
              )
          )
    ),
    counted_samples AS (
        SELECT COUNT(*)::BIGINT AS total_count
        FROM filtered_samples
    ),
    ordered_samples AS (
        SELECT *
        FROM filtered_samples
        ORDER BY
            CASE WHEN v_sort_by = 'received_at' AND v_sort_order = 'asc' THEN received_at END ASC NULLS LAST,
            CASE WHEN v_sort_by = 'received_at' AND v_sort_order = 'desc' THEN received_at END DESC NULLS LAST,
            CASE WHEN v_sort_by = 'updated_at' AND v_sort_order = 'asc' THEN updated_at END ASC NULLS LAST,
            CASE WHEN v_sort_by = 'updated_at' AND v_sort_order = 'desc' THEN updated_at END DESC NULLS LAST,
            updated_at DESC,
            id DESC
        LIMIT v_page_size
        OFFSET v_offset
    ),
    paged_samples AS (
        SELECT
            ordered_samples.*,
            ROW_NUMBER() OVER () AS page_position
        FROM ordered_samples
    ),
    aggregated_rows AS (
        SELECT COALESCE(
            jsonb_agg(to_jsonb(paged_samples) - 'page_position' ORDER BY page_position),
            '[]'::JSONB
        ) AS rows
        FROM paged_samples
    )
    SELECT jsonb_build_object(
        'rows',
        aggregated_rows.rows,
        'total_count',
        counted_samples.total_count
    )
    INTO v_result
    FROM aggregated_rows
    CROSS JOIN counted_samples;

    RETURN COALESCE(
        v_result,
        jsonb_build_object('rows', '[]'::JSONB, 'total_count', 0)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    UUID,
    UUID[],
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
) TO authenticated;

COMMENT ON FUNCTION get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    UUID,
    UUID[],
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
) IS 'Returns paginated sample rows plus total_count in a single RPC while concealing confidential-associated samples from unauthorized users.';
