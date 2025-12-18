-- Migration 075: Create search functions for full-text search
-- Description: Adds search functions for samples, clients, assays, results, audit_logs, and global search
-- Security: All functions use SECURITY INVOKER to enforce RLS policies

SET search_path TO public;

-- ============================================================================
-- 1. search_samples(query TEXT, max_results INT DEFAULT 20)
-- ============================================================================
-- Returns: id, sample_id, client_name, type, status, received_at, rank
-- Filters: deleted_at IS NULL (soft-deleted records excluded)
-- Access: All authenticated users (RLS enforced)
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
SECURITY INVOKER  -- RLS policies enforced
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
    FROM
        samples s,
        plainto_tsquery('simple', unaccent(search_query)) query
    WHERE
        s.search_vector @@ query
        AND s.deleted_at IS NULL  -- Exclude soft-deleted records
    ORDER BY
        rank DESC
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- 2. search_clients(query TEXT, max_results INT DEFAULT 20)
-- ============================================================================
-- Returns: id, name, phone, address, rank
-- Filters: None (clients don't have deleted_at)
-- Access: All authenticated users (RLS enforced)
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
SECURITY INVOKER  -- RLS policies enforced
AS $$
BEGIN
    RETURN QUERY
    SELECT
        c.id,
        c.name,
        c.phone,
        c.address,
        ts_rank(c.search_vector, query) AS rank
    FROM
        clients c,
        plainto_tsquery('simple', unaccent(search_query)) query
    WHERE
        c.search_vector @@ query
    ORDER BY
        rank DESC
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- 3. search_assays(query TEXT, max_results INT DEFAULT 20)
-- ============================================================================
-- Returns: id, name, units, rank
-- Filters: deleted_at IS NULL (soft-deleted records excluded)
-- Access: All authenticated users (RLS enforced)
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
SECURITY INVOKER  -- RLS policies enforced
AS $$
BEGIN
    RETURN QUERY
    SELECT
        a.id,
        a.name,
        a.units,
        ts_rank(a.search_vector, query) AS rank
    FROM
        assay_definitions a,
        plainto_tsquery('simple', unaccent(search_query)) query
    WHERE
        a.search_vector @@ query
        AND a.deleted_at IS NULL  -- Exclude soft-deleted records
    ORDER BY
        rank DESC
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- 4. search_results(query TEXT, max_results INT DEFAULT 20)
-- ============================================================================
-- Returns: id, sample_id, assay_id, value, status, rank
-- Filters: None (results don't have deleted_at, but RLS filters via samples.deleted_at)
-- Access: All authenticated users (RLS enforced)
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
SECURITY INVOKER  -- RLS policies enforced
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
    FROM
        results r,
        plainto_tsquery('simple', unaccent(search_query)) query
    WHERE
        r.search_vector @@ query
    ORDER BY
        rank DESC
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- 5. search_audit_logs(query TEXT, max_results INT DEFAULT 20)
-- ============================================================================
-- Returns: id, operation, table_name, changed_at, rank
-- Filters: None (audit logs are never deleted)
-- Access: MANAGERS ONLY (explicit role check)
CREATE OR REPLACE FUNCTION search_audit_logs(
    search_query TEXT,
    max_results INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    operation TEXT,
    table_name TEXT,
    changed_at TIMESTAMPTZ,
    rank REAL
)
LANGUAGE plpgsql
SECURITY INVOKER  -- RLS policies enforced
AS $$
BEGIN
    -- Enforce manager-only access
    IF get_user_role() != 'manager' THEN
        RAISE EXCEPTION 'Access denied: Only managers can search audit logs'
            USING ERRCODE = 'insufficient_privilege';
    END IF;

    RETURN QUERY
    SELECT
        a.id,
        a.operation,
        a.table_name,
        a.changed_at,
        ts_rank(a.search_vector, query) AS rank
    FROM
        audit_logs a,
        plainto_tsquery('simple', unaccent(search_query)) query
    WHERE
        a.search_vector @@ query
    ORDER BY
        rank DESC
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- 6. global_search(query TEXT, max_results INT DEFAULT 20)
-- ============================================================================
-- Returns: Combined search results from all entities
-- Format: {entity_type, id, description, rank}
-- Access: All authenticated users (calls other search functions which enforce RLS)
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
SECURITY INVOKER  -- RLS policies enforced via sub-functions
AS $$
BEGIN
    RETURN QUERY
    -- Samples
    SELECT
        'sample'::TEXT AS entity_type,
        s.id AS entity_id,
        (s.sample_id || ' - ' || s.client_name || ' (' || s.type || ')')::TEXT AS description,
        s.rank
    FROM search_samples(search_query, max_results) s

    UNION ALL

    -- Clients
    SELECT
        'client'::TEXT AS entity_type,
        c.id AS entity_id,
        (c.name || ' - ' || c.phone)::TEXT AS description,
        c.rank
    FROM search_clients(search_query, max_results) c

    UNION ALL

    -- Assays
    SELECT
        'assay'::TEXT AS entity_type,
        a.id AS entity_id,
        (a.name || COALESCE(' (' || a.units || ')', ''))::TEXT AS description,
        a.rank
    FROM search_assays(search_query, max_results) a

    UNION ALL

    -- Results
    SELECT
        'result'::TEXT AS entity_type,
        r.id AS entity_id,
        ('Result: ' || COALESCE(r.value, 'N/A') || ' (Status: ' || r.status::TEXT || ')')::TEXT AS description,
        r.rank
    FROM search_results(search_query, max_results) r

    ORDER BY rank DESC
    LIMIT max_results;
END;
$$;

-- ============================================================================
-- Grant EXECUTE permissions to authenticated role
-- ============================================================================
GRANT EXECUTE ON FUNCTION search_samples TO authenticated;
GRANT EXECUTE ON FUNCTION search_clients TO authenticated;
GRANT EXECUTE ON FUNCTION search_assays TO authenticated;
GRANT EXECUTE ON FUNCTION search_results TO authenticated;
GRANT EXECUTE ON FUNCTION search_audit_logs TO authenticated;  -- Role check inside function
GRANT EXECUTE ON FUNCTION global_search TO authenticated;

-- ============================================================================
-- Add comments for documentation
-- ============================================================================
COMMENT ON FUNCTION search_samples IS 'Full-text search for samples. Excludes soft-deleted records. RLS enforced.';
COMMENT ON FUNCTION search_clients IS 'Full-text search for clients. RLS enforced.';
COMMENT ON FUNCTION search_assays IS 'Full-text search for assay definitions. Excludes soft-deleted records. RLS enforced.';
COMMENT ON FUNCTION search_results IS 'Full-text search for results. RLS enforced (filters via samples.deleted_at).';
COMMENT ON FUNCTION search_audit_logs IS 'Full-text search for audit logs. MANAGERS ONLY. RLS enforced.';
COMMENT ON FUNCTION global_search IS 'Combined full-text search across samples, clients, assays, and results. RLS enforced.';
