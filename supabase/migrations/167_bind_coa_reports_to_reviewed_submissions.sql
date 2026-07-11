-- Migration 167: Bind final CoA reports to reviewed submissions
-- Security Impact: HIGH
-- Changes:
--   - Adds nullable provenance for historic CoA compatibility.
--   - Prevents a populated report source from being changed or cleared.
--   - Adds an authenticated SECURITY DEFINER queue RPC with explicit role,
--     sample-completion, result-approval, snapshot, and row-lock checks.
--   - Removes direct authenticated INSERT access so new reports cannot bypass
--     locked source selection. Existing SELECT and manager UPDATE policies remain.

BEGIN;

SET search_path TO public, extensions;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'coa_reports'
          AND column_name = 'source_submission_id'
    ) THEN
        RAISE EXCEPTION
            'Migration 167 expected coa_reports.source_submission_id to be absent';
    END IF;

    IF to_regprocedure(
        'public.queue_coa_report_for_generation(uuid,integer)'
    ) IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 167 expected queue_coa_report_for_generation(uuid,integer) to be absent';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'trigger_generate_coa_on_approval'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION
            'Migration 167 expected the legacy trigger_generate_coa_on_approval baseline';
    END IF;
END;
$$;

ALTER TABLE public.sample_submissions
ADD CONSTRAINT sample_submissions_id_sample_id_key
UNIQUE (id, sample_id);

ALTER TABLE public.coa_reports
ADD COLUMN source_submission_id UUID;

ALTER TABLE public.coa_reports
ADD CONSTRAINT coa_reports_source_submission_sample_fkey
FOREIGN KEY (source_submission_id, sample_id)
REFERENCES public.sample_submissions (id, sample_id)
ON DELETE RESTRICT;

CREATE INDEX idx_coa_reports_source_submission_id
ON public.coa_reports (source_submission_id)
WHERE source_submission_id IS NOT NULL;

COMMENT ON COLUMN public.coa_reports.source_submission_id
IS 'Immutable reviewed submission that supplied final CoA result and reference-range snapshots. NULL is reserved for historic reports created before migration 167.';

COMMENT ON CONSTRAINT coa_reports_source_submission_sample_fkey
ON public.coa_reports
IS 'Restricts source deletion and guarantees the bound submission belongs to the report sample.';

CREATE OR REPLACE FUNCTION public.prevent_coa_report_source_rebinding()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, extensions
AS $$
BEGIN
    IF TG_OP = 'INSERT' AND NEW.source_submission_id IS NULL THEN
        RAISE EXCEPTION 'New CoA reports require a source submission'
            USING ERRCODE = '23502';
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.source_submission_id IS DISTINCT FROM OLD.source_submission_id THEN
        RAISE EXCEPTION 'CoA report source submission is immutable'
            USING ERRCODE = '55000';
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_coa_report_source_rebinding
ON public.coa_reports;

CREATE TRIGGER prevent_coa_report_source_rebinding
BEFORE INSERT OR UPDATE OF source_submission_id ON public.coa_reports
FOR EACH ROW
EXECUTE FUNCTION public.prevent_coa_report_source_rebinding();

COMMENT ON FUNCTION public.prevent_coa_report_source_rebinding()
IS 'Requires a source for new CoA reports and rejects every later source change; historic NULL rows remain permanently unbound.';

DROP POLICY IF EXISTS "coa_reports_insert_authenticated"
ON public.coa_reports;

REVOKE INSERT, DELETE, TRUNCATE, TRIGGER, REFERENCES
ON TABLE public.coa_reports
FROM authenticated;

COMMENT ON TABLE public.coa_reports
IS 'CoA metadata. New rows must be created through queue_coa_report_for_generation() so source provenance is selected under lock.';

DROP TRIGGER IF EXISTS trigger_generate_coa_on_approval
ON public.samples;

