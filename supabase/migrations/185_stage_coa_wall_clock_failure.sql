-- Migration 185: Stage wall-clock CoA failure CAS
-- Security Impact: High
-- Changes:
--   - Locks the claimed report before evaluating lease freshness.
--   - Uses the canonical lease duration for failure ownership.
--   - Preserves explicit ready-artifact restoration rules.

BEGIN;

SET LOCAL search_path TO public, extensions;

DO $$
DECLARE
    v_fail_source TEXT;
BEGIN
    IF to_regprocedure(
        'public.fail_coa_report_generation_wall_clock(uuid,uuid,text,boolean)'
    ) IS NOT NULL
       OR to_regprocedure(
           'public.coa_generation_lease_duration()'
       ) IS NULL THEN
        RAISE EXCEPTION
            'Migration 185 found an unexpected staged lease baseline';
    END IF;

    SELECT prosrc
    INTO v_fail_source
    FROM pg_proc
    WHERE oid =
        'public.fail_coa_report_generation(uuid,uuid,text,boolean)'::regprocedure;

    IF encode(public.digest(v_fail_source, 'sha256'::TEXT), 'hex') <>
       'e1e0b00c0883dbf4e43afa565634c8001ded7ddc260c81efb818b9ad959e03a4'
    THEN
        RAISE EXCEPTION
            'Migration 185 found an unexpected CoA failure baseline';
    END IF;
END;
$$;

CREATE FUNCTION public.fail_coa_report_generation_wall_clock(
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
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND
       OR v_report.generation_claimed_at IS NULL
       OR v_report.generation_claimed_at <=
           clock_timestamp()
           - public.coa_generation_lease_duration() THEN
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

COMMENT ON FUNCTION
public.fail_coa_report_generation_wall_clock(UUID, UUID, TEXT, BOOLEAN)
IS 'Staged wall-clock CoA failure CAS implementation.';

REVOKE ALL ON FUNCTION
public.fail_coa_report_generation_wall_clock(UUID, UUID, TEXT, BOOLEAN)
FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
