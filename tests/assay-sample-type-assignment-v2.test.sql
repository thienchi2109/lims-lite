-- ASSAY SAMPLE-TYPE ASSIGNMENT V2 RUNTIME CONTRACT
-- Transactional coverage for resolver, additive RPCs, rollback, and history.
--
-- Usage from the home-server checkout:
--   sudo -n docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 \
--     -U postgres -d postgres < tests/assay-sample-type-assignment-v2.test.sql
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE compatibility_assignment_v2_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $contract$
DECLARE
    v_analyst_id UUID := '94000000-0000-0000-0000-000000000001';
    v_client_id UUID := '94000000-0000-0000-0000-000000000002';
    v_no_role_user_id UUID := '94000000-0000-0000-0000-000000000003';
    v_invalid_method_id UUID := '94000000-0000-0000-0000-000000000004';
    v_revision_id UUID;
    v_revision_number BIGINT;
    v_sample_type_id UUID;
    v_sample_type_name TEXT;
    v_sample_type_code TEXT;
    v_assay_id UUID;
    v_second_assay_id UUID;
    v_incompatible_assay_id UUID;
    v_not_assignable_assay_id UUID;
    v_create_payload JSONB;
    v_accession_payload JSONB;
    v_assign_payload JSONB;
    v_duplicate_payload JSONB;
    v_create_sample_id UUID;
    v_accession_sample_id UUID;
    v_valid_tests JSONB;
    v_invalid_tests JSONB;
    v_stale_duplicate_tests JSONB;
    v_resolved_revision BIGINT;
    v_sample_count_before BIGINT;
    v_sample_count_after BIGINT;
    v_result_count_before BIGINT;
    v_result_count_after BIGINT;
    v_audit_count_before BIGINT;
    v_audit_count_after BIGINT;
    v_create_audit_type JSONB;
    v_accession_audit_type JSONB;
    v_rollback_code TEXT;
    v_missing_catalog_rejected BOOLEAN := FALSE;
    v_stale_revision_rejected BOOLEAN := FALSE;
    v_incompatible_rejected BOOLEAN := FALSE;
    v_unreviewed_rejected BOOLEAN := FALSE;
    v_inactive_sample_type_rejected BOOLEAN := FALSE;
    v_inactive_assay_rejected BOOLEAN := FALSE;
    v_method_change_stale BOOLEAN := FALSE;
    v_assay_restore_stale BOOLEAN := FALSE;
    v_sample_type_rename_stale BOOLEAN := FALSE;
    v_sample_type_restore_stale BOOLEAN := FALSE;
    v_assay_rename_kept_generation BOOLEAN := FALSE;
    v_no_role_create_rejected BOOLEAN := FALSE;
    v_no_role_accession_rejected BOOLEAN := FALSE;
    v_no_role_assign_rejected BOOLEAN := FALSE;
    v_generation_before BIGINT;
    v_generation_after BIGINT;
