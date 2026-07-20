-- SAMPLE QUALITY ACCESSION RUNTIME CONTRACT
-- RED until both quality-aware RPC paths persist and audit sample quality.
--
-- Usage from the home-server checkout:
--   sudo -n docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 \
--     -U postgres -d postgres < tests/sample-quality-accession.test.sql
\set ON_ERROR_STOP on
SET client_encoding = 'UTF8';
SET search_path TO public, extensions;

BEGIN;

CREATE TEMP TABLE sample_quality_runtime_results (
    test_name TEXT PRIMARY KEY,
    passed BOOLEAN NOT NULL,
    detail TEXT NOT NULL
) ON COMMIT DROP;

DO $$
DECLARE
    v_analyst_id UUID := '93000000-0000-0000-0000-000000000001';
    v_manager_id UUID := '93000000-0000-0000-0000-000000000002';
    v_client_id UUID := '93000000-0000-0000-0000-000000000003';
    v_assay_id UUID;
    v_create_payload JSONB;
    v_assigned_payload JSONB;
    v_create_sample_id UUID;
    v_assigned_sample_id UUID;
    v_create_quality BOOLEAN;
    v_assigned_quality BOOLEAN;
    v_create_audit_quality JSONB;
    v_assigned_audit_quality JSONB;
    v_create_null_rejected BOOLEAN := FALSE;
    v_assign_null_rejected BOOLEAN := FALSE;
    v_create_manager_rejected BOOLEAN := FALSE;
    v_assign_manager_rejected BOOLEAN := FALSE;
    v_tests JSONB;
