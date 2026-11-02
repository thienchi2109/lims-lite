-- Migration 232: Add one server-authoritative accession-template snapshot.
-- Security impact: authenticated analyst-only, read-only SECURITY DEFINER RPC
-- with fixed search_path; internal catalog tables retain RLS and closed grants.
-- No service-role API access, business writes, audit events, policy changes or
-- changes to the legacy catalog reader/publication workflow. No client PII.
-- Apply only on the authorized home server; then run the focused SQL fixture
-- and run_security_tests(). Source contract tests do not execute this SQL.

BEGIN;

SET LOCAL search_path TO public, pg_temp;

DO $baseline$
DECLARE
    v_table_name TEXT;
BEGIN
    IF to_regprocedure('public.get_accession_template_snapshot()') IS NOT NULL
       OR to_regprocedure('public.get_published_assay_sample_type_catalog(uuid)') IS NULL
       OR to_regprocedure('public.publish_assay_sample_type_catalog_revision(uuid,timestamp with time zone,text)') IS NULL
       OR to_regprocedure('public.get_user_role()') IS NULL
       OR to_regprocedure('public.run_security_tests()') IS NULL
    THEN
        RAISE EXCEPTION 'Migration 232 requires the existing catalog RPC baseline and an unused snapshot signature';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM (VALUES
            ('users', 'id', 'uuid', 'NO'),
            ('users', 'deleted_at', 'timestamp with time zone', 'YES'),
            ('assay_definitions', 'id', 'uuid', 'NO'),
            ('assay_definitions', 'import_code', 'text', 'NO'),
            ('assay_definitions', 'name', 'text', 'NO'),
            ('assay_definitions', 'method_name', 'text', 'YES'),
            ('assay_definitions', 'compatibility_generation', 'bigint', 'NO'),
            ('assay_definitions', 'deleted_at', 'timestamp with time zone', 'YES'),
            ('sample_types', 'id', 'uuid', 'NO'),
            ('sample_types', 'import_code', 'text', 'NO'),
            ('sample_types', 'name', 'text', 'NO'),
            ('sample_types', 'compatibility_generation', 'bigint', 'NO'),
            ('sample_types', 'deleted_at', 'timestamp with time zone', 'YES'),
            ('assay_sample_type_catalog_revisions', 'id', 'uuid', 'NO'),
            ('assay_sample_type_catalog_revisions', 'revision_number', 'bigint', 'NO'),
            ('assay_sample_type_catalog_revisions', 'status', 'text', 'NO'),
            ('assay_sample_type_reviews', 'revision_id', 'uuid', 'NO'),
            ('assay_sample_type_reviews', 'assay_definition_id', 'uuid', 'NO'),
            ('assay_sample_type_reviews', 'disposition', 'text', 'NO'),
            ('assay_sample_type_reviews', 'assay_compatibility_generation', 'bigint', 'NO'),
            ('assay_sample_type_compatibilities', 'revision_id', 'uuid', 'NO'),
            ('assay_sample_type_compatibilities', 'sample_type_id', 'uuid', 'NO'),
            ('assay_sample_type_compatibilities', 'assay_definition_id', 'uuid', 'NO'),
            ('assay_sample_type_compatibilities', 'assay_compatibility_generation', 'bigint', 'NO'),
            ('assay_sample_type_compatibilities', 'sample_type_compatibility_generation', 'bigint', 'NO'),
            ('assay_sample_type_compatibilities', 'removed_at', 'timestamp with time zone', 'YES')
        ) AS expected(table_name, column_name, data_type, is_nullable)
        LEFT JOIN information_schema.columns AS actual
          ON actual.table_schema = 'public'
         AND actual.table_name = expected.table_name
         AND actual.column_name = expected.column_name
         AND actual.data_type = expected.data_type
         AND actual.is_nullable = expected.is_nullable
        WHERE actual.column_name IS NULL
    ) THEN
        RAISE EXCEPTION 'Migration 232 found an incompatible authority schema';
    END IF;

    -- Canonical entity code uniqueness and one published revision remain DB-owned.
    IF NOT EXISTS (
        SELECT 1 FROM pg_index
        WHERE indexrelid = to_regclass('public.uq_assay_sample_type_catalog_one_published')
          AND indisunique AND indisvalid
          AND pg_get_expr(indpred, indrelid) = '(status = ''published''::text)'
    ) OR EXISTS (
        SELECT 1 FROM (VALUES
            ('assay_definitions', 'assay_definitions_import_code_key'),
            ('sample_types', 'sample_types_import_code_key')
        ) AS expected(table_name, constraint_name)
        WHERE NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conrelid = to_regclass('public.' || expected.table_name)
              AND conname = expected.constraint_name AND contype = 'u'
        )
    ) THEN
        RAISE EXCEPTION 'Migration 232 requires unique canonical codes and one published revision';
    END IF;

    FOREACH v_table_name IN ARRAY ARRAY[
        'assay_sample_type_catalog_revisions', 'assay_sample_type_reviews',
        'assay_sample_type_compatibilities', 'assay_sample_type_candidates'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_class
            WHERE oid = to_regclass('public.' || v_table_name) AND relrowsecurity
        ) OR has_table_privilege('authenticated', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('anon', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE')
        THEN
            RAISE EXCEPTION 'Migration 232 requires closed catalog RLS/grants: %', v_table_name;
        END IF;
    END LOOP;
END;
$baseline$;

CREATE FUNCTION public.get_accession_template_snapshot()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_snapshot JSONB;
BEGIN
    IF auth.uid() IS NULL
       OR public.get_user_role() IS DISTINCT FROM 'analyst'
       OR NOT EXISTS (
           SELECT 1 FROM public.users AS caller
           WHERE caller.id = auth.uid() AND caller.deleted_at IS NULL
       )
    THEN
        RAISE EXCEPTION 'ACCESSION_TEMPLATE_ANALYST_REQUIRED'
            USING ERRCODE = '42501';
    END IF;

    -- All authority reads belong to this statement. No legacy API fan-out.
    WITH published_revision AS MATERIALIZED (
        SELECT revision.id, revision.revision_number
        FROM public.assay_sample_type_catalog_revisions AS revision
        WHERE revision.status = 'published'
    ), eligible_pairs AS MATERIALIZED (
        SELECT DISTINCT compatibility.sample_type_id, compatibility.assay_definition_id
        FROM published_revision AS revision
        JOIN public.assay_sample_type_compatibilities AS compatibility
          ON compatibility.revision_id = revision.id
        JOIN public.assay_sample_type_reviews AS review
          ON review.revision_id = compatibility.revision_id
         AND review.assay_definition_id = compatibility.assay_definition_id
        JOIN public.assay_definitions AS assay
          ON assay.id = compatibility.assay_definition_id
        JOIN public.sample_types AS sample_type
          ON sample_type.id = compatibility.sample_type_id
        WHERE compatibility.removed_at IS NULL
          AND review.disposition = 'configured'
          AND assay.deleted_at IS NULL
          AND sample_type.deleted_at IS NULL
          AND review.assay_compatibility_generation = assay.compatibility_generation
          AND compatibility.assay_compatibility_generation = assay.compatibility_generation
          AND compatibility.sample_type_compatibility_generation = sample_type.compatibility_generation
    )
    SELECT jsonb_build_object(
        'revisionId', revision.id,
        'revisionNumber', revision.revision_number::TEXT,
        'sampleTypes', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', sample_type.id,
                'importCode', sample_type.import_code,
                'name', sample_type.name,
                'compatibilityGeneration', sample_type.compatibility_generation::TEXT
            ) ORDER BY sample_type.import_code)
            FROM public.sample_types AS sample_type
            WHERE EXISTS (
                SELECT 1 FROM eligible_pairs AS pair
                WHERE pair.sample_type_id = sample_type.id
            )
        ), '[]'::JSONB),
        'assays', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'id', assay.id,
                'importCode', assay.import_code,
                'name', assay.name,
                'methodName', assay.method_name,
                'compatibilityGeneration', assay.compatibility_generation::TEXT
            ) ORDER BY assay.import_code)
            FROM public.assay_definitions AS assay
            WHERE EXISTS (
                SELECT 1 FROM eligible_pairs AS pair
                WHERE pair.assay_definition_id = assay.id
            )
        ), '[]'::JSONB),
        'pairs', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'sampleTypeId', pair.sample_type_id,
                'assayDefinitionId', pair.assay_definition_id
            ) ORDER BY pair.sample_type_id, pair.assay_definition_id)
            FROM eligible_pairs AS pair
        ), '[]'::JSONB)
    ) INTO v_snapshot
    FROM published_revision AS revision;

    IF v_snapshot IS NULL
       OR jsonb_array_length(v_snapshot -> 'pairs') = 0
    THEN
        RAISE EXCEPTION 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE'
            USING ERRCODE = 'P0001';
    END IF;

    RETURN v_snapshot;