DROP FUNCTION IF EXISTS public.trigger_generate_coa();

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

    IF v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION 'Only analysts and managers may queue CoA reports'
            USING ERRCODE = '42501';
    END IF;

    IF p_version < 1 THEN
        RAISE EXCEPTION 'CoA report version must be positive';
    END IF;

    SELECT status
    INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF v_sample_status IS NULL THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_sample_status <> 'completed' THEN
        RAISE EXCEPTION 'Sample must be completed before final CoA generation';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM public.results
        WHERE sample_id = p_sample_id
          AND status <> 'approved'
    ) THEN
        RAISE EXCEPTION 'All sample results must be approved before final CoA generation';
    END IF;

    SELECT *
    INTO v_report
    FROM public.coa_reports
    WHERE sample_id = p_sample_id
      AND version = p_version
      AND deleted_at IS NULL
    FOR UPDATE;

    IF FOUND THEN
        IF v_report.status = 'failed' THEN
            UPDATE public.coa_reports
            SET status = 'pending',
                error_message = NULL
            WHERE id = v_report.id
            RETURNING *
            INTO v_report;
        END IF;

        RETURN jsonb_build_object(
            'report_id', v_report.id,
            'status', v_report.status,
            'file_path', NULLIF(v_report.file_path, ''),
            'source_submission_id', v_report.source_submission_id
        );
    END IF;

    SELECT submission.id
    INTO v_source_submission_id
    FROM public.sample_submissions AS submission
    WHERE submission.sample_id = p_sample_id
      AND submission.superseded_by IS NULL
    ORDER BY submission.submission_number DESC
    LIMIT 1
    FOR SHARE;

    IF v_source_submission_id IS NULL THEN
        RAISE EXCEPTION 'No active reviewed submission exists for this sample';
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
    WHERE assessment.submission_id = v_source_submission_id;

    IF v_result_count = 0 OR v_snapshot_count <> v_result_count THEN
        RAISE EXCEPTION
            'Reviewed submission snapshots do not match the current sample result set';
    END IF;

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
        p_sample_id,
        v_source_submission_id,
        '',
        '',
        p_version,
        'pending',
        NULL
    )
    RETURNING *
    INTO v_report;

    RETURN jsonb_build_object(
        'report_id', v_report.id,
        'status', v_report.status,
        'file_path', NULL,
        'source_submission_id', v_report.source_submission_id
    );
END;
$$;

COMMENT ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
IS 'Queues one active CoA report under row locks and binds new reports to the completed sample active reviewed submission.';

REVOKE ALL ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
FROM PUBLIC, anon, service_role;

GRANT EXECUTE ON FUNCTION public.queue_coa_report_for_generation(UUID, INTEGER)
TO authenticated;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conrelid = 'public.coa_reports'::regclass
          AND conname = 'coa_reports_source_submission_sample_fkey'
          AND confdeltype = 'r'
    )
    OR NOT EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.coa_reports'::regclass
          AND tgname = 'prevent_coa_report_source_rebinding'
          AND NOT tgisinternal
    )
    OR NOT has_function_privilege(
        'authenticated',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'EXECUTE'
    )
    OR has_function_privilege(
        'anon',
        'public.queue_coa_report_for_generation(uuid,integer)',
        'EXECUTE'
    )
    OR has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'INSERT'
    )
    OR has_table_privilege(
        'authenticated',
        'public.coa_reports',
        'TRUNCATE'
    )
    OR EXISTS (
        SELECT 1
        FROM pg_policy
        WHERE polrelid = 'public.coa_reports'::regclass
          AND polcmd = 'a'
    )
    OR EXISTS (
        SELECT 1
        FROM pg_trigger
        WHERE tgrelid = 'public.samples'::regclass
          AND tgname = 'trigger_generate_coa_on_approval'
          AND NOT tgisinternal
    ) THEN
        RAISE EXCEPTION 'Migration 167 CoA provenance schema verification failed';
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
