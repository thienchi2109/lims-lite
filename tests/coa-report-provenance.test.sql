-- COA REPORT PROVENANCE REGRESSION TEST
-- Verifies Phase 4 binds every new CoA report to one immutable reviewed
-- submission while preserving nullable historic reports.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/coa-report-provenance.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_analyst_id UUID := '91000000-0000-0000-0000-000000000001';
    v_manager_id UUID := '91000000-0000-0000-0000-000000000002';
    v_analyst_signature_id UUID := '91000000-0000-0000-0000-000000000011';
    v_manager_signature_id UUID := '91000000-0000-0000-0000-000000000012';
    v_sample_id UUID := '91000000-0000-0000-0000-000000000040';
    v_other_sample_id UUID := '91000000-0000-0000-0000-000000000041';
    v_rejected_submission_id UUID := '91000000-0000-0000-0000-000000000060';
    v_active_submission_id UUID := '91000000-0000-0000-0000-000000000061';
    v_report JSONB;
    v_report_id UUID;
    v_claim_id UUID;
    v_snapshot_reference_range TEXT;
    v_assay_id UUID;
    v_historic_sample_id UUID := '91000000-0000-0000-0000-000000000040';
    v_historic_version INTEGER := 910002;
    v_rebind_rejected BOOLEAN := FALSE;
    v_direct_insert_rejected BOOLEAN := FALSE;
    v_truncate_rejected BOOLEAN := FALSE;
    v_historic_bind_rejected BOOLEAN := FALSE;
    v_wrong_sample_rejected BOOLEAN := FALSE;
