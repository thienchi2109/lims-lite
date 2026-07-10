-- Migration 156: Add confidential-only filter support to get_samples_page RPC
-- Security Impact: Medium - adds an explicit confidential-only read mode while preserving non-discoverability for unauthorized users
-- Purpose: Let authorized users filter the Samples page to samples with confidential results without exposing rows or counts to unauthorized callers

SET search_path TO public, extensions;

DROP FUNCTION IF EXISTS get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    BOOLEAN,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    UUID,
    UUID[],
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
);

DROP FUNCTION IF EXISTS get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    BOOLEAN,
    BOOLEAN,
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
    p_rejected_only BOOLEAN DEFAULT FALSE,
    p_confidential_only BOOLEAN DEFAULT FALSE,
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
          AND (
              p_rejected_only IS NOT TRUE
              OR (s.status = 'in_progress' AND s.rejected_at IS NOT NULL)
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
              (
                  p_confidential_only IS TRUE
                  AND user_can_access_confidential()
                  AND public.sample_has_confidential_results(s.id)
              )
              OR (
                  p_confidential_only IS NOT TRUE
                  AND (
                      user_can_access_confidential()
                      OR NOT public.sample_has_confidential_results(s.id)
                  )
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

REVOKE ALL ON FUNCTION get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    BOOLEAN,
    BOOLEAN,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    UUID,
    UUID[],
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION get_samples_page(
    TEXT,
    TEXT,
    sample_status,
    BOOLEAN,
    BOOLEAN,
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
    BOOLEAN,
    BOOLEAN,
    TIMESTAMPTZ,
    TIMESTAMPTZ,
    UUID,
    UUID[],
    TEXT,
    TEXT,
    INTEGER,
    INTEGER
) IS 'Returns paginated sample rows plus total_count in a single RPC while supporting rejected-only and confidential-only filtering; unauthorized confidential-only requests return no rows or counts.';

CREATE OR REPLACE FUNCTION public.test_samples_page_confidential_only_rpc_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
DECLARE
    v_function_def TEXT;
    v_is_security_definer BOOLEAN;
BEGIN
    SELECT pg_get_functiondef(p.oid), p.prosecdef
    INTO v_function_def, v_is_security_definer
    FROM pg_proc p
    INNER JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'get_samples_page'
      AND pg_get_functiondef(p.oid) ILIKE '%p_confidential_only boolean DEFAULT false%'
    LIMIT 1;

    IF v_function_def IS NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: get_samples_page is missing p_confidential_only BOOLEAN DEFAULT FALSE';
        RETURN FALSE;
    END IF;

    IF v_is_security_definer IS TRUE THEN
        RAISE WARNING 'SECURITY TEST FAILED: get_samples_page must remain SECURITY INVOKER';
        RETURN FALSE;
    END IF;

    IF v_function_def NOT ILIKE '%p_confidential_only IS TRUE%user_can_access_confidential()%public.sample_has_confidential_results(s.id)%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: confidential-only branch must require user_can_access_confidential() and confidential sample association';
        RETURN FALSE;
    END IF;

    IF v_function_def NOT ILIKE '%p_confidential_only IS NOT TRUE%user_can_access_confidential()%OR NOT public.sample_has_confidential_results(s.id)%' THEN
        RAISE WARNING 'SECURITY TEST FAILED: default branch must preserve confidential concealment for unauthorized users';
        RETURN FALSE;
    END IF;

    IF position('counted_samples AS' IN v_function_def) <= position('p_confidential_only IS TRUE' IN v_function_def) THEN
        RAISE WARNING 'SECURITY TEST FAILED: confidential predicate must appear before counted_samples';
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.test_samples_page_confidential_only_rpc_guard() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_samples_page_confidential_only_rpc_guard() TO authenticated;

CREATE OR REPLACE FUNCTION public.test_sensitive_search_rpc_execute_privileges()
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
    v_anon_executable TEXT;
    v_authenticated_missing TEXT;
BEGIN
    WITH protected_functions(function_name, signature) AS (
        VALUES
            ('get_samples_page', 'public.get_samples_page(text, text, sample_status, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid, uuid[], text, text, integer, integer)'),
            ('global_search', 'public.global_search(text, integer)'),
            ('search_assays', 'public.search_assays(text, integer)'),
            ('search_clients', 'public.search_clients(text, integer)'),
            ('search_results', 'public.search_results(text, integer)'),
            ('search_samples', 'public.search_samples(text, integer)')
    )
    SELECT string_agg(function_name, ', ' ORDER BY function_name)
    INTO v_anon_executable
    FROM protected_functions
    WHERE has_function_privilege('anon', signature, 'EXECUTE');

    IF v_anon_executable IS NOT NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: anon can execute sensitive search/page RPCs: %', v_anon_executable;
        RETURN FALSE;
    END IF;

    WITH protected_functions(function_name, signature) AS (
        VALUES
            ('get_samples_page', 'public.get_samples_page(text, text, sample_status, boolean, boolean, timestamp with time zone, timestamp with time zone, uuid, uuid[], text, text, integer, integer)'),
            ('global_search', 'public.global_search(text, integer)'),
            ('search_assays', 'public.search_assays(text, integer)'),
            ('search_clients', 'public.search_clients(text, integer)'),
            ('search_results', 'public.search_results(text, integer)'),
            ('search_samples', 'public.search_samples(text, integer)')
    )
    SELECT string_agg(function_name, ', ' ORDER BY function_name)
    INTO v_authenticated_missing
    FROM protected_functions
    WHERE NOT has_function_privilege('authenticated', signature, 'EXECUTE');

    IF v_authenticated_missing IS NOT NULL THEN
        RAISE WARNING 'SECURITY TEST FAILED: authenticated cannot execute required search/page RPCs: %', v_authenticated_missing;
        RETURN FALSE;
    END IF;

    RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.test_sensitive_search_rpc_execute_privileges() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.test_sensitive_search_rpc_execute_privileges() TO authenticated;

CREATE OR REPLACE FUNCTION public.run_security_tests()
RETURNS TABLE(
    test_name TEXT,
    passed BOOLEAN,
    message TEXT
)
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    RAISE NOTICE '=== Running Security Verification Tests ===';
    RAISE NOTICE '';
    RETURN QUERY VALUES
        ('Results INSERT Policy Count'::TEXT, test_results_insert_policy_count(), 'Verifies only one INSERT policy exists on results table'::TEXT),
        ('Results INSERT Role Check'::TEXT, test_results_insert_has_role_check(), 'Verifies INSERT policy includes get_user_role() check'::TEXT),
        ('No Orphaned Vulnerable Policies'::TEXT, test_no_orphaned_vulnerable_policies(), 'Verifies old vulnerable policies have been removed'::TEXT),
        ('All RLS Tables Have Policies'::TEXT, test_all_rls_tables_have_policies(), 'Verifies all tables with RLS have at least one policy'::TEXT),
        ('Critical Policies Have Access Control'::TEXT, test_critical_policies_have_role_checks(), 'Verifies critical policies have role or ownership checks'::TEXT),
        ('Confidential Schema Columns Exist'::TEXT, test_confidential_schema_columns_exist(), 'Verifies confidential schema columns exist as non-null booleans with safe defaults'::TEXT),
        ('Confidential Access Helper Security'::TEXT, test_confidential_access_helper_security(), 'Verifies user_can_access_confidential() stays boolean, STABLE, SECURITY DEFINER, and executable by authenticated and anon roles'::TEXT),
        ('Results Confidential Policy Guards'::TEXT, test_results_confidential_policy_guards(), 'Verifies results SELECT/INSERT/UPDATE policies keep the confidential assay guard tied to user_can_access_confidential()'::TEXT),
        ('Samples Page Confidential-only RPC Guard'::TEXT, test_samples_page_confidential_only_rpc_guard(), 'Verifies get_samples_page keeps confidential-only filtering fail-closed before counts and pagination'::TEXT),
        ('Security Definer RPC Execute Privileges'::TEXT, test_security_definer_rpc_execute_privileges(), 'Verifies anonymous users cannot execute hardened SECURITY DEFINER RPCs and required roles retain access'::TEXT),
        ('Security Definer RPC Search Path'::TEXT, test_security_definer_rpc_search_path(), 'Verifies hardened sample accession SECURITY DEFINER RPCs pin search_path'::TEXT),
        ('Samples INSERT Analyst Receiver Policy'::TEXT, test_samples_insert_policy_requires_analyst_receiver(), 'Verifies sample INSERT policy is analyst-only and requires received_by = auth.uid()'::TEXT),
        ('Sample Receiver Trigger Guard'::TEXT, test_sample_receiver_guard(), 'Verifies public.samples receiver trigger enforces analyst-only inserts and immutable receivers'::TEXT),
        ('Sample Accession RPC Analyst Role Guard'::TEXT, test_sample_accession_rpcs_require_analyst_role(), 'Verifies sample accession SECURITY DEFINER RPCs reject manager role branches'::TEXT),
        ('Doctor Role Enum Exists'::TEXT, test_doctor_role_enum_exists(), 'Verifies public.user_role includes doctor'::TEXT),
        ('Doctor Samples SELECT Policy Guard'::TEXT, test_doctor_samples_select_policy_guard(), 'Verifies doctor samples visibility is completed-only and confidential-aware'::TEXT),
        ('Doctor CoA SELECT Policy Guard'::TEXT, test_doctor_coa_select_policy_guard(), 'Verifies doctor CoA metadata visibility is ready/completed/confidential-aware'::TEXT),
        ('Doctor CoA Storage Policy Guard'::TEXT, test_doctor_coa_storage_policy_guard(), 'Verifies doctor CoA storage visibility is ready/completed/confidential-aware'::TEXT),
        ('CoA Storage Service Role Policy Guard'::TEXT, test_coa_storage_service_role_policy_guard(), 'Verifies coa-reports storage keeps explicit service_role policies for maintenance access'::TEXT),
        ('CoA Reports Service Role UPDATE Grant'::TEXT, test_coa_reports_service_role_update_grant(), 'Verifies service_role keeps UPDATE on public.coa_reports for maintenance hash sync'::TEXT),
        ('Doctor Excluded From Operational Policies'::TEXT, test_doctor_not_in_operational_policies(), 'Verifies doctor is not present in write/operational policy branches'::TEXT),
        ('Manager User Write Boundary Guard'::TEXT, test_manager_user_write_boundary_guard(), 'Verifies public.users manager write guard covers manager rows, analyst-only confidential flag changes, and trusted service_role administration'::TEXT),
        ('Analyst OTP Management Prerequisites'::TEXT, test_analyst_otp_management_prerequisites(), 'Verifies analyst OTP settings policies, hashed audit logs, and missing-destination preflight RPC'::TEXT),
        ('OTP Challenge Lifecycle Audit'::TEXT, test_otp_challenge_lifecycle_audit(), 'Verifies OTP challenge lifecycle audit excludes OTP verifier material and hashes session identifiers'::TEXT),
        ('Sensitive Search RPC Execute Privileges'::TEXT, test_sensitive_search_rpc_execute_privileges(), 'Verifies anon cannot execute sensitive sample/result search RPCs and authenticated users retain access'::TEXT);
    RAISE NOTICE '';
    RAISE NOTICE '=== Security Tests Complete ===';
END;
$$;

REVOKE ALL ON FUNCTION public.run_security_tests() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.run_security_tests() TO authenticated;

COMMENT ON FUNCTION public.run_security_tests() IS
'Runs all security verification tests, including confidential-only Samples page RPC non-discoverability guards.';
