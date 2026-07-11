-- HISTORIC COA REGENERATION POLICY REGRESSION
-- Verifies source-less ready and failed reports remain immutable when a manager
-- requests regeneration.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/coa-historic-regeneration-policy.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_sample_id UUID;
    v_manager_id UUID;
    v_ready_report_id UUID;
    v_failed_report_id UUID;
    v_ready_version INTEGER;
    v_failed_version INTEGER;
    v_ready_response JSONB;
    v_failed_response JSONB;
BEGIN
    SELECT sample.id
    INTO v_sample_id
    FROM public.samples AS sample
    WHERE sample.deleted_at IS NULL
      AND sample.status = 'completed'
      AND NOT EXISTS (
          SELECT 1
          FROM public.results AS result
          JOIN public.assay_definitions AS assay
            ON assay.id = result.assay_id
          WHERE result.sample_id = sample.id
            AND assay.is_confidential = TRUE
      )
    ORDER BY sample.created_at
    LIMIT 1;

    SELECT id
    INTO v_manager_id
    FROM public.users
    WHERE role = 'manager'
      AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_sample_id IS NULL OR v_manager_id IS NULL THEN
        RAISE EXCEPTION
            'Historic CoA policy test requires a completed non-confidential sample and active manager';
    END IF;

    SELECT COALESCE(MAX(version), 0) + 1000000
    INTO v_ready_version
    FROM public.coa_reports
    WHERE sample_id = v_sample_id;

    v_failed_version := v_ready_version + 1;

    EXECUTE
        'ALTER TABLE public.coa_reports DISABLE TRIGGER prevent_coa_report_identity_change';

    INSERT INTO public.coa_reports (
        sample_id,
        file_path,
        file_hash,
        version,
        status,
        error_message,
        source_submission_id
    )
    VALUES (
        v_sample_id,
        'historic-policy/ready.html',
        encode(digest('historic-ready', 'sha256'), 'hex'),
        v_ready_version,
        'ready',
        NULL,
        NULL
    )
    RETURNING id INTO v_ready_report_id;

    INSERT INTO public.coa_reports (
        sample_id,
        file_path,
        file_hash,
        version,
        status,
        error_message,
        source_submission_id
    )
    VALUES (
        v_sample_id,
        'historic-policy/failed.html',
        encode(digest('historic-failed', 'sha256'), 'hex'),
        v_failed_version,
        'failed',
        'Historic generation failed',
        NULL
    )
    RETURNING id INTO v_failed_report_id;

    EXECUTE
        'ALTER TABLE public.coa_reports ENABLE TRIGGER prevent_coa_report_identity_change';

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object(
            'sub', v_manager_id,
            'role', 'authenticated'
        )::TEXT,
        TRUE
    );
    PERFORM set_config(
        'request.jwt.claim.sub',
        v_manager_id::TEXT,
        TRUE
    );

    EXECUTE 'SET LOCAL ROLE authenticated';

    v_ready_response := public.claim_coa_report_regeneration(
        v_sample_id,
        v_ready_version
    );
    v_failed_response := public.claim_coa_report_regeneration(
        v_sample_id,
        v_failed_version
    );

    EXECUTE 'RESET ROLE';

    IF v_ready_response ->> 'blocked_reason' <>
       'HISTORIC_REPORT_WITHOUT_SOURCE'
       OR (v_ready_response ->> 'claimed')::BOOLEAN IS DISTINCT FROM FALSE
       OR v_ready_response ->> 'generation_claim_id' IS NOT NULL THEN
        RAISE EXCEPTION
            'Historic ready report regeneration must return a provenance block without a claim';
    END IF;

    IF v_failed_response ->> 'blocked_reason' <>
       'HISTORIC_REPORT_WITHOUT_SOURCE'
       OR (v_failed_response ->> 'claimed')::BOOLEAN IS DISTINCT FROM FALSE
       OR v_failed_response ->> 'generation_claim_id' IS NOT NULL THEN
        RAISE EXCEPTION
            'Historic failed report regeneration must return a provenance block without a claim';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_ready_report_id
          AND status = 'ready'
          AND file_path = 'historic-policy/ready.html'
          AND file_hash = encode(digest('historic-ready', 'sha256'), 'hex')
          AND source_submission_id IS NULL
          AND generation_claim_id IS NULL
          AND generation_claimed_by IS NULL
          AND generation_claimed_at IS NULL
          AND generation_previous_status IS NULL
    ) THEN
        RAISE EXCEPTION
            'Historic ready artifact metadata must remain unchanged';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_failed_report_id
          AND status = 'failed'
          AND file_path = 'historic-policy/failed.html'
          AND file_hash = encode(digest('historic-failed', 'sha256'), 'hex')
          AND error_message = 'Historic generation failed'
          AND source_submission_id IS NULL
          AND generation_claim_id IS NULL
          AND generation_claimed_by IS NULL
          AND generation_claimed_at IS NULL
          AND generation_previous_status IS NULL
    ) THEN
        RAISE EXCEPTION
            'Historic failed artifact metadata must remain unchanged';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'coa-historic-regeneration-policy: ok' AS result;
