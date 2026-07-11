-- Migration 184: Stage wall-clock CoA completion CAS
-- Security Impact: High
-- Changes:
--   - Locks the claimed report before evaluating lease freshness.
--   - Uses the canonical lease duration and wall-clock event timestamps.
--   - Preserves approval revalidation and active signature enforcement.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_complete_source TEXT;
BEGIN
    IF to_regprocedure(
        'public.complete_coa_report_generation_wall_clock(uuid,uuid,text,text,uuid)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.coa_generation_lease_duration()'
       ) IS NULL THEN
        RAISE EXCEPTION
            'Migration 184 found an unexpected staged lease baseline';
    END IF;

    SELECT prosrc
    INTO v_complete_source
    FROM pg_proc
    WHERE oid =
        'public.complete_coa_report_generation(uuid,uuid,text,text,uuid)'::regprocedure;

    IF encode(public.digest(v_complete_source, 'sha256'::TEXT), 'hex') <>
       '6af22a1eb181b25ca3ee2b687fca1989a5944c994b41d84800d8c9c8fbfd76db'
    THEN
        RAISE EXCEPTION
            'Migration 184 found an unexpected CoA completion baseline';
    END IF;
END;
$$;

CREATE FUNCTION public.complete_coa_report_generation_wall_clock(
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
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND
       OR v_report.generation_claimed_at IS NULL
       OR v_report.generation_claimed_at <=
           clock_timestamp()
           - public.coa_generation_lease_duration() THEN
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
        generated_at = clock_timestamp(),
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

COMMENT ON FUNCTION
public.complete_coa_report_generation_wall_clock(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
)
IS 'Staged wall-clock CoA completion CAS implementation.';

REVOKE ALL ON FUNCTION
public.complete_coa_report_generation_wall_clock(
    UUID,
    UUID,
    TEXT,
    TEXT,
    UUID
)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
