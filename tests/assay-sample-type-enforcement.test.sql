-- ASSAY SAMPLE-TYPE ENFORCEMENT RUNTIME CONTRACT
-- Rollback-only coverage for direct inserts, history, sample-type locking, and
-- audit evidence after migration 213 is applied in the authoritative runtime.
--
-- Usage from the home-server checkout:
--   sudo -n docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 \
--     -U postgres -d postgres < tests/assay-sample-type-enforcement.test.sql
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE assay_sample_type_enforcement_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $contract$
DECLARE
    v_analyst_id UUID := '95000000-0000-0000-0000-000000000001';
    v_client_id UUID := '95000000-0000-0000-0000-000000000002';
    v_revision_id UUID;
    v_revision_number BIGINT;
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
    v_renamed_sample_type_name TEXT;
    v_assay_id UUID;
    v_temporary_sample_type_id UUID;
    v_temporary_sample_type_name TEXT := 'Phase 8 Temporary Sample Type';
    v_first_sample_id UUID;
    v_second_sample_id UUID;
    v_first_payload JSONB;
    v_second_payload JSONB;
    v_audit_found BOOLEAN := FALSE;
    v_post_result_change_rejected BOOLEAN := FALSE;
    v_removed_pair_insert_rejected BOOLEAN := FALSE;
    v_historical_result_id UUID;
    v_security_runner_count BIGINT;
    v_security_runner_passed BOOLEAN;
    v_security_runner_message TEXT;
