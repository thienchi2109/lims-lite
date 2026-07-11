-- COA CONFIDENTIAL CLAIM AUTHORIZATION REGRESSION TEST
-- Verifies queue, retry, and regeneration RPCs enforce confidential access
-- before granting or changing a generation claim.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/coa-confidential-claim-authorization.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_sample_id UUID;
    v_submission_id UUID;
    v_analyst_id UUID;
    v_manager_id UUID;
    v_confidential_assay_id UUID;
    v_report JSONB;
    v_report_id UUID;
    v_error_message TEXT;
    v_missing_error_message TEXT;
    v_denied_sqlstate TEXT;
    v_missing_sqlstate TEXT;
    v_analyst_denied BOOLEAN := FALSE;
    v_manager_denied BOOLEAN := FALSE;
    v_retry_denied BOOLEAN := FALSE;
    v_regeneration_denied BOOLEAN := FALSE;
BEGIN
    SELECT sample.id, submission.id
    INTO v_sample_id, v_submission_id
    FROM public.samples AS sample
    JOIN public.sample_submissions AS submission
      ON submission.sample_id = sample.id
     AND submission.superseded_by IS NULL
    WHERE sample.deleted_at IS NULL
      AND sample.status = 'completed'
      AND (
          SELECT COUNT(*)
          FROM public.results AS result
          WHERE result.sample_id = sample.id
      ) >= 2
      AND NOT EXISTS (
          SELECT 1
          FROM public.results AS result
          WHERE result.sample_id = sample.id
            AND result.status <> 'approved'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM public.coa_reports AS report
          WHERE report.sample_id = sample.id
            AND report.version IN (690001, 690002)
      )
    ORDER BY sample.created_at
    LIMIT 1;

    SELECT id
    INTO v_analyst_id
    FROM public.users
    WHERE role = 'analyst'
      AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    SELECT id
    INTO v_manager_id
    FROM public.users
    WHERE role = 'manager'
      AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    SELECT result.assay_id
    INTO v_confidential_assay_id
    FROM public.results AS result
    WHERE result.sample_id = v_sample_id
    ORDER BY result.id
    LIMIT 1;

    IF v_sample_id IS NULL
       OR v_submission_id IS NULL
       OR v_analyst_id IS NULL
       OR v_manager_id IS NULL
       OR v_confidential_assay_id IS NULL THEN
        RAISE EXCEPTION
            'Confidential CoA claim test requires a completed reviewed sample, analyst, and manager';
    END IF;

    UPDATE public.results
    SET status = 'approved',
        approved_at = COALESCE(
            approved_at,
            TIMESTAMPTZ '2026-07-11 00:00:00+00'
        ),
        approved_by = COALESCE(approved_by, v_manager_id)
    WHERE sample_id = v_sample_id;

    INSERT INTO public.result_reference_assessments (
        submission_id,
        result_id,
        assessment,
        assay_name,
        result_value,
        unit,
        method_name,
        reference_range,
        analyst_id
    )
    SELECT
        v_submission_id,
        result.id,
        'within_reference_range',
        assay.name,
        COALESCE(result.value, ''),
        assay.units,
        assay.method_name,
        assay.normal_range,
        v_analyst_id
    FROM public.results AS result
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    WHERE result.sample_id = v_sample_id
    ON CONFLICT (submission_id, result_id) DO NOTHING;

    UPDATE public.assay_definitions
    SET is_confidential = TRUE
    WHERE id = v_confidential_assay_id;

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id IN (v_analyst_id, v_manager_id);

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_analyst_id, 'role', 'authenticated')::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, TRUE);

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.queue_coa_report_for_generation(
            '00000000-0000-0000-0000-000000000069',
            690001
        );
        RAISE EXCEPTION 'Missing sample queue unexpectedly succeeded'
            USING ERRCODE = 'P0002';
    EXCEPTION
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS
                v_missing_sqlstate = RETURNED_SQLSTATE,
                v_missing_error_message = MESSAGE_TEXT;
    END;

    BEGIN
        PERFORM public.queue_coa_report_for_generation(
            v_sample_id,
            690001
        );
        RAISE EXCEPTION 'Unauthorized analyst queued a confidential CoA report'
            USING ERRCODE = 'P0002';
    EXCEPTION
        WHEN OTHERS THEN
            GET STACKED DIAGNOSTICS
                v_denied_sqlstate = RETURNED_SQLSTATE,
                v_error_message = MESSAGE_TEXT;
    END;

    v_analyst_denied := v_denied_sqlstate <> 'P0002';

    IF v_denied_sqlstate IS DISTINCT FROM v_missing_sqlstate
       OR v_error_message IS DISTINCT FROM v_missing_error_message THEN
        RAISE EXCEPTION
            'Confidential queue denial disclosed sample state: % % vs % %',
            v_denied_sqlstate,
            v_error_message,
            v_missing_sqlstate,
            v_missing_error_message;
    END IF;
    EXECUTE 'RESET ROLE';

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_manager_id, 'role', 'authenticated')::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, TRUE);

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.queue_coa_report_for_generation(
            v_sample_id,
            690002
        );
        RAISE EXCEPTION
            'Unauthorized manager queued a confidential CoA report';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_manager_denied := TRUE;
    END;
    EXECUTE 'RESET ROLE';

    IF NOT v_analyst_denied OR NOT v_manager_denied THEN
        RAISE EXCEPTION
            'Confidential queue authorization did not fail closed';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE sample_id = v_sample_id
          AND version IN (690001, 690002)
    ) THEN
        RAISE EXCEPTION
            'Denied confidential queue call changed CoA report state';
    END IF;

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_analyst_id;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_analyst_id, 'role', 'authenticated')::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_analyst_id::TEXT, TRUE);

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.queue_coa_report_for_generation(
        v_sample_id,
        690001
    );
    EXECUTE 'RESET ROLE';

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION
            'Authorized analyst could not queue a confidential CoA report';
    END IF;

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_manager_id;

    PERFORM set_config(
        'request.jwt.claims',
        jsonb_build_object('sub', v_manager_id, 'role', 'authenticated')::TEXT,
        TRUE
    );
    PERFORM set_config('request.jwt.claim.sub', v_manager_id::TEXT, TRUE);

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.queue_coa_report_for_generation(
        v_sample_id,
        690002
    );
    EXECUTE 'RESET ROLE';

    v_report_id := (v_report ->> 'report_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report_id IS NULL THEN
        RAISE EXCEPTION
            'Authorized manager could not queue a confidential CoA report';
    END IF;

    UPDATE public.coa_reports
    SET status = 'failed',
        error_message = 'Confidential authorization fixture',
        generation_claim_id = NULL,
        generation_claimed_by = NULL,
        generation_claimed_at = NULL,
        generation_previous_status = NULL
    WHERE id = v_report_id;

    UPDATE public.users
    SET can_access_confidential = FALSE
    WHERE id = v_manager_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
        PERFORM public.queue_coa_report_for_generation(
            v_sample_id,
            690002
        );
        RAISE EXCEPTION
            'Unauthorized manager retried a confidential CoA report';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_retry_denied := TRUE;
    END;

    BEGIN
        PERFORM public.claim_coa_report_regeneration(
            v_sample_id,
            690002
        );
        RAISE EXCEPTION
            'Unauthorized manager regenerated a confidential CoA report';
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_regeneration_denied := TRUE;
    END;
    EXECUTE 'RESET ROLE';

    IF NOT v_retry_denied OR NOT v_regeneration_denied THEN
        RAISE EXCEPTION
            'Confidential retry or regeneration authorization did not fail closed';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_report_id
          AND status = 'failed'
          AND generation_claim_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'Denied confidential retry or regeneration changed report state';
    END IF;

    UPDATE public.users
    SET can_access_confidential = TRUE
    WHERE id = v_manager_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.claim_coa_report_regeneration(
        v_sample_id,
        690002
    );
    EXECUTE 'RESET ROLE';

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report ->> 'previous_status' <> 'failed'
       OR v_report ->> 'generation_claim_id' IS NULL THEN
        RAISE EXCEPTION
            'Authorized manager could not regenerate a confidential CoA report';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'CoA confidential claim authorization tests passed' AS result;
