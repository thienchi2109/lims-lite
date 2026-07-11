-- Migration 172: Move CoA generation state transitions behind claim-bound RPCs
-- Security Impact: High. Authenticated users lose direct UPDATE on coa_reports.
-- Only the worker owning an unpredictable generation claim can complete or
-- fail a report, and only managers can claim regeneration.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'generation_claim_id'
    ) THEN
        RAISE EXCEPTION
            'Migration 172 requires migration 171 generation claims';
    END IF;

    IF to_regprocedure(
        'public.claim_coa_report_regeneration(uuid,integer)'
    ) IS NOT NULL
    OR to_regprocedure(
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'
    ) IS NOT NULL
    OR to_regprocedure(
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 172 expected CoA transition RPCs to be absent';
    END IF;
END;
$$;

CREATE FUNCTION public.claim_coa_report_regeneration(
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

    IF v_report.source_submission_id IS NOT NULL THEN
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

CREATE FUNCTION public.complete_coa_report_generation(
    p_report_id UUID,
    p_generation_claim_id UUID,
    p_file_path TEXT,
    p_file_hash TEXT,
    p_signature_id UUID
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
    v_approver_id UUID;
BEGIN
    SELECT role
    INTO v_user_role
    FROM public.users
    WHERE id = v_user_id
      AND deleted_at IS NULL;

    IF v_user_id IS NULL
       OR v_user_role IS NULL
       OR v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION
            'Only the active generation worker may complete a CoA report'
            USING ERRCODE = '42501';
    END IF;

    IF NULLIF(BTRIM(p_file_path), '') IS NULL
       OR NULLIF(BTRIM(p_file_hash), '') IS NULL THEN
        RAISE EXCEPTION 'Ready CoA reports require file path and hash';
    END IF;

    SELECT *
    INTO v_report
    FROM public.coa_reports
    WHERE id = p_report_id
      AND status = 'pending'
      AND generation_claim_id = p_generation_claim_id
      AND generation_claimed_by = v_user_id
      AND generation_claimed_at > NOW() - INTERVAL '15 minutes'
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    IF p_signature_id IS NULL THEN
        RAISE EXCEPTION
            'Ready CoA reports require the active sample approver signature'
            USING ERRCODE = '22023';
    END IF;

    SELECT result.approved_by
    INTO v_approver_id
    FROM public.results AS result
    WHERE result.sample_id = v_report.sample_id
      AND result.status = 'approved'
      AND result.approved_by IS NOT NULL
    ORDER BY result.approved_at DESC NULLS LAST, result.id DESC
    LIMIT 1;

    IF v_approver_id IS NULL
       OR NOT EXISTS (
           SELECT 1
           FROM public.user_signatures AS signature
           WHERE signature.id = p_signature_id
             AND signature.user_id = v_approver_id
             AND signature.is_active
             AND signature.deleted_at IS NULL
       ) THEN
        RAISE EXCEPTION
            'CoA signature must be active and belong to the sample approver'
            USING ERRCODE = '22023';
    END IF;

    UPDATE public.coa_reports
    SET file_path = p_file_path,
        file_hash = p_file_hash,
        signature_id = p_signature_id,
        status = 'ready',
        error_message = NULL,
        generated_at = NOW(),
        generation_claim_id = NULL,
        generation_claimed_by = NULL,
        generation_claimed_at = NULL,
        generation_previous_status = NULL
    WHERE id = v_report.id;

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'previous_file_path', NULLIF(v_report.file_path, '')
    );
END;
$$;

CREATE FUNCTION public.fail_coa_report_generation(
    p_report_id UUID,
    p_generation_claim_id UUID,
    p_error_message TEXT,
    p_restore_ready BOOLEAN DEFAULT FALSE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role public.user_role;
    v_report public.coa_reports%ROWTYPE;
BEGIN
    SELECT role
    INTO v_user_role
    FROM public.users
    WHERE id = v_user_id
      AND deleted_at IS NULL;

    IF v_user_id IS NULL
       OR v_user_role IS NULL
       OR v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION
            'Only the active generation worker may fail a CoA report'
            USING ERRCODE = '42501';
    END IF;

    SELECT *
    INTO v_report
    FROM public.coa_reports
    WHERE id = p_report_id
      AND status = 'pending'
      AND generation_claim_id = p_generation_claim_id
      AND generation_claimed_by = v_user_id
      AND generation_claimed_at > NOW() - INTERVAL '15 minutes'
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    IF p_restore_ready IS NULL THEN
        RAISE EXCEPTION
            'CoA failure transition requires an explicit restoration decision'
            USING ERRCODE = '22023';
    END IF;

    IF p_restore_ready
       AND (
           v_report.generation_previous_status IS DISTINCT FROM 'ready'
           OR
           NULLIF(v_report.file_path, '') IS NULL
           OR NULLIF(v_report.file_hash, '') IS NULL
       ) THEN
        RAISE EXCEPTION
            'Cannot restore a CoA report without its previous file metadata';
    END IF;

    IF NOT p_restore_ready
       AND v_report.generation_previous_status = 'ready' THEN
        RAISE EXCEPTION
            'Ready regeneration failures must restore the previous report';
    END IF;

    UPDATE public.coa_reports
    SET status = CASE
            WHEN p_restore_ready THEN 'ready'
            ELSE 'failed'
        END,
        error_message = CASE
            WHEN p_restore_ready THEN NULL
            ELSE COALESCE(
                NULLIF(BTRIM(p_error_message), ''),
                'CoA generation failed'
            )
        END,
        generation_claim_id = NULL,
        generation_claimed_by = NULL,
        generation_claimed_at = NULL,
        generation_previous_status = NULL
    WHERE id = v_report.id;

    RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
IS 'Atomically grants one manager a new or expired 15-minute CoA regeneration lease.';

COMMENT ON FUNCTION public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
IS 'Completes a claimed CoA with the active signature of its latest result approver.';

COMMENT ON FUNCTION public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
IS 'Fails or restores a pending CoA only when the caller owns its generation claim.';

REVOKE ALL ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.claim_coa_report_regeneration(UUID, INTEGER)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_coa_report_generation(UUID, UUID, TEXT, TEXT, UUID)
TO authenticated;
GRANT EXECUTE ON FUNCTION public.fail_coa_report_generation(UUID, UUID, TEXT, BOOLEAN)
TO authenticated;

REVOKE UPDATE ON TABLE public.coa_reports FROM authenticated;

COMMIT;