BEGIN
    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
       ) IS NOT NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample(uuid,jsonb)'
       ) IS NOT NULL
    THEN
        INSERT INTO assay_sample_type_enforcement_results
        VALUES (
            'legacy assignment contracts are retired',
            FALSE,
            'one or more legacy assignment signatures still exist'
        );
        RETURN;
    END IF;

    INSERT INTO assay_sample_type_enforcement_results
    VALUES (
        'legacy assignment contracts are retired',
        TRUE,
        'all three legacy assignment signatures are absent'
    );

    SELECT revision.id, revision.revision_number
    INTO v_revision_id, v_revision_number
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'published';

    SELECT
        compatibility.sample_type_id,
        sample_type.name,
        compatibility.assay_definition_id
    INTO
        v_sample_type_id,
        v_sample_type_name,
        v_assay_id
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.sample_types AS sample_type
      ON sample_type.id = compatibility.sample_type_id
     AND sample_type.deleted_at IS NULL
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = compatibility.assay_definition_id
     AND assay_definition.deleted_at IS NULL
    JOIN public.assay_sample_type_reviews AS review
      ON review.revision_id = compatibility.revision_id
     AND review.assay_definition_id = compatibility.assay_definition_id
     AND review.disposition = 'configured'
    WHERE compatibility.revision_id = v_revision_id
      AND compatibility.removed_at IS NULL
      AND compatibility.assay_compatibility_generation
          = assay_definition.compatibility_generation
      AND compatibility.sample_type_compatibility_generation
          = sample_type.compatibility_generation
    ORDER BY compatibility.created_at
    LIMIT 1;

    IF v_revision_id IS NULL
       OR v_revision_number IS NULL
       OR v_sample_type_id IS NULL
       OR v_assay_id IS NULL
    THEN
        RAISE EXCEPTION
            'Phase 8 runtime test requires one complete published compatibility pair';
    END IF;

    INSERT INTO public.sample_types (name, normalized_name)
    VALUES (v_temporary_sample_type_name, '__phase_8_temporary__')
    RETURNING id
    INTO v_temporary_sample_type_id;

    INSERT INTO auth.users (id, email)
    VALUES (v_analyst_id, 'compatibility-phase8-analyst@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email, can_access_confidential, deleted_at
    )
    VALUES (
        v_analyst_id,
        'compatibility_phase8_analyst',
        'Compatibility Phase 8 Analyst',
        'analyst',
        'compatibility-phase8-analyst@lims.local',
        FALSE,
        NULL
    )
    ON CONFLICT (id) DO UPDATE
    SET role = EXCLUDED.role,
        deleted_at = NULL;

    INSERT INTO public.clients (
        id, id_card_num, name, date_of_birth, gender, phone, address
    )
    VALUES (
        v_client_id,
        '079203009501',
        'Compatibility Phase 8 Contract Client',
        DATE '1990-01-01',
        'Nam',
        '0900000501',
        'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        true
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    EXECUTE
        'SELECT public.create_sample_atomic_v2($1, $2, $3, $4, $5, $6, $7)'
    INTO v_first_payload
    USING
        v_client_id,
        'Compatibility Phase 8 First Sample',
        NOW(),
        v_analyst_id,
        v_temporary_sample_type_id,
        TRUE,
        v_revision_number;

    EXECUTE
        'SELECT public.create_sample_atomic_v2($1, $2, $3, $4, $5, $6, $7)'
    INTO v_second_payload
    USING
        v_client_id,
        'Compatibility Phase 8 Second Sample',
        NOW(),
        v_analyst_id,
        v_temporary_sample_type_id,
        TRUE,
        v_revision_number;

    v_first_sample_id := (v_first_payload->>'id')::UUID;
    v_second_sample_id := (v_second_payload->>'id')::UUID;

    UPDATE public.samples
    SET sample_type_id = v_sample_type_id,
        type = v_sample_type_name
    WHERE id IN (v_first_sample_id, v_second_sample_id);

    EXECUTE 'RESET ROLE';

    SELECT EXISTS (
        SELECT 1
        FROM public.audit_logs
        WHERE table_name = 'samples'
          AND record_id = v_first_sample_id
          AND operation = 'UPDATE'
          AND old_values->>'sample_type_id'
              = v_temporary_sample_type_id::TEXT
          AND new_values->>'sample_type_id' = v_sample_type_id::TEXT
          AND changed_by = v_analyst_id
    )
    INTO v_audit_found;

    INSERT INTO assay_sample_type_enforcement_results
    VALUES (
        'sample type change before first result is audited',
        v_audit_found,
        'audit must capture actor plus old and new canonical sample-type ids'
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    INSERT INTO public.results (sample_id, assay_id, method_id, status)
    VALUES (v_first_sample_id, v_assay_id, NULL, 'pending')
    RETURNING id
    INTO v_historical_result_id;
    EXECUTE 'RESET ROLE';

    INSERT INTO assay_sample_type_enforcement_results
    VALUES (
        'direct result insert accepts a current compatible pair',
        v_historical_result_id IS NOT NULL,
        format('result_id=%s', v_historical_result_id)
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        UPDATE public.samples
        SET sample_type_id = v_temporary_sample_type_id,
            type = v_temporary_sample_type_name
        WHERE id = v_first_sample_id;
    EXCEPTION
        WHEN SQLSTATE 'P1107' THEN
            v_post_result_change_rejected := TRUE;
    END;
    EXECUTE 'RESET ROLE';

    INSERT INTO assay_sample_type_enforcement_results
    VALUES (
        'sample type is immutable after the first result',
        v_post_result_change_rejected,
        'post-result sample-type changes must fail with P1107'
    );

    ALTER TABLE public.assay_sample_type_compatibilities
        DISABLE TRIGGER guard_assay_sample_type_compatibilities;
    UPDATE public.assay_sample_type_compatibilities
    SET removed_by = v_analyst_id,
        removed_at = NOW(),
        removal_reason = 'Phase 8 rollback-only pair removal drill'
    WHERE revision_id = v_revision_id
      AND assay_definition_id = v_assay_id
      AND sample_type_id = v_sample_type_id;
    ALTER TABLE public.assay_sample_type_compatibilities
        ENABLE TRIGGER guard_assay_sample_type_compatibilities;

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        INSERT INTO public.results (sample_id, assay_id, method_id, status)
        VALUES (v_second_sample_id, v_assay_id, NULL, 'pending');
    EXCEPTION
        WHEN SQLSTATE 'P1105' THEN
            v_removed_pair_insert_rejected := TRUE;
    END;
    EXECUTE 'RESET ROLE';

    INSERT INTO assay_sample_type_enforcement_results
    VALUES (
        'historical result remains unchanged and new result is rejected after pair removal',
        v_removed_pair_insert_rejected
            AND EXISTS (
                SELECT 1
                FROM public.results
                WHERE id = v_historical_result_id
                  AND sample_id = v_first_sample_id
                  AND assay_id = v_assay_id
            )
            AND NOT EXISTS (
                SELECT 1
                FROM public.results
                WHERE sample_id = v_second_sample_id
                  AND assay_id = v_assay_id
            ),
        'existing rows remain; only the new incompatible INSERT fails'
    );

    v_renamed_sample_type_name :=
        'Phase 8 Rename ' || left(v_sample_type_id::TEXT, 8);

    UPDATE public.sample_types
    SET name = v_renamed_sample_type_name
    WHERE id = v_sample_type_id;

    INSERT INTO assay_sample_type_enforcement_results
    SELECT
        'master rename preserves historical sample projection',
        result_sample.type = v_sample_type_name
            AND result_free_sample.type = v_renamed_sample_type_name,
        'result-bearing sample keeps historical type projection; '
            || 'result-free sample follows master rename'
    FROM public.samples AS result_sample
    JOIN public.samples AS result_free_sample
      ON result_free_sample.id = v_second_sample_id
    WHERE result_sample.id = v_first_sample_id;

    SELECT count(*), bool_and(passed), max(message)
    INTO
        v_security_runner_count,
        v_security_runner_passed,
        v_security_runner_message
    FROM public.run_security_tests()
    WHERE test_name = 'Assay Sample-Type Enforcement';

    INSERT INTO assay_sample_type_enforcement_results
    VALUES (
        'security runner includes compatibility enforcement',
        v_security_runner_count = 1
            AND COALESCE(v_security_runner_passed, FALSE),
        COALESCE(
            v_security_runner_message,
            'security runner row is missing or duplicated'
        )
    );
END;
$contract$;

TABLE assay_sample_type_enforcement_results;

DO $assertions$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(test_name || ': ' || detail, E'\n' ORDER BY test_name)
    INTO v_failed
    FROM assay_sample_type_enforcement_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION E'Assay sample-type enforcement tests failed:\n%',
            v_failed;
    END IF;
END;
$assertions$;

ROLLBACK;
