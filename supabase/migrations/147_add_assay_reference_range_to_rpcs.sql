-- Add assay reference range text to assay definition read RPC contracts.
--
-- Security impact:
-- - No RLS policies are changed.
-- - Keeps nullable TEXT metadata on assay_definitions for manager-maintained CoA reference range text.
-- - Recreates assay read RPCs with the existing authenticated EXECUTE grant and explicit SECURITY DEFINER search_path.
-- - Does not backfill or mutate existing assay values or generated CoA HTML snapshots.

SET search_path TO public;

ALTER TABLE public.assay_definitions
ADD COLUMN IF NOT EXISTS normal_range TEXT;

COMMENT ON COLUMN public.assay_definitions.normal_range IS
    'Optional free-form clinical reference range text rendered into newly generated CoA reports.';

DROP FUNCTION IF EXISTS public.get_assay_definitions(text, uuid, uuid, int, int);

CREATE FUNCTION public.get_assay_definitions(
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
    method_name text,
    normal_range text,
    validation_rules jsonb,
    is_confidential boolean,
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
BEGIN
    v_offset := (p_page - 1) * p_page_size;

    RETURN QUERY
    WITH filtered_assays AS (
        SELECT
            ad.id,
            ad.name,
            ad.specialty_id,
            ls.name AS specialty_name,
            ls.display_order AS specialty_order,
            ad.units,
            ad.method_name,
            ad.normal_range,
            ad.validation_rules,
            ad.is_confidential,
            ad.created_at,
            ad.updated_at
        FROM public.assay_definitions ad
        LEFT JOIN public.lab_specialties ls ON ls.id = ad.specialty_id
        WHERE ad.deleted_at IS NULL
          AND (
              p_specialty_id IS NULL
              OR ad.specialty_id = p_specialty_id
          )
          AND (
              p_method_id IS NULL
              OR EXISTS (
                  SELECT 1
                  FROM public.assay_methods am
                  WHERE am.assay_id = ad.id
                    AND am.method_id = p_method_id
              )
          )
          AND (
              p_search IS NULL
              OR ad.name ILIKE '%' || p_search || '%'
              OR ad.method_name ILIKE '%' || p_search || '%'
              OR ls.name ILIKE '%' || p_search || '%'
              OR EXISTS (
                  SELECT 1
                  FROM public.assay_methods am2
                  JOIN public.methods m ON m.id = am2.method_id
                  WHERE am2.assay_id = ad.id
                    AND m.name ILIKE '%' || p_search || '%'
              )
          )
    ),
    counted AS (
        SELECT COUNT(*) AS cnt FROM filtered_assays
    ),
    paginated AS (
        SELECT *
        FROM filtered_assays
        ORDER BY specialty_order NULLS LAST, name
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
        p.method_name,
        p.normal_range,
        p.validation_rules,
        p.is_confidential,
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
                FROM public.assay_methods am
                JOIN public.methods m ON m.id = am.method_id
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

REVOKE ALL ON FUNCTION public.get_assay_definitions(text, uuid, uuid, int, int) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_assay_definitions(text, uuid, uuid, int, int) TO authenticated;

COMMENT ON FUNCTION public.get_assay_definitions(text, uuid, uuid, int, int) IS
    'Returns paginated assay definitions with assay-owned method text, reference range, specialty info, confidentiality state, and legacy aggregated methods for compatibility.';

DROP FUNCTION IF EXISTS public.get_assay_definition_by_id(uuid);

CREATE FUNCTION public.get_assay_definition_by_id(p_id uuid)
RETURNS TABLE (
    id uuid,
    name text,
    specialty_id uuid,
    units text,
    method_name text,
    normal_range text,
    validation_rules jsonb,
    is_confidential boolean,
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
        ad.method_name,
        ad.normal_range,
        ad.validation_rules,
        ad.is_confidential,
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
                FROM public.assay_methods am
                JOIN public.methods m ON m.id = am.method_id
                WHERE am.assay_id = ad.id
            ),
            '[]'::jsonb
        ) AS methods,
        ad.created_at,
        ad.updated_at
    FROM public.assay_definitions ad
    WHERE ad.id = p_id
      AND ad.deleted_at IS NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.get_assay_definition_by_id(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_assay_definition_by_id(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_assay_definition_by_id(uuid) IS
    'Returns one assay definition with assay-owned method text, reference range, confidentiality state, and legacy aggregated methods for compatibility.';
