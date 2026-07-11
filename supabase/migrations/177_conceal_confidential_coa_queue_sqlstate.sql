-- Migration 177: Conceal confidential CoA queue SQLSTATE
-- Security Impact: High
-- Changes:
--   - Makes missing and confidential-inaccessible samples indistinguishable.
--   - Preserves the migration 174 queue authorization and claim workflow.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_queue_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.queue_coa_report_for_generation(uuid,integer)'::regprocedure
    )
    INTO v_queue_definition;

    IF v_queue_definition NOT ILIKE
       '%public.user_can_access_confidential()%'
       OR v_queue_definition NOT ILIKE
       '%assay_definition.is_confidential = TRUE%'
       OR v_queue_definition NOT ILIKE
       '%IF v_sample_status IS NULL THEN%RAISE EXCEPTION ''Sample not found'';%END IF;%'
       OR v_queue_definition ILIKE
       '%IF v_sample_status IS NULL THEN%RAISE EXCEPTION ''Sample not found''%ERRCODE = ''42501''%END IF;%' THEN
        RAISE EXCEPTION
            'Migration 177 found an unexpected migration 174 queue baseline';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.queue_coa_report_for_generation(
    p_sample_id UUID,
    p_version INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role;
    v_sample_status public.sample_status;
    v_report public.coa_reports%ROWTYPE;
    v_source_submission_id UUID;
    v_result_count INTEGER;
    v_snapshot_count INTEGER;
    v_claim_id UUID;
    v_existing_report BOOLEAN;
    v_previous_status TEXT;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '42501';
    END IF;

    SELECT role
    INTO v_user_role
    FROM public.users
    WHERE id = v_user_id
      AND deleted_at IS NULL;

    IF v_user_role IS NULL
       OR v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION 'Only active analysts and managers may queue CoA reports'
            USING ERRCODE = '42501';
    END IF;

    IF p_version < 1 THEN
        RAISE EXCEPTION 'CoA report version must be positive';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.results AS result
        JOIN public.assay_definitions AS assay_definition
          ON assay_definition.id = result.assay_id
        WHERE result.sample_id = p_sample_id
          AND assay_definition.is_confidential = TRUE
    )
    AND NOT public.user_can_access_confidential() THEN
        RAISE EXCEPTION 'Sample not found'
            USING ERRCODE = '42501';
    END IF;

    SELECT status
    INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_sample_status IS NULL THEN
        RAISE EXCEPTION 'Sample not found'
            USING ERRCODE = '42501';
    END IF;

    IF v_sample_status <> 'completed' THEN
        RAISE EXCEPTION
            'Sample must be completed before final CoA generation';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.results
        WHERE sample_id = p_sample_id
          AND status <> 'approved'
    ) THEN
        RAISE EXCEPTION
            'All sample results must be approved before final CoA generation';
    END IF;

    SELECT *
    INTO v_report
    FROM public.coa_reports
    WHERE sample_id = p_sample_id
      AND version = p_version
      AND deleted_at IS NULL
    FOR UPDATE;

    v_existing_report := FOUND;

    IF v_existing_report
       AND v_report.status = 'pending'
       AND v_report.generation_claimed_at >
           NOW() - INTERVAL '15 minutes' THEN
        RETURN jsonb_build_object(
            'report_id', v_report.id,
            'status', v_report.status,
            'file_path', NULLIF(v_report.file_path, ''),
            'source_submission_id', v_report.source_submission_id,
            'claimed', FALSE,
            'generation_claim_id', NULL,
            'previous_status', v_report.generation_previous_status
        );
    END IF;

    IF v_existing_report
       AND v_report.status NOT IN ('failed', 'pending') THEN
        RETURN jsonb_build_object(
            'report_id', v_report.id,
            'status', v_report.status,
            'file_path', NULLIF(v_report.file_path, ''),
            'source_submission_id', v_report.source_submission_id,
            'claimed', FALSE,
            'generation_claim_id', NULL,
            'previous_status', NULL
        );
    END IF;

    IF v_existing_report THEN
        v_source_submission_id := v_report.source_submission_id;
        v_previous_status := CASE
            WHEN v_report.status = 'pending'
                THEN v_report.generation_previous_status
            ELSE v_report.status
        END;
    ELSE
        SELECT submission.id
        INTO v_source_submission_id
        FROM public.sample_submissions AS submission
        WHERE submission.sample_id = p_sample_id
          AND submission.superseded_by IS NULL
        ORDER BY submission.submission_number DESC
        LIMIT 1
        FOR SHARE;

        IF v_source_submission_id IS NULL THEN
            RAISE EXCEPTION
                'No active reviewed submission exists for this sample';
        END IF;
    END IF;

    IF v_source_submission_id IS NOT NULL THEN
        SELECT COUNT(*)
        INTO v_result_count
        FROM public.results
        WHERE sample_id = p_sample_id;

        SELECT COUNT(*)
        INTO v_snapshot_count
        FROM public.result_reference_assessments AS assessment
        JOIN public.results AS result
          ON result.id = assessment.result_id
         AND result.sample_id = p_sample_id
        WHERE assessment.submission_id = v_source_submission_id;

        IF v_result_count = 0 OR v_snapshot_count <> v_result_count THEN
            RAISE EXCEPTION
                'Reviewed submission snapshots do not match the current sample result set';
        END IF;
    END IF;

    v_claim_id := gen_random_uuid();

    IF v_existing_report THEN
        UPDATE public.coa_reports
        SET status = 'pending',
            error_message = NULL,
            generation_claim_id = v_claim_id,
            generation_claimed_by = v_user_id,
            generation_claimed_at = NOW(),
            generation_previous_status = v_previous_status
        WHERE id = v_report.id
        RETURNING *
        INTO v_report;
    ELSE
        INSERT INTO public.coa_reports (
            sample_id,
            source_submission_id,
            file_path,
            file_hash,
            version,
            status,
            error_message,
            generation_claim_id,
            generation_claimed_by,
            generation_claimed_at,
            generation_previous_status
        )
        VALUES (
            p_sample_id,
            v_source_submission_id,
            '',
            '',
            p_version,
            'pending',
            NULL,
            v_claim_id,
            v_user_id,
            NOW(),
            NULL
        )
        RETURNING *
        INTO v_report;
    END IF;

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'status', v_report.status,
        'file_path', NULLIF(v_report.file_path, ''),
        'source_submission_id', v_report.source_submission_id,
        'claimed', TRUE,
        'generation_claim_id', v_claim_id,
        'previous_status', v_previous_status
    );
END;
$$;

COMMENT ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
IS 'Claims a CoA generation lease without disclosing unavailable sample existence.';

REVOKE ALL ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
TO authenticated;

COMMIT;