BEGIN
    IF to_regprocedure(
        'public.create_sample_atomic(uuid,text,timestamp with time zone,uuid,text,boolean)'
    ) IS NULL OR to_regprocedure(
        'public.accession_and_assign_tests(uuid,text,timestamp with time zone,jsonb,text,boolean)'
    ) IS NULL THEN
        INSERT INTO sample_quality_runtime_results
        VALUES
            (
                'both accession paths persist and audit quality',
                FALSE,
                'quality-aware RPC signatures are missing'
            ),
            (
                'missing quality is rejected',
                FALSE,
                'quality-aware RPC signatures are missing'
            ),
            (
                'non-analyst remains rejected',
                FALSE,
                'quality-aware RPC signatures are missing'
            );
        RETURN;
    END IF;

    INSERT INTO auth.users (id, email)
    VALUES
        (v_analyst_id, 'sample-quality-analyst@lims.local'),
        (v_manager_id, 'sample-quality-manager@lims.local')
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.users (
        id, username, full_name, role, email, can_access_confidential, deleted_at
    )
    VALUES
        (
            v_analyst_id,
            'sample_quality_analyst',
            'Sample Quality Analyst',
            'analyst',
            'sample-quality-analyst@lims.local',
            FALSE,
            NULL
        ),
        (
            v_manager_id,
            'sample_quality_manager',
            'Sample Quality Manager',
            'manager',
            'sample-quality-manager@lims.local',
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
        '079203009301',
        'Sample Quality Contract Client',
        DATE '1990-01-01',
        'Nam',
        '0900000301',
        'CDC'
    )
    ON CONFLICT (id) DO NOTHING;

    SELECT id
    INTO v_assay_id
    FROM public.assay_definitions
    WHERE deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_assay_id IS NULL THEN
        RAISE EXCEPTION 'Sample quality contract requires one active assay definition';
    END IF;

    v_tests := jsonb_build_array(jsonb_build_object(
        'assayId', v_assay_id,
        'methodId', NULL
    ));

    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_analyst_id),
        true
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    EXECUTE 'SELECT public.create_sample_atomic($1, $2, $3, $4, $5, $6)'
    INTO v_create_payload
    USING
        v_client_id,
        'Sample Quality Contract Client',
        NOW(),
        v_analyst_id,
        'Máu',
        FALSE;

    EXECUTE 'SELECT public.accession_and_assign_tests($1, $2, $3, $4, $5, $6)'
    INTO v_assigned_payload
    USING
        v_client_id,
        'Sample Quality Assigned Contract Client',
        NOW(),
        v_tests,
        'Máu',
        TRUE;

    EXECUTE 'RESET ROLE';
    v_create_sample_id := (v_create_payload->>'id')::UUID;
    v_assigned_sample_id := (v_assigned_payload->'sample'->>'id')::UUID;

    EXECUTE 'SELECT sample_quality FROM public.samples WHERE id = $1'
    INTO v_create_quality
    USING v_create_sample_id;
    EXECUTE 'SELECT sample_quality FROM public.samples WHERE id = $1'
    INTO v_assigned_quality
    USING v_assigned_sample_id;

    SELECT new_values->'sample_quality'
    INTO v_create_audit_quality
    FROM public.audit_logs
    WHERE table_name = 'samples'
      AND record_id = v_create_sample_id
      AND operation = 'INSERT'
    ORDER BY created_at DESC
    LIMIT 1;

    SELECT new_values->'sample_quality'
    INTO v_assigned_audit_quality
    FROM public.audit_logs
    WHERE table_name = 'samples'
      AND record_id = v_assigned_sample_id
      AND operation = 'INSERT'
    ORDER BY created_at DESC
    LIMIT 1;

    INSERT INTO sample_quality_runtime_results
    VALUES (
        'both accession paths persist and audit quality',
        v_create_quality IS FALSE
            AND v_assigned_quality IS TRUE
            AND v_create_audit_quality = 'false'::JSONB
            AND v_assigned_audit_quality = 'true'::JSONB,
        format(
            'create=%s/%s assigned=%s/%s',
            coalesce(v_create_quality::TEXT, '<null>'),
            coalesce(v_create_audit_quality::TEXT, '<null>'),
            coalesce(v_assigned_quality::TEXT, '<null>'),
            coalesce(v_assigned_audit_quality::TEXT, '<null>')
        )
    );

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        EXECUTE 'SELECT public.create_sample_atomic($1, $2, $3, $4, $5, $6)'
        USING v_client_id, 'Missing Quality Client', NOW(), v_analyst_id, 'Máu', NULL::BOOLEAN;
    EXCEPTION
        WHEN OTHERS THEN
            v_create_null_rejected := SQLERRM ILIKE '%sample_quality%'
                OR SQLERRM ILIKE '%sample quality%';
    END;

    BEGIN
        EXECUTE 'SELECT public.accession_and_assign_tests($1, $2, $3, $4, $5, $6)'
        USING v_client_id, 'Missing Quality Assigned Client', NOW(), v_tests, 'Máu', NULL::BOOLEAN;
    EXCEPTION
        WHEN OTHERS THEN
            v_assign_null_rejected := SQLERRM ILIKE '%sample_quality%'
                OR SQLERRM ILIKE '%sample quality%';
    END;
    EXECUTE 'RESET ROLE';

    INSERT INTO sample_quality_runtime_results
    VALUES (
        'missing quality is rejected',
        v_create_null_rejected AND v_assign_null_rejected,
        'both quality-aware accession RPCs must reject NULL sample quality'
    );

    PERFORM set_config(
        'request.jwt.claims',
        format('{"sub":"%s","role":"authenticated"}', v_manager_id),
        true
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, true);
    EXECUTE 'SET LOCAL ROLE authenticated';

    BEGIN
        EXECUTE 'SELECT public.create_sample_atomic($1, $2, $3, $4, $5, $6)'
        USING v_client_id, 'Manager Client', NOW(), v_manager_id, 'Máu', TRUE;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_create_manager_rejected := TRUE;
    END;

    BEGIN
        EXECUTE 'SELECT public.accession_and_assign_tests($1, $2, $3, $4, $5, $6)'
        USING v_client_id, 'Manager Assigned Client', NOW(), v_tests, 'Máu', FALSE;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_assign_manager_rejected := TRUE;
    END;
    EXECUTE 'RESET ROLE';

    INSERT INTO sample_quality_runtime_results
    VALUES (
        'non-analyst remains rejected',
        v_create_manager_rejected AND v_assign_manager_rejected,
        'manager must not execute either analyst accession workflow'
    );
END $$;

TABLE sample_quality_runtime_results;

DO $$
DECLARE
    v_failed TEXT;
BEGIN
    SELECT string_agg(format('%s: %s', test_name, detail), E'\n' ORDER BY test_name)
    INTO v_failed
    FROM sample_quality_runtime_results
    WHERE NOT passed;

    IF v_failed IS NOT NULL THEN
        RAISE EXCEPTION 'Sample quality runtime contract tests failed:%', E'\n' || v_failed;
    END IF;
END $$;

ROLLBACK;
