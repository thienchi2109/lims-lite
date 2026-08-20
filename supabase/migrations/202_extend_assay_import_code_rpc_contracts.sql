-- Migration 202: Expose stable assay import codes through assay read RPCs.
--
-- Security impact:
-- - Preserves existing assay RLS policies and table grants.
-- - Recreates only the existing read RPCs with their current authenticated
--   EXECUTE grant, SECURITY DEFINER mode, and fixed public search_path.
-- - Does not add mutation RPCs or accept import_code from any client input.
--
-- Compatibility impact:
-- - Keeps every existing list/detail field, filter, pagination rule, and
--   assay-owned method_name contract from migration 147.
-- - Adds import_code as a read-only result field after migration 201.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'assay_definitions'
          AND column_name = 'import_code'
          AND data_type = 'text'
          AND is_nullable = 'NO'
    ) THEN
        RAISE EXCEPTION
            'Migration 202 requires migration 201 assay import-code core';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.assay_definitions'::REGCLASS
          AND tgname = 'assay_definitions_import_code_immutable'
          AND tgenabled = 'O'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION
            'Migration 202 requires the assay import-code immutability trigger';
    END IF;

    IF to_regprocedure(
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)'
    ) IS NULL
       OR to_regprocedure(
           'public.get_assay_definition_by_id(uuid)'
       ) IS NULL
    THEN
        RAISE EXCEPTION
            'Migration 202 requires the existing assay read RPCs';
    END IF;
END;
$baseline$;

DROP FUNCTION public.get_assay_definitions(text, uuid, uuid, int, int);

CREATE FUNCTION public.get_assay_definitions(
    p_search text DEFAULT NULL,
    p_method_id uuid DEFAULT NULL,
    p_specialty_id uuid DEFAULT NULL,
    p_page int DEFAULT 1,
    p_page_size int DEFAULT 10
)
RETURNS TABLE (
    id uuid,
    import_code text,
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
            ad.import_code,
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
        p.import_code,
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
    'Returns paginated assay definitions with stable import code, assay-owned method text, reference range, specialty info, confidentiality state, and legacy aggregated methods for compatibility.';

DROP FUNCTION public.get_assay_definition_by_id(uuid);

CREATE FUNCTION public.get_assay_definition_by_id(p_id uuid)
RETURNS TABLE (
    id uuid,
    import_code text,
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
        ad.import_code,
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
    'Returns one assay definition with stable import code, assay-owned method text, reference range, confidentiality state, and legacy aggregated methods for compatibility.';

DO $verification$
DECLARE
    v_list_result TEXT;
    v_detail_result TEXT;
BEGIN
    SELECT pg_get_function_result(
        'public.get_assay_definitions(text,uuid,uuid,integer,integer)'::REGPROCEDURE
    )
    INTO v_list_result;

    SELECT pg_get_function_result(
        'public.get_assay_definition_by_id(uuid)'::REGPROCEDURE
    )
    INTO v_detail_result;

    IF v_list_result NOT LIKE '%import_code text%'
       OR v_detail_result NOT LIKE '%import_code text%'
       OR v_list_result NOT LIKE '%method_name text%'
       OR v_detail_result NOT LIKE '%method_name text%'
       OR v_list_result LIKE '%method_id uuid%'
       OR v_detail_result LIKE '%method_id uuid%'
    THEN
        RAISE EXCEPTION
            'Migration 202 produced an incompatible assay RPC row shape';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid = (
            'public.get_assay_definitions(text,uuid,uuid,integer,integer)'
        )::REGPROCEDURE
          AND prosecdef
          AND proconfig = ARRAY['search_path=public']
    )
       OR NOT EXISTS (
           SELECT 1
           FROM pg_proc
           WHERE oid = (
               'public.get_assay_definition_by_id(uuid)'
           )::REGPROCEDURE
             AND prosecdef
             AND proconfig = ARRAY['search_path=public']
       )
    THEN
        RAISE EXCEPTION
            'Migration 202 failed to preserve assay RPC security settings';
    END IF;
END;
$verification$;

COMMIT;