BEGIN
    IF to_regprocedure(
        'public.resolve_assay_sample_type_compatibility(uuid,uuid,bigint)'
    ) IS NULL
       OR to_regprocedure(
           'public.create_sample_atomic_v2(uuid,text,timestamp with time zone,uuid,uuid,boolean,bigint)'
       ) IS NULL
       OR to_regprocedure(
           'public.accession_and_assign_tests_v2(uuid,text,timestamp with time zone,jsonb,uuid,boolean,bigint)'
       ) IS NULL
       OR to_regprocedure(
           'public.assign_tests_to_sample_v2(uuid,uuid,jsonb,bigint)'
       ) IS NULL
    THEN
        INSERT INTO compatibility_assignment_v2_results
        VALUES (
            'v2 signatures exist',
            FALSE,
            'resolver or additive assignment v2 signature is missing'
        );
        RETURN;
    END IF;

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'v2 signatures exist',
        TRUE,
        'resolver and all three additive RPC signatures exist'
    );

    SELECT revision.id, revision.revision_number
    INTO v_revision_id, v_revision_number
    FROM public.assay_sample_type_catalog_revisions AS revision
    WHERE revision.status = 'published';

    WITH eligible_sample_types AS (
        SELECT compatibility.sample_type_id
        FROM public.assay_sample_type_compatibilities AS compatibility
        JOIN public.assay_definitions AS assay_definition
          ON assay_definition.id = compatibility.assay_definition_id
         AND assay_definition.deleted_at IS NULL
        WHERE compatibility.revision_id = v_revision_id
          AND compatibility.removed_at IS NULL
        GROUP BY compatibility.sample_type_id
        HAVING COUNT(*) >= 2
    )
    SELECT
        compatibility.sample_type_id,
        sample_type.name,
        sample_type.import_code,
        compatibility.assay_definition_id
    INTO
        v_sample_type_id,
        v_sample_type_name,
        v_sample_type_code,
        v_assay_id
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN eligible_sample_types
      ON eligible_sample_types.sample_type_id = compatibility.sample_type_id
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
    ORDER BY compatibility.created_at
    LIMIT 1;

    SELECT compatibility.assay_definition_id
    INTO v_second_assay_id
    FROM public.assay_sample_type_compatibilities AS compatibility
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = compatibility.assay_definition_id
     AND assay_definition.deleted_at IS NULL
    WHERE compatibility.revision_id = v_revision_id
      AND compatibility.sample_type_id = v_sample_type_id
      AND compatibility.assay_definition_id <> v_assay_id
      AND compatibility.removed_at IS NULL
    ORDER BY compatibility.created_at
    LIMIT 1;

    SELECT review.assay_definition_id
    INTO v_incompatible_assay_id
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = review.assay_definition_id
     AND assay_definition.deleted_at IS NULL
    WHERE review.revision_id = v_revision_id
      AND review.disposition = 'configured'
      AND NOT EXISTS (
          SELECT 1
          FROM public.assay_sample_type_compatibilities AS compatibility
          WHERE compatibility.revision_id = review.revision_id
            AND compatibility.assay_definition_id = review.assay_definition_id
            AND compatibility.sample_type_id = v_sample_type_id
            AND compatibility.removed_at IS NULL
      )
    ORDER BY review.created_at
    LIMIT 1;

    SELECT review.assay_definition_id
    INTO v_not_assignable_assay_id
    FROM public.assay_sample_type_reviews AS review
    JOIN public.assay_definitions AS assay_definition
      ON assay_definition.id = review.assay_definition_id
     AND assay_definition.deleted_at IS NULL
    WHERE review.revision_id = v_revision_id
      AND review.disposition = 'not_assignable'
    ORDER BY review.created_at
    LIMIT 1;

    IF v_revision_number IS NULL
       OR v_sample_type_id IS NULL
       OR v_assay_id IS NULL
       OR v_second_assay_id IS NULL
       OR v_incompatible_assay_id IS NULL
       OR v_not_assignable_assay_id IS NULL
    THEN
        RAISE EXCEPTION
            'Phase 5 runtime test requires one valid pair, one incompatible configured pair, and one not-assignable assay';
    END IF;

    EXECUTE
        'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
    INTO v_resolved_revision
    USING v_sample_type_id, v_assay_id, v_revision_number;

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'resolver accepts current published pair',
        v_resolved_revision = v_revision_number,
        format('resolved=%s expected=%s', v_resolved_revision, v_revision_number)
    );

    BEGIN
        UPDATE public.assay_sample_type_catalog_revisions
        SET status = 'superseded',
            superseded_by = published_by,
            superseded_at = NOW()
        WHERE id = v_revision_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, NULL::BIGINT;
    EXCEPTION
        WHEN SQLSTATE 'P1100' THEN
            v_missing_catalog_rejected := TRUE;
    END;

    BEGIN
        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number + 1;
    EXCEPTION
        WHEN SQLSTATE 'P1101' THEN
            v_stale_revision_rejected := TRUE;
    END;

    BEGIN
        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_incompatible_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1105' THEN
            v_incompatible_rejected := TRUE;
    END;

    BEGIN
        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_not_assignable_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1104' THEN
            v_unreviewed_rejected := TRUE;
    END;

    BEGIN
        UPDATE public.sample_types
        SET deleted_at = NOW()
        WHERE id = v_sample_type_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1102' THEN
            v_inactive_sample_type_rejected := TRUE;
    END;

    BEGIN
        UPDATE public.assay_definitions
        SET deleted_at = NOW()
        WHERE id = v_assay_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1103' THEN
            v_inactive_assay_rejected := TRUE;
    END;

    BEGIN
        UPDATE public.assay_definitions
        SET method_name = COALESCE(method_name, '') || ' Phase 5'
        WHERE id = v_assay_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1106' THEN
            v_method_change_stale := TRUE;
    END;

    BEGIN
        UPDATE public.assay_definitions
        SET deleted_at = NOW()
        WHERE id = v_assay_id;
        UPDATE public.assay_definitions
        SET deleted_at = NULL
        WHERE id = v_assay_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1106' THEN
            v_assay_restore_stale := TRUE;
    END;

    BEGIN
        UPDATE public.sample_types
        SET name = name || ' Phase 5'
        WHERE id = v_sample_type_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1106' THEN
            v_sample_type_rename_stale := TRUE;
    END;

    BEGIN
        UPDATE public.sample_types
        SET deleted_at = NOW()
        WHERE id = v_sample_type_id;
        UPDATE public.sample_types
        SET deleted_at = NULL
        WHERE id = v_sample_type_id;

        EXECUTE
            'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
        USING v_sample_type_id, v_assay_id, v_revision_number;
    EXCEPTION
        WHEN SQLSTATE 'P1106' THEN
            v_sample_type_restore_stale := TRUE;
    END;

    SELECT compatibility_generation
    INTO v_generation_before
    FROM public.assay_definitions
    WHERE id = v_assay_id;

    UPDATE public.assay_definitions
    SET name = name || ' Phase 5'
    WHERE id = v_assay_id;

    SELECT compatibility_generation
    INTO v_generation_after
    FROM public.assay_definitions
    WHERE id = v_assay_id;

    EXECUTE
        'SELECT public.resolve_assay_sample_type_compatibility($1, $2, $3)'
    INTO v_resolved_revision
    USING v_sample_type_id, v_assay_id, v_revision_number;

    v_assay_rename_kept_generation :=
        v_generation_after = v_generation_before
        AND v_resolved_revision = v_revision_number;

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'resolver rejects stale and inactive states with stable SQLSTATE',
        v_missing_catalog_rejected
            AND v_stale_revision_rejected
            AND v_incompatible_rejected
            AND v_unreviewed_rejected
            AND v_inactive_sample_type_rejected
            AND v_inactive_assay_rejected
            AND v_method_change_stale
            AND v_assay_restore_stale
            AND v_sample_type_rename_stale
            AND v_sample_type_restore_stale
            AND v_assay_rename_kept_generation,
        'covers expected revision, pair, review, active state, method/name/retire/restore generations'
    );

    INSERT INTO auth.users (id, email)
    VALUES
        (v_analyst_id, 'compatibility-phase5-analyst@lims.local'),
        (v_no_role_user_id, 'compatibility-phase5-no-role@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email, can_access_confidential, deleted_at
    )
    VALUES (
        v_analyst_id,
        'compatibility_phase5_analyst',
        'Compatibility Phase 5 Analyst',
        'analyst',
        'compatibility-phase5-analyst@lims.local',
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
        '079203009401',
        'Compatibility Phase 5 Contract Client',
        DATE '1990-01-01',
        'Nam',
        '0900000401',
        'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    v_valid_tests := jsonb_build_array(jsonb_build_object(
        'assayId', v_assay_id,
        'methodId', NULL
    ));
    v_invalid_tests := v_valid_tests || jsonb_build_array(jsonb_build_object(
        'assayId', v_assay_id,
        'methodId', v_invalid_method_id
    ));
    v_stale_duplicate_tests := jsonb_build_array(
        jsonb_build_object(
            'assayId', v_assay_id,
            'methodId', NULL
        ),
        jsonb_build_object(
            'assayId', v_second_assay_id,
            'methodId', NULL
        )
    ));

    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        true
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    EXECUTE
        'SELECT public.create_sample_atomic_v2($1, $2, $3, $4, $5, $6, $7)'
    INTO v_create_payload
    USING
        v_client_id,
        'Compatibility Phase 5 Create Client',
        NOW(),
        v_analyst_id,
        v_sample_type_id,
        FALSE,
        v_revision_number;

    EXECUTE
        'SELECT public.accession_and_assign_tests_v2($1, $2, $3, $4, $5, $6, $7)'
    INTO v_accession_payload
    USING
        v_client_id,
        'Compatibility Phase 5 Assigned Client',
        NOW(),
        v_valid_tests,
        v_sample_type_id,
        TRUE,
        v_revision_number;

    EXECUTE 'RESET ROLE';

    v_create_sample_id := (v_create_payload->>'id')::UUID;
    v_accession_sample_id := (v_accession_payload->'sample'->>'id')::UUID;

    SELECT new_values->'sample_type_id'
    INTO v_create_audit_type
    FROM public.audit_logs
    WHERE table_name = 'samples'
      AND record_id = v_create_sample_id
      AND operation = 'INSERT'
    ORDER BY changed_at DESC
    LIMIT 1;

    SELECT new_values->'sample_type_id'
    INTO v_accession_audit_type
    FROM public.audit_logs
    WHERE table_name = 'samples'
      AND record_id = v_accession_sample_id
      AND operation = 'INSERT'
    ORDER BY changed_at DESC
    LIMIT 1;

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'v2 create and accession preserve sample and audit behavior',
        (v_create_payload->>'compatibility_revision_number')::BIGINT
                = v_revision_number
            AND (v_accession_payload->>'compatibility_revision_number')::BIGINT
                = v_revision_number
            AND v_create_payload->>'type' = v_sample_type_name
            AND v_create_payload->>'sample_type_code' = v_sample_type_code
            AND v_accession_payload->'sample'->>'type' = v_sample_type_name
            AND v_accession_payload->'sample'->>'sample_type_code'
                = v_sample_type_code
            AND v_create_payload->>'sample_quality' = 'false'
            AND v_accession_payload->'sample'->>'sample_quality' = 'true'
            AND v_create_audit_type = to_jsonb(v_sample_type_id::TEXT)
            AND v_accession_audit_type = to_jsonb(v_sample_type_id::TEXT),
        'canonical type, quality, revision response, and sample audit are preserved'
    );

    PERFORM set_config(
        'request.jwt.claims',
        format(
            '{"sub":"%s","role":"authenticated"}',
            v_no_role_user_id
        ),
        true
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_no_role_user_id::TEXT,
        true
    );
    EXECUTE 'SET LOCAL ROLE authenticated';

    BEGIN
        EXECUTE
            'SELECT public.create_sample_atomic_v2($1, $2, $3, $4, $5, $6, $7)'
        USING
            v_client_id,
            'Compatibility Phase 5 No Role Create',
            NOW(),
            v_no_role_user_id,
            v_sample_type_id,
            TRUE,
            v_revision_number;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_no_role_create_rejected := TRUE;
    END;

    BEGIN
        EXECUTE
            'SELECT public.accession_and_assign_tests_v2($1, $2, $3, $4, $5, $6, $7)'
        USING
            v_client_id,
            'Compatibility Phase 5 No Role Accession',
            NOW(),
            v_valid_tests,
            v_sample_type_id,
            TRUE,
            v_revision_number;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_no_role_accession_rejected := TRUE;
    END;

    BEGIN
        EXECUTE
            'SELECT public.assign_tests_to_sample_v2($1, $2, $3, $4)'
        USING
            v_create_sample_id,
            v_sample_type_id,
            v_valid_tests,
            v_revision_number;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_no_role_assign_rejected := TRUE;
    END;
    EXECUTE 'RESET ROLE';

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'authenticated user without application role is rejected',
        v_no_role_create_rejected
            AND v_no_role_accession_rejected
            AND v_no_role_assign_rejected,
        'all authenticated-callable v2 RPCs must fail closed on NULL application role'
    );

    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        true
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, true);

    SELECT COUNT(*) INTO v_sample_count_before
    FROM public.samples
    WHERE client_id = v_client_id;
    SELECT COUNT(*) INTO v_result_count_before
    FROM public.results
    WHERE sample_id IN (
        SELECT id FROM public.samples WHERE client_id = v_client_id
    );
    SELECT COUNT(*) INTO v_audit_count_before
    FROM public.audit_logs
    WHERE (
        table_name = 'samples'
        AND record_id IN (
            SELECT id FROM public.samples WHERE client_id = v_client_id
        )
    ) OR (
        table_name = 'results'
        AND record_id IN (
            SELECT result.id
            FROM public.results AS result
            JOIN public.samples AS sample
              ON sample.id = result.sample_id
            WHERE sample.client_id = v_client_id
        )
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        EXECUTE
            'SELECT public.accession_and_assign_tests_v2($1, $2, $3, $4, $5, $6, $7)'
        USING
            v_client_id,
            'Compatibility Phase 5 Rollback Client',
            NOW(),
            v_invalid_tests,
            v_sample_type_id,
            TRUE,
            v_revision_number;
    EXCEPTION
        WHEN OTHERS THEN
            v_rollback_code := SQLSTATE;
    END;
    EXECUTE 'RESET ROLE';

    SELECT COUNT(*) INTO v_sample_count_after
    FROM public.samples
    WHERE client_id = v_client_id;
    SELECT COUNT(*) INTO v_result_count_after
    FROM public.results
    WHERE sample_id IN (
        SELECT id FROM public.samples WHERE client_id = v_client_id
    );
    SELECT COUNT(*) INTO v_audit_count_after
    FROM public.audit_logs
    WHERE (
        table_name = 'samples'
        AND record_id IN (
            SELECT id FROM public.samples WHERE client_id = v_client_id
        )
    ) OR (
        table_name = 'results'
        AND record_id IN (
            SELECT result.id
            FROM public.results AS result
            JOIN public.samples AS sample
              ON sample.id = result.sample_id
            WHERE sample.client_id = v_client_id
        )
    );

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'invalid batch rolls back sample result and audit',
        v_rollback_code = '23503'
            AND v_sample_count_after = v_sample_count_before
            AND v_result_count_after = v_result_count_before
            AND v_audit_count_after = v_audit_count_before,
        format(
            'sqlstate=%s samples=%s/%s results=%s/%s sample/result audits=%s/%s',
            coalesce(v_rollback_code, '<none>'),
            v_sample_count_before,
            v_sample_count_after,
            v_result_count_before,
            v_result_count_after,
            v_audit_count_before,
            v_audit_count_after
        )
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE
        'SELECT public.assign_tests_to_sample_v2($1, $2, $3, $4)'
    INTO v_assign_payload
    USING
        v_create_sample_id,
        v_sample_type_id,
        v_valid_tests,
        v_revision_number;
    EXECUTE
        'SELECT public.assign_tests_to_sample_v2($1, $2, $3, $4)'
    INTO v_duplicate_payload
    USING
        v_create_sample_id,
        v_sample_type_id,
        v_valid_tests,
        v_revision_number;
    EXECUTE 'RESET ROLE';

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'assign v2 preserves duplicate and sample status behavior',
        (v_assign_payload->>'inserted_count')::INTEGER = 1
            AND (v_duplicate_payload->>'inserted_count')::INTEGER = 0
            AND v_assign_payload->>'new_status' = 'assigned'
            AND (v_assign_payload->>'compatibility_revision_number')::BIGINT
                = v_revision_number,
        format('first=%s duplicate=%s', v_assign_payload, v_duplicate_payload)
    );

    SELECT COUNT(*) INTO v_result_count_before
    FROM public.results
    WHERE sample_id = v_create_sample_id;

    UPDATE public.assay_definitions
    SET method_name = COALESCE(method_name, '') || ' Phase 5 History'
    WHERE id = v_assay_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE
        'SELECT public.assign_tests_to_sample_v2($1, $2, $3, $4)'
    INTO v_assign_payload
    USING
        v_create_sample_id,
        v_sample_type_id,
        v_stale_duplicate_tests,
        v_revision_number;
    EXECUTE 'RESET ROLE';

    SELECT COUNT(*) INTO v_result_count_after
    FROM public.results
    WHERE sample_id = v_create_sample_id;

    INSERT INTO compatibility_assignment_v2_results
    VALUES (
        'historical result remains unchanged',
        v_result_count_before = 1
            AND v_result_count_after = 2
            AND (v_assign_payload->>'inserted_count')::INTEGER = 1
            AND EXISTS (
                SELECT 1
                FROM public.results
                WHERE sample_id = v_create_sample_id
                  AND assay_id = v_assay_id
            ),
        format(
            'before=%s after=%s inserted=%s',
            v_result_count_before,
            v_result_count_after,
            v_assign_payload->>'inserted_count'
        )
    );
END;
$contract$;

TABLE compatibility_assignment_v2_results;

DO $assertions$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(test_name || ': ' || detail, E'\n' ORDER BY test_name)
    INTO v_failed
    FROM compatibility_assignment_v2_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION E'Assay sample-type assignment v2 tests failed:\n%',
            v_failed;
    END IF;
END;
$assertions$;

ROLLBACK;
