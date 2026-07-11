-- Migration 160: Add assessment-aware signed submission RPC
-- Security Impact: HIGH
-- Changes:
--   - Validates an exact, current assessment set under row locks.
--   - Creates the signed submission, immutable snapshots, and review status
--     transition atomically without changing the legacy RPC or its caller.

SET search_path TO public, extensions;

CREATE OR REPLACE FUNCTION public.submit_sample_for_review_with_assessments(
    p_sample_id UUID,
    p_assessments JSONB
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
    v_signature_id UUID;
    v_signature_hash TEXT;
    v_submission_id UUID;
    v_submission_number INTEGER;
    v_previous_submission_id UUID;
    v_current_result_count INTEGER;
    v_missing_result_count INTEGER;
    v_payload_count INTEGER;
    v_payload_distinct_result_count INTEGER;
    v_invalid_assessment_count INTEGER;
    v_foreign_result_count INTEGER;
    v_stale_revision_count INTEGER;
    v_deleted_assay_count INTEGER;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role
    INTO v_user_role
    FROM public.users
    WHERE id = v_user_id
      AND deleted_at IS NULL;

    IF v_user_role IS NULL OR v_user_role <> 'analyst'::public.user_role THEN
        RAISE EXCEPTION 'Only analysts can submit samples for review';
    END IF;

    SELECT id, signature_hash
    INTO v_signature_id, v_signature_hash
    FROM public.user_signatures
    WHERE user_id = v_user_id
      AND is_active = TRUE
      AND deleted_at IS NULL;

    IF v_signature_id IS NULL THEN
        RAISE EXCEPTION 'E4001: Bạn cần tải lên chữ ký điện tử trước khi gửi duyệt. Vào trang Hồ sơ để tải lên chữ ký.';
    END IF;

    IF v_signature_hash IS NULL OR v_signature_hash = '' THEN
        RAISE EXCEPTION 'E4002: Chữ ký không hợp lệ. Vui lòng tải lên lại chữ ký mới.';
    END IF;

    SELECT status
    INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_sample_status <> 'in_progress'::public.sample_status THEN
        RAISE EXCEPTION 'Sample must be in progress to submit for review';
    END IF;

    IF jsonb_typeof(p_assessments) <> 'array' THEN
        RAISE EXCEPTION 'Assessment payload must be a JSON array';
    END IF;

    PERFORM 1
    FROM public.results AS result
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    WHERE result.sample_id = p_sample_id
    FOR UPDATE OF result, assay;

    SELECT COUNT(*)
    INTO v_current_result_count
    FROM public.results
    WHERE sample_id = p_sample_id;

    IF v_current_result_count = 0 THEN
        RAISE EXCEPTION 'Cannot submit sample with no assigned tests';
    END IF;

    SELECT COUNT(*)
    INTO v_missing_result_count
    FROM public.results
    WHERE sample_id = p_sample_id
      AND (value IS NULL OR value = '');

    IF v_missing_result_count > 0 THEN
        RAISE EXCEPTION 'All tests must have results before submitting';
    END IF;

    SELECT
        COUNT(*),
        COUNT(DISTINCT payload.result_id),
        COUNT(*) FILTER (
            WHERE payload.assessment IS NULL
               OR payload.assessment NOT IN (
                   'within_reference_range',
                   'outside_reference_range'
               )
               OR payload.result_updated_at IS NULL
               OR payload.assay_updated_at IS NULL
        )
    INTO
        v_payload_count,
        v_payload_distinct_result_count,
        v_invalid_assessment_count
    FROM jsonb_to_recordset(p_assessments) AS payload(
        result_id UUID,
        assessment TEXT,
        result_updated_at TIMESTAMPTZ,
        assay_updated_at TIMESTAMPTZ
    );

    IF v_payload_count <> v_current_result_count
       OR v_payload_distinct_result_count <> v_current_result_count THEN
        RAISE EXCEPTION 'Assessment payload must contain every result exactly once';
    END IF;

    IF v_invalid_assessment_count > 0 THEN
        RAISE EXCEPTION 'Assessment payload contains an invalid assessment or revision token';
    END IF;

    SELECT COUNT(*)
    INTO v_foreign_result_count
    FROM jsonb_to_recordset(p_assessments) AS payload(
        result_id UUID,
        assessment TEXT,
        result_updated_at TIMESTAMPTZ,
        assay_updated_at TIMESTAMPTZ
    )
    LEFT JOIN public.results AS result
      ON result.id = payload.result_id
     AND result.sample_id = p_sample_id
    WHERE result.id IS NULL;

    IF v_foreign_result_count > 0 THEN
        RAISE EXCEPTION 'Assessment payload contains a result outside the sample';
    END IF;

    SELECT COUNT(*)
    INTO v_deleted_assay_count
    FROM public.results AS result
    LEFT JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
     AND assay.deleted_at IS NULL
    WHERE result.sample_id = p_sample_id
      AND assay.id IS NULL;

    IF v_deleted_assay_count > 0 THEN
        RAISE EXCEPTION 'Cannot submit a result with an inactive assay definition';
    END IF;

    SELECT COUNT(*)
    INTO v_stale_revision_count
    FROM jsonb_to_recordset(p_assessments) AS payload(
        result_id UUID,
        assessment TEXT,
        result_updated_at TIMESTAMPTZ,
        assay_updated_at TIMESTAMPTZ
    )
    JOIN public.results AS result
      ON result.id = payload.result_id
     AND result.sample_id = p_sample_id
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
    WHERE result.updated_at IS DISTINCT FROM payload.result_updated_at
       OR assay.updated_at IS DISTINCT FROM payload.assay_updated_at;

    IF v_stale_revision_count > 0 THEN
        RAISE EXCEPTION 'Assessment payload is stale; review the current result data before submitting';
    END IF;

    SELECT id
    INTO v_previous_submission_id
    FROM public.sample_submissions
    WHERE sample_id = p_sample_id
      AND superseded_by IS NULL
    ORDER BY submission_number DESC
    LIMIT 1;

    INSERT INTO public.sample_submissions (
        sample_id,
        user_id,
        signature_id,
        submission_number,
        signature_meaning
    )
    VALUES (
        p_sample_id,
        v_user_id,
        v_signature_id,
        (
            SELECT COALESCE(MAX(submission_number), 0) + 1
            FROM public.sample_submissions
            WHERE sample_id = p_sample_id
        ),
        'I certify I performed these tests and entered these results accurately'
    )
    RETURNING id, submission_number
    INTO v_submission_id, v_submission_number;

    INSERT INTO public.result_reference_assessments (
        submission_id,
        result_id,
        assessment,
        assay_name,
        result_value,
        unit,
        method_name,
        reference_range,
        analyst_id,
        assessed_at
    )
    SELECT
        v_submission_id,
        result.id,
        payload.assessment::public.result_reference_assessment,
        assay.name,
        result.value,
        assay.units,
        assay.method_name,
        assay.normal_range,
        v_user_id,
        NOW()
    FROM jsonb_to_recordset(p_assessments) AS payload(
        result_id UUID,
        assessment TEXT,
        result_updated_at TIMESTAMPTZ,
        assay_updated_at TIMESTAMPTZ
    )
    JOIN public.results AS result
      ON result.id = payload.result_id
     AND result.sample_id = p_sample_id
    JOIN public.assay_definitions AS assay
      ON assay.id = result.assay_id
     AND assay.deleted_at IS NULL;

    IF v_previous_submission_id IS NOT NULL THEN
        UPDATE public.sample_submissions
        SET superseded_by = v_submission_id
        WHERE id = v_previous_submission_id;
    END IF;

    UPDATE public.samples
    SET status = 'review',
        rejection_reason = NULL,
        rejected_at = NULL,
        rejected_by = NULL,
        updated_at = NOW()
    WHERE id = p_sample_id;

    RETURN jsonb_build_object(
        'sample_id', p_sample_id,
        'new_status', 'review',
        'submission_id', v_submission_id,
        'signature_id', v_signature_id,
        'submission_number', v_submission_number,
        'assessment_count', v_current_result_count
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_sample_for_review_with_assessments(UUID, JSONB)
FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.submit_sample_for_review_with_assessments(UUID, JSONB)
TO authenticated;

COMMENT ON FUNCTION public.submit_sample_for_review_with_assessments(UUID, JSONB)
IS 'Creates a signed review submission and immutable server-built assessment snapshots after validating an exact current result set.';

DO $$
DECLARE
    v_rpc_exists BOOLEAN;
    v_anon_can_execute BOOLEAN;
    v_authenticated_can_execute BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1
        FROM pg_proc
        WHERE oid = 'public.submit_sample_for_review_with_assessments(uuid,jsonb)'::regprocedure
    )
    INTO v_rpc_exists;

    SELECT has_function_privilege(
        'anon',
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)',
        'EXECUTE'
    )
    INTO v_anon_can_execute;

    SELECT has_function_privilege(
        'authenticated',
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)',
        'EXECUTE'
    )
    INTO v_authenticated_can_execute;

    IF NOT v_rpc_exists
       OR v_anon_can_execute
       OR NOT v_authenticated_can_execute THEN
        RAISE EXCEPTION 'Migration 160 verification failed';
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
