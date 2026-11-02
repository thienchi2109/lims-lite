-- Rollback-only real-RPC checks after migration 232 on the authorized server.
-- Requires an existing published catalog with at least one eligible pair.
-- Uses synthetic profiles and reversible master drift; never disables RLS or
-- triggers. Does not seed the complete stale/removed/duplicate/concurrency matrix.
-- NOT RUN in source-only Phase 1. Invoke with psql -v ON_ERROR_STOP=1 through
-- the approved home-server SSH + sudo Docker path; all fixture changes roll back.
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
BEGIN;
SET LOCAL lock_timeout = '3s';
SET LOCAL statement_timeout = '30s';
SET LOCAL search_path TO public, pg_temp;

CREATE FUNCTION pg_temp.assert_template_snapshot(p_condition BOOLEAN, p_message TEXT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    IF p_condition IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'snapshot assertion failed: %', p_message;
    END IF;
END;
$$;

CREATE FUNCTION pg_temp.expect_template_snapshot_denied()
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
    PERFORM public.get_accession_template_snapshot();
    RAISE EXCEPTION 'snapshot unexpectedly authorized';
EXCEPTION WHEN insufficient_privilege THEN
    RETURN;
END;
$$;

DO $contract$
DECLARE
    v_analyst_id UUID := '95380000-0000-0000-0000-000000000001';
    v_manager_id UUID := '95380000-0000-0000-0000-000000000002';
    v_doctor_id UUID := '95380000-0000-0000-0000-000000000003';
    v_missing_id UUID := '95380000-0000-0000-0000-000000000004';
    v_actor RECORD;
    v_snapshot JSONB;
    v_after JSONB;
    v_revision_id UUID;
    v_assay_id UUID;
    v_sample_type_id UUID;
    v_expected_pairs JSONB;
    v_before_counts BIGINT[];
    v_after_counts BIGINT[];
BEGIN
    FOR v_actor IN SELECT * FROM (VALUES
        (v_analyst_id, 'analyst'), (v_manager_id, 'manager'), (v_doctor_id, 'doctor')
    ) AS actors(id, role) LOOP
        INSERT INTO auth.users (id, email)
        VALUES (v_actor.id, 'snapshot-' || v_actor.role || '@lims.local');
        INSERT INTO public.users (id, username, full_name, role, email, can_access_confidential)
        VALUES (v_actor.id, 'snapshot_' || v_actor.role, 'Synthetic snapshot ' || v_actor.role,
                v_actor.role::public.user_role, 'snapshot-' || v_actor.role || '@lims.local', FALSE);
    END LOOP;
    INSERT INTO auth.users (id, email) VALUES (v_missing_id, 'snapshot-missing@lims.local');

    -- SQL-role grants and current profile authorization are separate boundaries.
    PERFORM pg_temp.assert_template_snapshot(
        has_function_privilege('authenticated', 'public.get_accession_template_snapshot()', 'EXECUTE')
        AND NOT has_function_privilege('anon', 'public.get_accession_template_snapshot()', 'EXECUTE')
        AND NOT has_function_privilege('service_role', 'public.get_accession_template_snapshot()', 'EXECUTE'),
        'authenticated-only EXECUTE');
    FOR v_actor IN SELECT id FROM (VALUES
        (v_manager_id), (v_doctor_id), (v_missing_id), (NULL::UUID)
    ) AS denied(id) LOOP
        PERFORM set_config('request.jwt.claim.sub', COALESCE(v_actor.id::TEXT, ''), TRUE);
        PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_actor.id, 'role', 'authenticated')::TEXT, TRUE);
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM pg_temp.expect_template_snapshot_denied();
        EXECUTE 'RESET ROLE';
    END LOOP;
    EXECUTE 'SET LOCAL ROLE anon';
    PERFORM pg_temp.expect_template_snapshot_denied();
    EXECUTE 'RESET ROLE';
    EXECUTE 'SET LOCAL ROLE service_role';
    PERFORM pg_temp.expect_template_snapshot_denied();
    EXECUTE 'RESET ROLE';

    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, TRUE);
    PERFORM set_config('request.jwt.claims', jsonb_build_object('sub', v_analyst_id, 'role', 'authenticated')::TEXT, TRUE);
    BEGIN
        UPDATE public.users SET deleted_at = clock_timestamp() WHERE id = v_analyst_id;
        EXECUTE 'SET LOCAL ROLE authenticated';
        PERFORM pg_temp.expect_template_snapshot_denied();
        EXECUTE 'RESET ROLE';
        RAISE EXCEPTION USING ERRCODE = 'ZT001';
    EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
    END;
    SELECT ARRAY[(SELECT count(*) FROM public.clients), (SELECT count(*) FROM public.samples),
                 (SELECT count(*) FROM public.results), (SELECT count(*) FROM public.audit_logs)] INTO v_before_counts;
    EXECUTE 'SET LOCAL ROLE authenticated';
    v_snapshot := public.get_accession_template_snapshot();
    BEGIN
        PERFORM 1 FROM public.assay_sample_type_compatibilities;
        RAISE EXCEPTION 'authenticated catalog table access unexpectedly allowed';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    EXECUTE 'RESET ROLE';
    SELECT ARRAY[(SELECT count(*) FROM public.clients), (SELECT count(*) FROM public.samples),
                 (SELECT count(*) FROM public.results), (SELECT count(*) FROM public.audit_logs)] INTO v_after_counts;
    PERFORM pg_temp.assert_template_snapshot(v_before_counts = v_after_counts, 'snapshot has no business/audit writes');

    v_revision_id := (v_snapshot ->> 'revisionId')::UUID;
    PERFORM pg_temp.assert_template_snapshot(EXISTS (
        SELECT 1 FROM public.assay_sample_type_catalog_revisions
        WHERE id = v_revision_id AND status = 'published'
          AND revision_number::TEXT = v_snapshot ->> 'revisionNumber'
    ), 'published revision and lossless revision number');
    PERFORM pg_temp.assert_template_snapshot(jsonb_array_length(v_snapshot -> 'pairs') > 0, 'nonempty authority');

    -- Compare the actual RPC to current published eligibility, including labels.
    SELECT jsonb_agg(jsonb_build_object('sampleTypeId', sample_type_id, 'assayDefinitionId', assay_definition_id)
                     ORDER BY sample_type_id, assay_definition_id)
    INTO v_expected_pairs FROM (
        SELECT DISTINCT compatibility.sample_type_id, compatibility.assay_definition_id
        FROM public.assay_sample_type_compatibilities AS compatibility
        JOIN public.assay_sample_type_reviews AS review
          ON review.revision_id = compatibility.revision_id
         AND review.assay_definition_id = compatibility.assay_definition_id
        JOIN public.assay_definitions AS assay ON assay.id = compatibility.assay_definition_id
        JOIN public.sample_types AS sample_type ON sample_type.id = compatibility.sample_type_id
        WHERE compatibility.revision_id = v_revision_id AND compatibility.removed_at IS NULL
          AND review.disposition = 'configured' AND assay.deleted_at IS NULL AND sample_type.deleted_at IS NULL
          AND review.assay_compatibility_generation = assay.compatibility_generation
          AND compatibility.assay_compatibility_generation = assay.compatibility_generation
          AND compatibility.sample_type_compatibility_generation = sample_type.compatibility_generation
    ) AS expected;
    PERFORM pg_temp.assert_template_snapshot(v_expected_pairs = v_snapshot -> 'pairs', 'exact eligible unique pair set');
    PERFORM pg_temp.assert_template_snapshot(NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_snapshot -> 'sampleTypes') AS entity
        LEFT JOIN public.sample_types AS source ON source.id = (entity ->> 'id')::UUID
        WHERE source.id IS NULL OR source.deleted_at IS NOT NULL
           OR entity ->> 'importCode' IS DISTINCT FROM source.import_code
           OR entity ->> 'name' IS DISTINCT FROM source.name
           OR entity ->> 'compatibilityGeneration' IS DISTINCT FROM source.compatibility_generation::TEXT
    ), 'sample type code/UUID/generation/label authority');
    PERFORM pg_temp.assert_template_snapshot(NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_snapshot -> 'assays') AS entity
        LEFT JOIN public.assay_definitions AS source ON source.id = (entity ->> 'id')::UUID
        WHERE source.id IS NULL OR source.deleted_at IS NOT NULL
           OR entity ->> 'importCode' IS DISTINCT FROM source.import_code
           OR entity ->> 'name' IS DISTINCT FROM source.name
           OR entity ->> 'methodName' IS DISTINCT FROM source.method_name
           OR entity ->> 'compatibilityGeneration' IS DISTINCT FROM source.compatibility_generation::TEXT
    ), 'assay code/UUID/generation/label/method authority');
    FOR v_actor IN SELECT * FROM (VALUES
        ('sampleTypes', 'sampleTypeId'), ('assays', 'assayDefinitionId')
    ) AS entity_groups(array_key, pair_key) LOOP
        PERFORM pg_temp.assert_template_snapshot(
            (SELECT count(*) = count(DISTINCT entity ->> 'id')
                    AND count(*) = count(DISTINCT entity ->> 'importCode')
             FROM jsonb_array_elements(v_snapshot -> v_actor.array_key) AS entity)
            AND (SELECT array_agg(entity ->> 'id' ORDER BY entity ->> 'id')
                 FROM jsonb_array_elements(v_snapshot -> v_actor.array_key) AS entity)
                = (SELECT array_agg(DISTINCT pair ->> v_actor.pair_key ORDER BY pair ->> v_actor.pair_key)
                   FROM jsonb_array_elements(v_snapshot -> 'pairs') AS pair),
            'unique entities equal referenced pair union: ' || v_actor.array_key);
    END LOOP;

    v_assay_id := (v_snapshot -> 'assays' -> 0 ->> 'id')::UUID;
    v_sample_type_id := (v_snapshot -> 'sampleTypes' -> 0 ->> 'id')::UUID;
    -- Each block forces its own rollback while retaining assertion failures.
    BEGIN
        UPDATE public.assay_definitions SET method_name = COALESCE(method_name, '') || ' snapshot drift'
        WHERE id = v_assay_id;
        EXECUTE 'SET LOCAL ROLE authenticated';
        BEGIN
            v_after := public.get_accession_template_snapshot();
            PERFORM pg_temp.assert_template_snapshot(NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(v_after -> 'pairs') AS pair
                WHERE pair ->> 'assayDefinitionId' = v_assay_id::TEXT
            ), 'method generation drift excludes stale assay');
        EXCEPTION WHEN SQLSTATE 'P0001' THEN
            IF SQLERRM <> 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE' THEN RAISE; END IF;
        END;
        EXECUTE 'RESET ROLE';
        RAISE EXCEPTION USING ERRCODE = 'ZT001';
    EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
    END;
    BEGIN
        UPDATE public.sample_types SET deleted_at = clock_timestamp() WHERE id = v_sample_type_id;
        EXECUTE 'SET LOCAL ROLE authenticated';
        BEGIN
            v_after := public.get_accession_template_snapshot();
            PERFORM pg_temp.assert_template_snapshot(NOT EXISTS (
                SELECT 1 FROM jsonb_array_elements(v_after -> 'pairs') AS pair
                WHERE pair ->> 'sampleTypeId' = v_sample_type_id::TEXT
            ), 'retired sample type excluded');
        EXCEPTION WHEN SQLSTATE 'P0001' THEN
            IF SQLERRM <> 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE' THEN RAISE; END IF;
        END;
        EXECUTE 'RESET ROLE';
        RAISE EXCEPTION USING ERRCODE = 'ZT001';
    EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
    END;
    BEGIN
        UPDATE public.assay_definitions SET method_name = COALESCE(method_name, '') || ' all snapshot drift'
        WHERE id IN (SELECT (entity ->> 'id')::UUID FROM jsonb_array_elements(v_snapshot -> 'assays') AS entity);
        EXECUTE 'SET LOCAL ROLE authenticated';
        BEGIN
            PERFORM public.get_accession_template_snapshot();
            RAISE EXCEPTION 'missing eligible pairs unexpectedly accepted';
        EXCEPTION WHEN SQLSTATE 'P0001' THEN
            IF SQLERRM <> 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE' THEN RAISE; END IF;
        END;
        EXECUTE 'RESET ROLE';
        RAISE EXCEPTION USING ERRCODE = 'ZT001';
    EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
    END;
    BEGIN
        UPDATE public.assay_sample_type_catalog_revisions
        SET status = 'superseded', superseded_by = v_manager_id,
            superseded_at = GREATEST(clock_timestamp(), published_at)
        WHERE id = v_revision_id;
        EXECUTE 'SET LOCAL ROLE authenticated';
        BEGIN
            PERFORM public.get_accession_template_snapshot();
            RAISE EXCEPTION 'missing published revision unexpectedly accepted';
        EXCEPTION WHEN SQLSTATE 'P0001' THEN
            IF SQLERRM <> 'ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE' THEN RAISE; END IF;
        END;
        EXECUTE 'RESET ROLE';
        RAISE EXCEPTION USING ERRCODE = 'ZT001';
    EXCEPTION WHEN SQLSTATE 'ZT001' THEN NULL;
    END;
    RAISE NOTICE 'PASS snapshot observed-catalog authority, authorization and reversible drift checks';
END;
$contract$;

ROLLBACK;
