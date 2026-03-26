-- Migration 127: Harden search RPCs against confidential-associated records
-- Security Impact: High - prevents unauthorized discovery of confidential-associated samples, clients, results, and assays through search RPCs and global_search
-- Purpose: Keep search responses authorization-neutral by filtering confidential-associated rows before ranking and unioning results

SET search_path TO public;

DROP FUNCTION IF EXISTS public.client_has_confidential_samples(UUID);

CREATE OR REPLACE FUNCTION public.client_has_confidential_samples(
    p_client_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.samples AS sample_row
        WHERE sample_row.client_id = p_client_id
          AND public.sample_has_confidential_results(sample_row.id)
    );
$$;

COMMENT ON FUNCTION public.client_has_confidential_samples(UUID) IS
'Returns true when any sample for the client is confidential-associated. Used to keep client search authorization-neutral for unauthorized callers.';

REVOKE ALL ON FUNCTION public.client_has_confidential_samples(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.client_has_confidential_samples(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION search_samples(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    sample_id TEXT,
    client_name TEXT,
    type TEXT,
    status sample_status,
    received_at TIMESTAMPTZ,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.id,
        s.sample_id,
        s.client_name,
        s.type,
        s.status,
        s.received_at,
        ts_rank(s.search_vector, query) AS rank
    FROM samples AS s,
         plainto_tsquery('simple', unaccent(search_query)) AS query
    WHERE s.search_vector @@ query
      AND s.deleted_at IS NULL
      AND (
          public.user_can_access_confidential()
          OR NOT public.sample_has_confidential_results(s.id)
      )
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION search_clients(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    phone TEXT,
    address TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.phone,
        c.address,
        ts_rank(c.search_vector, query) AS rank
    FROM clients AS c,
         plainto_tsquery('simple', unaccent(search_query)) AS query
    WHERE c.search_vector @@ query
      AND (
          public.user_can_access_confidential()
          OR NOT public.client_has_confidential_samples(c.id)
      )
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION search_assays(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    units TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.units,
        ts_rank(a.search_vector, query) AS rank
    FROM assay_definitions AS a,
         plainto_tsquery('simple', unaccent(search_query)) AS query
    WHERE a.search_vector @@ query
      AND a.deleted_at IS NULL
      AND (
          public.user_can_access_confidential()
          OR NOT COALESCE(a.is_confidential, FALSE)
      )
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION search_results(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    sample_id UUID,
    assay_id UUID,
    value TEXT,
    status result_status,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        r.id,
        r.sample_id,
        r.assay_id,
        r.value,
        r.status,
        ts_rank(r.search_vector, query) AS rank
    FROM results AS r,
         plainto_tsquery('simple', unaccent(search_query)) AS query
    WHERE r.search_vector @@ query
      AND (
          public.user_can_access_confidential()
          OR NOT public.sample_has_confidential_results(r.sample_id)
      )
    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

CREATE OR REPLACE FUNCTION global_search(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    entity_type TEXT,
    entity_id UUID,
    description TEXT,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        'sample'::TEXT AS entity_type,
        s.id AS entity_id,
        (s.sample_id || ' - ' || s.client_name || ' (' || s.type || ')')::TEXT AS description,
        s.rank
    FROM search_samples(search_query, max_results) AS s

    UNION ALL

    SELECT
        'client'::TEXT AS entity_type,
        c.id AS entity_id,
        (c.name || ' - ' || c.phone)::TEXT AS description,
        c.rank
    FROM search_clients(search_query, max_results) AS c

    UNION ALL

    SELECT
        'assay'::TEXT AS entity_type,
        a.id AS entity_id,
        (a.name || COALESCE(' (' || a.units || ')', ''))::TEXT AS description,
        a.rank
    FROM search_assays(search_query, max_results) AS a

    UNION ALL

    SELECT
        'result'::TEXT AS entity_type,
        r.id AS entity_id,
        ('Result: ' || COALESCE(r.value, 'N/A') || ' (Status: ' || r.status::TEXT || ')')::TEXT AS description,
        r.rank
    FROM search_results(search_query, max_results) AS r

    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

COMMENT ON FUNCTION search_samples IS 'Full-text search for samples. Excludes soft-deleted and confidential-associated records for unauthorized users. RLS enforced.';
COMMENT ON FUNCTION search_clients IS 'Full-text search for clients. Excludes confidential-associated clients for unauthorized users. RLS enforced.';
COMMENT ON FUNCTION search_assays IS 'Full-text search for assay definitions. Excludes soft-deleted and confidential assays for unauthorized users. RLS enforced.';
COMMENT ON FUNCTION search_results IS 'Full-text search for results. Excludes results whose samples are confidential-associated for unauthorized users. RLS enforced.';
COMMENT ON FUNCTION global_search IS 'Combined full-text search across samples, clients, assays, and results. Confidential-associated matches are filtered before unioning and ranking.';