END;
$$;

ALTER FUNCTION public.get_accession_template_snapshot() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.get_accession_template_snapshot()
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_accession_template_snapshot() TO authenticated;

COMMENT ON FUNCTION public.get_accession_template_snapshot() IS
    'Analyst-only consistent published authority; revision/generations are lossless decimal strings, pairs reference canonical entity UUIDs. Read-only, no PII.';

DO $verification$
DECLARE
    v_function REGPROCEDURE := 'public.get_accession_template_snapshot()'::REGPROCEDURE;
    v_table_name TEXT;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc
        WHERE oid = v_function AND prosecdef AND provolatile = 's'
          AND prorettype = 'jsonb'::REGTYPE
          AND proowner = 'postgres'::REGROLE
          AND proconfig @> ARRAY['search_path=public, pg_temp']
    ) OR NOT has_function_privilege('authenticated', v_function, 'EXECUTE')
      OR has_function_privilege('anon', v_function, 'EXECUTE')
      OR has_function_privilege('service_role', v_function, 'EXECUTE')
      OR EXISTS (
          SELECT 1 FROM pg_proc AS function_row,
              LATERAL aclexplode(COALESCE(function_row.proacl, acldefault('f', function_row.proowner))) AS privilege
          WHERE function_row.oid = v_function
            AND privilege.grantee = 0 AND privilege.privilege_type = 'EXECUTE'
      )
    THEN
        RAISE EXCEPTION 'Migration 232 snapshot security verification failed';
    END IF;

    FOREACH v_table_name IN ARRAY ARRAY[
        'assay_sample_type_catalog_revisions', 'assay_sample_type_reviews',
        'assay_sample_type_compatibilities', 'assay_sample_type_candidates'
    ] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_class
            WHERE oid = to_regclass('public.' || v_table_name) AND relrowsecurity
        ) OR has_table_privilege('authenticated', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE')
          OR has_table_privilege('anon', 'public.' || v_table_name, 'SELECT,INSERT,UPDATE,DELETE')
        THEN
            RAISE EXCEPTION 'Migration 232 changed catalog RLS/grants: %', v_table_name;
        END IF;
    END LOOP;
END;
$verification$;

COMMIT;
