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
    v_analyst_id UUID := '68000000-0000-0000-0000-000000000001';
    v_manager_id UUID := '68000000-0000-0000-0000-000000000002';
    v_analyst_signature_id UUID := '68000000-0000-0000-0000-000000000011';
    v_signature_id UUID := '68000000-0000-0000-0000-000000000012';
    v_sample_id UUID := '68000000-0000-0000-0000-000000000040';
    v_submission_id UUID := '68000000-0000-0000-0000-000000000060';
    v_result_id UUID := '68000000-0000-0000-0000-000000000051';
    v_report JSONB;
    v_report_id UUID;
    v_claim_id UUID;
    v_ready_file_hash TEXT := encode(
        digest('issue-68-ready', 'sha256'),
        'hex'
    );
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_analyst_id, 'issue-90-completion-analyst@lims.local'),
        (v_manager_id, 'issue-90-completion-manager@lims.local');

    INSERT INTO public.users (id, username, full_name, role)
    VALUES
        (
            v_analyst_id,
            'issue90_completion_analyst',
            'Issue 90 Completion Analyst',
            'analyst'
        ),
        (
            v_manager_id,
            'issue90_completion_manager',
            'Issue 90 Completion Manager',
            'manager'
        );

    INSERT INTO public.user_signatures (
        id,
        user_id,
        signature_path,
        signature_hash,
        file_size,
        mime_type,
        is_active
    )
    VALUES
        (
            v_analyst_signature_id,
            v_analyst_id,
            'issue-90/completion-analyst.png',
            encode(digest('issue-90-completion-analyst', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        ),
        (
            v_signature_id,
            v_manager_id,
            'issue-90/completion-manager.png',
            encode(digest('issue-90-completion-manager', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        );

    INSERT INTO public.clients (
        id,
        id_card_num,
        name,
        date_of_birth,
        gender,
        phone
    )
    VALUES (
        '68000000-0000-0000-0000-000000000020',
        '090680000001',
        'Issue 90 Completion Client',
        DATE '1990-06-08',
        'Nam',
        '0906800001'
    );

    INSERT INTO public.assay_definitions (
        id,
        name,
        units,
        is_confidential,
        normal_range,
        method_name
    )
    VALUES
        (
            '68000000-0000-0000-0000-000000000031',
            'Issue 90 Completion Assay A',
            'mg/L',
            FALSE,
            '1-10',
            'Completion Method A'
        ),
        (
            '68000000-0000-0000-0000-000000000032',
            'Issue 90 Completion Assay B',
            'mg/L',
            FALSE,
            '2-20',
            'Completion Method B'
        );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_at,
        received_by,
        type,
        completed_at,
        sample_quality
    )
    VALUES (
        v_sample_id,
        'ISSUE90-COA-COMPLETION',
        '68000000-0000-0000-0000-000000000020',
        'Issue 90 Completion Client',
        'in_progress',
        TIMESTAMPTZ '2026-07-21 00:00:00+00',
        v_analyst_id,
        'Máu',
        NULL,
        TRUE
    );

    INSERT INTO public.results (
        id,
        sample_id,
        assay_id,
        value,
        status,
        entered_by,
        entered_at
    )
    VALUES
        (
            v_result_id,
            v_sample_id,
            '68000000-0000-0000-0000-000000000031',
            '5',
            'entered',
            v_analyst_id,
            TIMESTAMPTZ '2026-07-21 00:05:00+00'
        ),
        (
            '68000000-0000-0000-0000-000000000052',
            v_sample_id,
            '68000000-0000-0000-0000-000000000032',
            '10',
            'entered',
            v_analyst_id,
            TIMESTAMPTZ '2026-07-21 00:06:00+00'
        );

    UPDATE public.samples
    SET status = 'review',
        review_started_at = TIMESTAMPTZ '2026-07-21 00:09:00+00'
    WHERE id = v_sample_id;

    INSERT INTO public.sample_submissions (
        id,
        sample_id,
        user_id,
        signature_id,
        submitted_at,
        submission_number,
        signature_meaning
    )
    VALUES (
        v_submission_id,
        v_sample_id,
        v_analyst_id,
        v_analyst_signature_id,
        TIMESTAMPTZ '2026-07-21 00:10:00+00',
        1,
        'I certify I performed these tests and entered these results accurately'
    );

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

    UPDATE public.results
    SET status = 'approved',
        approved_by = v_manager_id,
        approved_at = CASE id
            WHEN v_result_id THEN TIMESTAMPTZ '2026-07-21 00:15:00+00'
            ELSE TIMESTAMPTZ '2026-07-21 00:16:00+00'
        END
    WHERE sample_id = v_sample_id;

    UPDATE public.samples
    SET status = 'completed',
        completed_at = TIMESTAMPTZ '2026-07-21 00:20:00+00'
    WHERE id = v_sample_id;

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
    SET status = 'in_progress',
        completed_at = NULL
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
        approved_at = TIMESTAMPTZ '2026-07-21 00:25:00+00'
    WHERE id = v_result_id;

    UPDATE public.samples
    SET status = 'completed',
        completed_at = TIMESTAMPTZ '2026-07-21 00:30:00+00'
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
