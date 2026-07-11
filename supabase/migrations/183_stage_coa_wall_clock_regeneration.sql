-- Migration 183: Stage wall-clock CoA regeneration claims
-- Security Impact: High
-- Changes:
--   - Stages regeneration freshness with the canonical lease duration.
--   - Evaluates wall-clock freshness only after locking the report row.
--   - Preserves confidential and historic provenance guards.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_regeneration_source TEXT;
BEGIN
    IF to_regprocedure(
        'public.claim_coa_report_regeneration_wall_clock(uuid,integer)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.coa_generation_lease_duration()'
       ) IS NULL THEN
        RAISE EXCEPTION
            'Migration 183 found an unexpected staged lease baseline';
    END IF;

    SELECT prosrc
    INTO v_regeneration_source
    FROM pg_proc
    WHERE oid =
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure;

    IF encode(
        public.digest(v_regeneration_source, 'sha256'::TEXT),
        'hex'
    ) <> 'ff5932958e8ec3d9cbffb5be357e64ca3cd1e3bb86fa81f96acf779960d7ce77'
    THEN
        RAISE EXCEPTION
            'Migration 183 found an unexpected CoA regeneration baseline';
    END IF;
END;
$$;

CREATE FUNCTION public.claim_coa_report_regeneration_wall_clock(
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
    v_report public.coa_reports%ROWTYPE;
    v_previous_status TEXT;
    v_result_count INTEGER;
    v_snapshot_count INTEGER;
    v_claim_id UUID;
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

    IF v_user_role IS DISTINCT FROM 'manager'::public.user_role THEN
        RAISE EXCEPTION 'Only active managers may regenerate CoA reports'
            USING ERRCODE = '42501';
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

    SELECT report.*
    INTO v_report
    FROM public.coa_reports AS report
    JOIN public.samples AS sample
      ON sample.id = report.sample_id
     AND sample.deleted_at IS NULL
     AND sample.status = 'completed'
    WHERE report.sample_id = p_sample_id
      AND report.version = p_version
      AND report.deleted_at IS NULL
    FOR UPDATE OF report;

    IF NOT FOUND THEN
        RETURN public.queue_coa_report_for_generation(
            p_sample_id,
            p_version
        );
    END IF;

    IF v_report.status = 'pending'
       AND v_report.generation_claimed_at >
           clock_timestamp()
           - public.coa_generation_lease_duration() THEN
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

    IF v_report.source_submission_id IS NULL THEN
        RETURN jsonb_build_object(
            'report_id', v_report.id,
            'status', v_report.status,
            'file_path', NULLIF(v_report.file_path, ''),
            'source_submission_id', NULL,
            'claimed', FALSE,
            'generation_claim_id', NULL,
            'previous_status', NULL,
            'blocked_reason', 'HISTORIC_REPORT_WITHOUT_SOURCE'
        );
    END IF;

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
    WHERE assessment.submission_id = v_report.source_submission_id;

    IF v_result_count = 0 OR v_snapshot_count <> v_result_count THEN
        RAISE EXCEPTION
            'Reviewed submission snapshots do not match the current sample result set';
    END IF;

    v_previous_status := CASE
        WHEN v_report.status = 'pending'
            THEN v_report.generation_previous_status
        ELSE v_report.status
    END;
    v_claim_id := gen_random_uuid();

    UPDATE public.coa_reports
    SET status = 'pending',
        error_message = NULL,
        generation_claim_id = v_claim_id,
        generation_claimed_by = v_user_id,
        generation_claimed_at = clock_timestamp(),
        generation_previous_status = v_previous_status
    WHERE id = v_report.id;

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'status', 'pending',
        'file_path', NULLIF(v_report.file_path, ''),
        'source_submission_id', v_report.source_submission_id,
        'claimed', TRUE,
        'generation_claim_id', v_claim_id,
        'previous_status', v_previous_status
    );
END;
$$;

COMMENT ON FUNCTION
public.claim_coa_report_regeneration_wall_clock(UUID, INTEGER)
IS 'Staged wall-clock CoA regeneration claim implementation.';

REVOKE ALL ON FUNCTION
public.claim_coa_report_regeneration_wall_clock(UUID, INTEGER)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