BEGIN
    INSERT INTO auth.users (id, email)
    VALUES
        (v_analyst_id, 'issue-90-provenance-analyst@lims.local'),
        (v_manager_id, 'issue-90-provenance-manager@lims.local');

    INSERT INTO public.users (id, username, full_name, role)
    VALUES
        (
            v_analyst_id,
            'issue90_provenance_analyst',
            'Issue 90 Provenance Analyst',
            'analyst'
        ),
        (
            v_manager_id,
            'issue90_provenance_manager',
            'Issue 90 Provenance Manager',
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
            'issue-90/provenance-analyst.png',
            encode(digest('issue-90-provenance-analyst', 'sha256'), 'hex'),
            1,
            'image/png',
            TRUE
        ),
        (
            v_manager_signature_id,
            v_manager_id,
            'issue-90/provenance-manager.png',
            encode(digest('issue-90-provenance-manager', 'sha256'), 'hex'),
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
        '91000000-0000-0000-0000-000000000020',
        '090910000001',
        'Issue 90 Provenance Client',
        DATE '1991-09-10',
        'Nữ',
        '0909100001'
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
            '91000000-0000-0000-0000-000000000031',
            'Issue 90 Provenance Assay A',
            'mg/L',
            FALSE,
            '1-10',
            'Provenance Method A'
        ),
        (
            '91000000-0000-0000-0000-000000000032',
            'Issue 90 Provenance Assay B',
            'mg/L',
            FALSE,
            '2-20',
            'Provenance Method B'
        );

    INSERT INTO public.samples (
        id,
        sample_id,
        client_id,
        client_name,
        status,
        received_by,
        type,
        completed_at,
        sample_quality
    )
    VALUES
        (
            v_sample_id,
            'ISSUE90-COA-PROVENANCE',
            '91000000-0000-0000-0000-000000000020',
            'Issue 90 Provenance Client',
            'completed',
            v_analyst_id,
            'Máu',
            TIMESTAMPTZ '2026-07-21 03:00:00+00',
            TRUE
        ),
        (
            v_other_sample_id,
            'ISSUE90-COA-PROVENANCE-OTHER',
            '91000000-0000-0000-0000-000000000020',
            'Issue 90 Provenance Client',
            'received',
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
        approved_by,
        approved_at
    )
    VALUES
        (
            '91000000-0000-0000-0000-000000000051',
            v_sample_id,
            '91000000-0000-0000-0000-000000000031',
            '5',
            'approved',
            v_analyst_id,
            v_manager_id,
            TIMESTAMPTZ '2026-07-21 03:05:00+00'
        ),
        (
            '91000000-0000-0000-0000-000000000052',
            v_sample_id,
            '91000000-0000-0000-0000-000000000032',
            '10',
            'approved',
            v_analyst_id,
            v_manager_id,
            TIMESTAMPTZ '2026-07-21 03:06:00+00'
        );

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
        v_rejected_submission_id,
        v_sample_id,
        v_analyst_id,
        v_analyst_signature_id,
        TIMESTAMPTZ '2026-07-21 03:10:00+00',
        1,
        'I certify I performed these tests and entered these results accurately'
    );

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
        v_active_submission_id,
        v_sample_id,
        v_analyst_id,
        v_analyst_signature_id,
        TIMESTAMPTZ '2026-07-21 03:20:00+00',
        2,
        'I certify I performed these tests and entered these results accurately'
    );

    UPDATE public.sample_submissions
    SET superseded_by = v_active_submission_id
    WHERE id = v_rejected_submission_id;

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
        v_active_submission_id,
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
      ON submission.id = v_active_submission_id
    WHERE result.sample_id = v_sample_id
    ON CONFLICT (submission_id, result_id) DO NOTHING;

    IF (
        SELECT COUNT(*)
        FROM public.result_reference_assessments
        WHERE submission_id = v_active_submission_id
    ) <> (
        SELECT COUNT(*)
        FROM public.results
        WHERE sample_id = v_sample_id
    ) THEN
        RAISE EXCEPTION 'Test setup failed to create exact source snapshots';
    END IF;

    EXECUTE
        'ALTER TABLE public.coa_reports DISABLE TRIGGER prevent_coa_report_identity_change';

    INSERT INTO public.coa_reports (
        id,
        sample_id,
        file_path,
        file_hash,
        version,
        status,
        error_message,
        source_submission_id
    )
    VALUES (
        '91000000-0000-0000-0000-000000000070',
        v_historic_sample_id,
        '',
        '',
        v_historic_version,
        'failed',
        'Historic provenance fixture',
        NULL
    );

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
    v_report := public.queue_coa_report_for_generation(v_sample_id, 910001);
    v_report_id := (v_report ->> 'report_id')::UUID;
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'source_submission_id')::UUID
       IS DISTINCT FROM v_active_submission_id THEN
        RAISE EXCEPTION
            'New CoA report must bind the active replacement submission';
    END IF;

    IF (v_report ->> 'status') <> 'pending' THEN
        RAISE EXCEPTION 'New CoA report must be queued as pending';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.sample_submissions
        WHERE id = v_rejected_submission_id
          AND superseded_by = v_active_submission_id
    ) THEN
        RAISE EXCEPTION
            'Rejected submission history changed while binding the replacement';
    END IF;

    BEGIN
        INSERT INTO public.coa_reports (
            sample_id,
            file_path,
            file_hash,
            version,
            status
        )
        VALUES (
            v_sample_id,
            '',
            '',
            910004,
            'pending'
        );
    EXCEPTION
        WHEN insufficient_privilege OR not_null_violation THEN
            v_direct_insert_rejected := TRUE;
    END;

    IF NOT v_direct_insert_rejected THEN
        RAISE EXCEPTION
            'Authenticated users must not insert CoA reports outside the queue RPC';
    END IF;

    BEGIN
        TRUNCATE TABLE public.coa_reports;
    EXCEPTION
        WHEN insufficient_privilege THEN
            v_truncate_rejected := TRUE;
    END;

    IF NOT v_truncate_rejected THEN
        RAISE EXCEPTION
            'Authenticated users must not truncate CoA provenance records';
    END IF;

    EXECUTE 'RESET ROLE';

    SELECT
        assessment.reference_range,
        result.assay_id
    INTO
        v_snapshot_reference_range,
        v_assay_id
    FROM public.result_reference_assessments AS assessment
    JOIN public.results AS result
      ON result.id = assessment.result_id
    WHERE assessment.submission_id = v_active_submission_id
    ORDER BY assessment.result_id
    LIMIT 1;

    UPDATE public.assay_definitions
    SET normal_range = '__phase4_changed_range__'
    WHERE id = v_assay_id;

    IF NOT EXISTS (
        SELECT 1
        FROM public.result_reference_assessments
        WHERE submission_id = v_active_submission_id
          AND reference_range IS NOT DISTINCT FROM v_snapshot_reference_range
    ) THEN
        RAISE EXCEPTION
            'Reference-range snapshot changed after the assay definition changed';
    END IF;

    EXECUTE 'SET LOCAL ROLE authenticated';
    IF NOT public.fail_coa_report_generation(
        v_report_id,
        v_claim_id,
        'Synthetic generation failure',
        FALSE
    ) THEN
        RAISE EXCEPTION 'Claim owner must be able to prepare retry state';
    END IF;

    v_report := public.queue_coa_report_for_generation(v_sample_id, 910001);
    v_claim_id := (v_report ->> 'generation_claim_id')::UUID;

    IF (v_report ->> 'source_submission_id')::UUID
       IS DISTINCT FROM v_active_submission_id
       OR (v_report ->> 'status') <> 'pending' THEN
        RAISE EXCEPTION
            'Retry must preserve the original source and return the report to pending';
    END IF;

    IF NOT public.fail_coa_report_generation(
        v_report_id,
        v_claim_id,
        'Prepare immutable source update test',
        FALSE
    ) THEN
        RAISE EXCEPTION
            'Claim owner must be able to prepare immutable source test';
    END IF;

    EXECUTE 'RESET ROLE';

    BEGIN
        UPDATE public.coa_reports
        SET source_submission_id = gen_random_uuid()
        WHERE id = v_report_id;
    EXCEPTION
        WHEN SQLSTATE '55000' OR raise_exception THEN
            v_rebind_rejected := TRUE;
    END;

    IF NOT v_rebind_rejected THEN
        RAISE EXCEPTION 'Populated CoA source must reject rebinding';
    END IF;

    EXECUTE 'RESET ROLE';

    IF NOT EXISTS (
        SELECT 1
        FROM public.coa_reports
        WHERE id = '91000000-0000-0000-0000-000000000070'
          AND sample_id = v_historic_sample_id
          AND version = v_historic_version
          AND source_submission_id IS NULL
    ) THEN
        RAISE EXCEPTION
            'CoA provenance test requires one historic report without a source';
    END IF;

    EXECUTE 'SET LOCAL ROLE authenticated';
    v_report := public.queue_coa_report_for_generation(
        v_historic_sample_id,
        v_historic_version
    );

    IF v_report ->> 'source_submission_id' IS NOT NULL THEN
        RAISE EXCEPTION
            'Historic report without a source must retain nullable fallback compatibility';
    END IF;

    EXECUTE 'RESET ROLE';

    BEGIN
        UPDATE public.coa_reports
        SET source_submission_id = v_active_submission_id
        WHERE sample_id = v_historic_sample_id
          AND version = v_historic_version
          AND deleted_at IS NULL;
    EXCEPTION
        WHEN SQLSTATE '55000' OR raise_exception THEN
            v_historic_bind_rejected := TRUE;
    END;

    IF NOT v_historic_bind_rejected THEN
        RAISE EXCEPTION
            'Historic NULL source must remain permanently unbound';
    END IF;

    BEGIN
        INSERT INTO public.coa_reports (
            sample_id,
            source_submission_id,
            file_path,
            file_hash,
            version,
            status,
            error_message
        )
        VALUES (
            v_other_sample_id,
            v_active_submission_id,
            '',
            '',
            910003,
            'failed',
            'Synthetic wrong-sample source'
        );
    EXCEPTION
        WHEN foreign_key_violation THEN
            v_wrong_sample_rejected := TRUE;
    END;

    IF NOT v_wrong_sample_rejected THEN
        RAISE EXCEPTION
            'CoA source FK must reject a submission from another sample';
    END IF;

END;
$$;

ROLLBACK;

SELECT 'coa-report-provenance: ok' AS result;
