-- Migration 179: Revalidate sample approval before completing CoA generation
-- Security Impact: High
-- Changes:
--   - Locks and revalidates the sample before publishing a claimed CoA.
--   - Fails closed when the sample or any result is no longer approved.
--   - Clears stale claims while preserving the previous ready artifact.
--   - Extends the registered CoA security checker with this contract.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_complete_source TEXT;
    v_checker_source TEXT;
BEGIN
    IF to_regprocedure(
        'public.test_coa_report_provenance_guard_approval_revalidation_baseline()'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 179 expected the approval revalidation baseline to be absent';
    END IF;

    SELECT prosrc
    INTO v_complete_source
    FROM pg_proc
    WHERE oid =
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure;

    SELECT prosrc
    INTO v_checker_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_report_provenance_guard()'::regprocedure;

    IF encode(public.digest(v_complete_source, 'sha256'::TEXT), 'hex') <>
       'c583dc0b80df29163a472d74e5123046c6b7dc1015d505f3aeb40fdaa9bdd91a'
       OR encode(public.digest(v_checker_source, 'sha256'::TEXT), 'hex') <>
       'd3f3978ebb57ba9e658ff22af4a5a81ebee7c972c803f0b63cb8a74da842ca31'
    THEN
        RAISE EXCEPTION
            'Migration 179 found an unexpected CoA completion baseline';
    END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_coa_report_generation(
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
    v_sample_status public.sample_status;
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

    SELECT sample.status
    INTO v_sample_status
    FROM public.samples AS sample
    WHERE sample.id = v_report.sample_id
      AND sample.deleted_at IS NULL
    FOR UPDATE;

    IF v_sample_status IS DISTINCT FROM 'completed'
       OR NOT EXISTS (
           SELECT 1
           FROM public.results AS result
           WHERE result.sample_id = v_report.sample_id
       )
       OR EXISTS (
           SELECT 1
           FROM public.results AS result
           WHERE result.sample_id = v_report.sample_id
             AND result.status <> 'approved'
       ) THEN
        UPDATE public.coa_reports
        SET status = CASE
                WHEN v_report.generation_previous_status = 'ready'
                    THEN 'ready'
                ELSE 'failed'
            END,
            error_message = CASE
                WHEN v_report.generation_previous_status = 'ready'
                    THEN NULL
                ELSE 'Sample approval changed before CoA completion'
            END,
            generation_claim_id = NULL,
            generation_claimed_by = NULL,
            generation_claimed_at = NULL,
            generation_previous_status = NULL
        WHERE id = v_report.id;

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

ALTER FUNCTION public.test_coa_report_provenance_guard()
RENAME TO test_coa_report_provenance_guard_approval_revalidation_baseline;

CREATE FUNCTION public.test_coa_report_provenance_guard()
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SET search_path = public, extensions
AS $$
DECLARE
    v_baseline_source TEXT;
    v_complete_source TEXT;
BEGIN
    SELECT prosrc
    INTO v_baseline_source
    FROM pg_proc
    WHERE oid =
        'public.test_coa_report_provenance_guard_approval_revalidation_baseline()'::regprocedure;

    SELECT pg_get_functiondef(
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure
    )
    INTO v_complete_source;

    RETURN
        public.test_coa_report_provenance_guard_approval_revalidation_baseline()
        AND COALESCE(
            encode(
                public.digest(v_baseline_source, 'sha256'::TEXT),
                'hex'
            ) =
            'd3f3978ebb57ba9e658ff22af4a5a81ebee7c972c803f0b63cb8a74da842ca31',
            FALSE
        )
        AND v_complete_source ILIKE '%FROM public.samples%'
        AND v_complete_source ILIKE '%FOR UPDATE%'
        AND v_complete_source ILIKE
            '%v_sample_status IS DISTINCT FROM ''completed''%'
        AND v_complete_source ILIKE '%NOT EXISTS%FROM public.results%'
        AND v_complete_source ILIKE '%result.status <> ''approved''%'
        AND v_complete_source ILIKE
            '%v_report.generation_previous_status = ''ready''%'
        AND v_complete_source ILIKE
            '%Sample approval changed before CoA completion%'
        AND v_complete_source ILIKE '%generation_claim_id = NULL%'
        AND v_complete_source ILIKE '%generation_claimed_by = NULL%'
        AND v_complete_source ILIKE '%generation_claimed_at = NULL%'
        AND v_complete_source ILIKE '%generation_previous_status = NULL%'
        AND STRPOS(
            LOWER(v_complete_source),
            'from public.coa_reports'
        ) < STRPOS(
            LOWER(v_complete_source),
            'from public.samples'
        )
        AND STRPOS(
            LOWER(v_complete_source),
            'from public.samples'
        ) < STRPOS(
            LOWER(v_complete_source),
            'from public.results'
        );
END;
$$;

COMMENT ON FUNCTION public.complete_coa_report_generation(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
)
IS 'Completes a claimed CoA only while its sample and every result remain approved.';

COMMENT ON FUNCTION public.test_coa_report_provenance_guard()
IS 'Validates CoA provenance, claims, confidential access, and completion approval revalidation.';

REVOKE ALL ON FUNCTION public.complete_coa_report_generation(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
) FROM PUBLIC, anon, service_role;
REVOKE ALL ON FUNCTION public.test_coa_report_provenance_guard()
FROM PUBLIC;
REVOKE ALL ON FUNCTION
public.test_coa_report_provenance_guard_approval_revalidation_baseline()
FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.complete_coa_report_generation(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_coa_report_provenance_guard()
TO authenticated;
GRANT EXECUTE ON FUNCTION
public.test_coa_report_provenance_guard_approval_revalidation_baseline()
TO authenticated;

DO $$
BEGIN
    IF NOT public.test_coa_report_provenance_guard() THEN
        RAISE EXCEPTION
            'Migration 179 CoA approval revalidation verification failed';
    END IF;
END;
$$;

COMMIT;
