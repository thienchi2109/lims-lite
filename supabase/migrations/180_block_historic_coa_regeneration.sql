-- Migration 180: Block provenance-free historic CoA regeneration
-- Security Impact: High
-- Changes:
--   - Refuses regeneration claims for reports without source_submission_id.
--   - Preserves historic ready/failed artifact metadata without mutation.
--   - Returns a structured blocked reason for localized application errors.
--   - Extends the registered CoA security checker with the new guard contract.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_regeneration_source TEXT;
    v_checker_source TEXT;
BEGIN
    SELECT prosrc
    INTO v_regeneration_source
    FROM pg_proc
    WHERE oid =
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure;

    SELECT prosrc
    INTO v_checker_source
    FROM pg_proc
    WHERE oid = 'public.test_coa_report_provenance_guard()'::regprocedure;

    IF encode(
        public.digest(v_regeneration_source, 'sha256'::TEXT),
        'hex'
    ) <> 'da5c0d963242924c87b9788d6dd28f6db0528eb4f73ca2ca052508c07f91fc92'
       OR encode(
           public.digest(v_checker_source, 'sha256'::TEXT),
           'hex'
       ) <> '9ca2a346eee1abf6e54b31129122d0954e04c7177338f4590671db25878d0984'
    THEN
        RAISE EXCEPTION
            'Migration 180 found an unexpected CoA regeneration baseline';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_coa_report_regeneration(
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
        generation_claimed_at = NOW(),
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

CREATE OR REPLACE FUNCTION public.test_coa_report_provenance_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_queue_source TEXT;
    v_regeneration_definition TEXT;
    v_complete_definition TEXT;
BEGIN
    SELECT prosrc
    INTO v_queue_source
    FROM pg_proc
    WHERE oid =
        'public.queue_coa_report_for_generation(uuid,integer)'::regprocedure;

    SELECT pg_get_functiondef(
        'public.claim_coa_report_regeneration(uuid,integer)'::regprocedure
    )
    INTO v_regeneration_definition;

    SELECT pg_get_functiondef(
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure
    )
    INTO v_complete_definition;

    RETURN public.test_coa_report_provenance_guard_claim_baseline()
        AND COALESCE(
            encode(
                public.digest(v_queue_source, 'sha256'::TEXT),
                'hex'
            ) =
            'c919145d29b73e3e37a8bb23f1e8ad03c7618251d83e94009f9a3bdb54a7c474',
            FALSE
        )
        AND v_regeneration_definition ILIKE
            '%IF v_report.source_submission_id IS NULL%'
        AND v_regeneration_definition ILIKE
            '%HISTORIC_REPORT_WITHOUT_SOURCE%'
        AND v_regeneration_definition ILIKE
            '%public.user_can_access_confidential()%'
        AND v_regeneration_definition ILIKE
            '%generation_claimed_at >%15 minutes%'
        AND STRPOS(
            LOWER(v_regeneration_definition),
            'if v_report.source_submission_id is null'
        ) < STRPOS(
            LOWER(v_regeneration_definition),
            'v_claim_id := gen_random_uuid()'
        )
        AND v_complete_definition ILIKE '%FROM public.samples%'
        AND v_complete_definition ILIKE '%FOR UPDATE%'
        AND v_complete_definition ILIKE
            '%v_sample_status IS DISTINCT FROM ''completed''%'
        AND v_complete_definition ILIKE
            '%NOT EXISTS%FROM public.results%'
        AND v_complete_definition ILIKE
            '%result.status <> ''approved''%'
        AND v_complete_definition ILIKE
            '%v_report.generation_previous_status = ''ready''%'
        AND v_complete_definition ILIKE
            '%Sample approval changed before CoA completion%'
        AND v_complete_definition ILIKE '%generation_claim_id = NULL%'
        AND v_complete_definition ILIKE '%generation_claimed_by = NULL%'
        AND v_complete_definition ILIKE '%generation_claimed_at = NULL%'
        AND v_complete_definition ILIKE
            '%generation_previous_status = NULL%';
END;
$$;

COMMENT ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
IS 'Claims manager regeneration only for reports bound to immutable reviewed submissions.';

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates CoA provenance, claims, confidential access, approval revalidation, and historic regeneration blocking.';

REVOKE ALL ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.test_coa_report_provenance_guard()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_report_provenance_guard()
TO authenticated;

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard() THEN
        RAISE EXCEPTION
            'Migration 180 historic CoA regeneration verification failed';
    END IF;
END;
$$;

COMMIT;
