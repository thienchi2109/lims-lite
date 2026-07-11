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
    v_sample_id UUID;
    v_active_submission_id UUID;
    v_rejected_submission_id UUID;
    v_manager_id UUID;
    v_report JSONB;
    v_report_id UUID;
    v_claim_id UUID;
    v_snapshot_reference_range TEXT;
    v_assay_id UUID;
    v_other_sample_id UUID;
    v_historic_sample_id UUID;
    v_historic_version INTEGER;
    v_rebind_rejected BOOLEAN := FALSE;
    v_direct_insert_rejected BOOLEAN := FALSE;
    v_truncate_rejected BOOLEAN := FALSE;
    v_historic_bind_rejected BOOLEAN := FALSE;
    v_wrong_sample_rejected BOOLEAN := FALSE;
BEGIN
    SELECT
        sample.id,
        active_submission.id,
        rejected_submission.id
    INTO
        v_sample_id,
        v_active_submission_id,
        v_rejected_submission_id
    FROM public.samples AS sample
    JOIN public.sample_submissions AS active_submission
      ON active_submission.sample_id = sample.id
     AND active_submission.superseded_by IS NULL
    JOIN public.sample_submissions AS rejected_submission
      ON rejected_submission.sample_id = sample.id
     AND rejected_submission.superseded_by = active_submission.id
    WHERE sample.status = 'completed'
      AND sample.deleted_at IS NULL
      AND NOT EXISTS (
          SELECT 1
          FROM public.results
          WHERE sample_id = sample.id
            AND status <> 'approved'
      )
    ORDER BY active_submission.submission_number DESC
    LIMIT 1;

    IF v_sample_id IS NULL THEN
        RAISE EXCEPTION
            'CoA provenance test requires a completed sample with a replaced submission';
    END IF;

    SELECT id
    INTO v_manager_id
    FROM public.users
    WHERE role = 'manager'
      AND deleted_at IS NULL
    ORDER BY created_at
    LIMIT 1;

    IF v_manager_id IS NULL THEN
        RAISE EXCEPTION 'CoA provenance test requires an active manager';
    END IF;

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

    SELECT report.sample_id, report.version
    INTO v_historic_sample_id, v_historic_version
    FROM public.coa_reports AS report
    JOIN public.samples AS sample
      ON sample.id = report.sample_id
    WHERE report.deleted_at IS NULL
      AND report.source_submission_id IS NULL
      AND sample.deleted_at IS NULL
      AND sample.status = 'completed'
      AND NOT EXISTS (
          SELECT 1
          FROM public.results
          WHERE sample_id = sample.id
            AND status <> 'approved'
      )
    ORDER BY report.created_at
    LIMIT 1;

    IF v_historic_sample_id IS NULL THEN
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

    SELECT id
    INTO v_other_sample_id
    FROM public.samples
    WHERE id <> v_sample_id
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_other_sample_id IS NOT NULL THEN
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
    END IF;

END;
$$;

ROLLBACK;

SELECT 'coa-report-provenance: ok' AS result;
