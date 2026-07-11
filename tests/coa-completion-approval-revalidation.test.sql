-- COA COMPLETION APPROVAL REVALIDATION REGRESSION TEST
-- Verifies a worker cannot publish a CoA after sample approval changes and
-- that initial generation and regeneration restore valid report states.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/coa-completion-approval-revalidation.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_sample_id UUID;
    v_submission_id UUID;
    v_result_id UUID;
    v_manager_id UUID;
    v_signature_id UUID;
    v_report JSONB;
    v_report_id UUID;
    v_claim_id UUID;
    v_ready_file_hash TEXT := encode(
        digest('issue-68-ready', 'sha256'),
        'hex'
    );
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
          FROM public.results AS result
          JOIN public.assay_definitions AS assay
            ON assay.id = result.assay_id
          WHERE result.sample_id = sample.id
            AND assay.is_confidential = TRUE
      )
    ORDER BY sample.created_at
    LIMIT 1;

    SELECT manager.id, signature.id
    INTO v_manager_id, v_signature_id
    FROM public.users AS manager
    JOIN public.user_signatures AS signature
      ON signature.user_id = manager.id
     AND signature.is_active
     AND signature.deleted_at IS NULL
    WHERE manager.role = 'manager'
      AND manager.deleted_at IS NULL
    ORDER BY manager.created_at
    LIMIT 1;

    SELECT id
    INTO v_result_id
    FROM public.results
    WHERE sample_id = v_sample_id
    ORDER BY id
    LIMIT 1;

    IF v_sample_id IS NULL
       OR v_submission_id IS NULL
       OR v_result_id IS NULL
       OR v_manager_id IS NULL
       OR v_signature_id IS NULL THEN
        RAISE EXCEPTION
            'Issue 68 regression requires a completed non-confidential sample and active manager signature';
    END IF;

    UPDATE public.results
    SET status = 'approved',
        approved_by = v_manager_id,
        approved_at = COALESCE(
            approved_at,
            TIMESTAMPTZ '2026-07-11 00:00:00+00'
        )
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
        submission.user_id
    FROM public.results AS result
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    JOIN public.sample_submissions AS submission
      ON submission.id = v_submission_id
    WHERE result.sample_id = v_sample_id
    ON CONFLICT (submission_id, result_id) DO NOTHING;

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
    v_report := public.queue_coa_report_for_generation(
        v_sample_id,
        680001
    );
    EXECUTE 'RESET ROLE';

    v_report_id := (v_report ->> 'report_id')::UUID;
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'claimed')::BOOLEAN IS DISTINCT FROM TRUE
       OR v_report_id IS NULL
       OR v_claim_id IS NULL THEN
        RAISE EXCEPTION 'Initial Issue 68 report claim was not acquired';
    END IF;

    UPDATE public.samples
    SET status = 'in_progress'
    WHERE id = v_sample_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    IF public.complete_coa_report_generation(
        v_report_id,
        v_claim_id,
        'issue-68/stale-initial.html',
        encode(digest('issue-68-stale-initial', 'sha256'), 'hex'),
        v_signature_id
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Initial generation published after sample completion changed';
    END IF;
    EXECUTE 'RESET ROLE';

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_report_id
          AND status = 'failed'
          AND file_path = ''
          AND file_hash = ''
          AND error_message =
              'Sample approval changed before CoA completion'
          AND generation_claim_id IS NULL
          AND generation_claimed_by IS NULL
          AND generation_claimed_at IS NULL
          AND generation_previous_status IS NULL
    ) THEN
        RAISE EXCEPTION
            'Initial stale completion must fail and clear its claim';
    END IF;

    UPDATE public.results
    SET status = 'approved',
        approved_by = v_manager_id,
        approved_at = TIMESTAMPTZ '2026-07-11 00:00:00+00'
    WHERE id = v_result_id;

    UPDATE public.samples
    SET status = 'completed'
    WHERE id = v_sample_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.queue_coa_report_for_generation(
        v_sample_id,
        680001
    );
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'previous_status') <> 'failed'
       OR public.complete_coa_report_generation(
           v_report_id,
           v_claim_id,
           'issue-68/ready.html',
           v_ready_file_hash,
           v_signature_id
       ) IS NULL THEN
        RAISE EXCEPTION
            'Failed initial generation must remain retryable';
    END IF;

    v_report := public.claim_coa_report_regeneration(
        v_sample_id,
        680001
    );
    EXECUTE 'RESET ROLE';

    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'previous_status') <> 'ready'
       OR v_claim_id IS NULL THEN
        RAISE EXCEPTION
            'Ready report regeneration claim was not acquired';
    END IF;

    UPDATE public.results
    SET status = 'entered',
        approved_by = NULL,
        approved_at = NULL
    WHERE id = v_result_id;

    EXECUTE 'SET LOCAL ROLE authenticated';
    IF public.complete_coa_report_generation(
        v_report_id,
        v_claim_id,
        'issue-68/stale-regeneration.html',
        encode(digest('issue-68-stale-regeneration', 'sha256'), 'hex'),
        v_signature_id
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Regeneration published after result approval changed';
    END IF;
    EXECUTE 'RESET ROLE';

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = v_report_id
          AND status = 'ready'
          AND file_path = 'issue-68/ready.html'
          AND file_hash = v_ready_file_hash
          AND error_message IS NULL
          AND generation_claim_id IS NULL
          AND generation_claimed_by IS NULL
          AND generation_claimed_at IS NULL
          AND generation_previous_status IS NULL
    ) THEN
        RAISE EXCEPTION
            'Stale regeneration must restore the previous ready artifact and clear its claim';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'coa-completion-approval-revalidation: ok' AS result;
