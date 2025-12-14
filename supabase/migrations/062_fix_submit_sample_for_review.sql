-- Migration 062: Fix submit-sample-for-review flow
-- Security Impact: Medium (adds SECURITY DEFINER RPC for controlled status transition; fixes broken trigger)
-- Changes:
-- 1) Fix public.trigger_generate_coa() to avoid invalid enum cast and to queue on status='completed'
-- 2) Add public.submit_sample_for_review(p_sample_id uuid) RPC to transition in_progress -> review for analysts

SET search_path TO public;

-- ============================================================================
-- 1) Fix CoA trigger (was comparing to non-existent sample_status 'approved')
-- ============================================================================

CREATE OR REPLACE FUNCTION public.trigger_generate_coa()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
    -- Only generate CoA when sample status changes to 'completed'
    -- and no existing CoA record exists for this sample
    IF NEW.status = 'completed'
       AND (OLD.status IS NULL OR OLD.status != 'completed')
       AND NOT EXISTS (
           SELECT 1 FROM public.coa_reports
           WHERE sample_id = NEW.id
             AND deleted_at IS NULL
       )
    THEN
        -- Insert pending CoA record
        -- Server action will pick this up and generate HTML
        INSERT INTO public.coa_reports (
            sample_id,
            file_path,
            file_hash,
            version,
            status
        ) VALUES (
            NEW.id,
            '', -- Will be populated by server action
            '', -- Will be populated by server action
            1,
            'pending'
        );
    END IF;

    RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.trigger_generate_coa()
IS 'Queues CoA generation when sample status changes to completed (server action will process)';

-- ============================================================================
-- 2) Submit sample for manager review (analyst workflow)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.submit_sample_for_review(
    p_sample_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_role := get_user_role();
    v_sample_status sample_status;
    v_missing_count INTEGER := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_user_role IS NULL OR v_user_role != 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can submit samples for review';
    END IF;

    -- Lock the sample row to avoid concurrent status transitions
    SELECT status
    INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_sample_status != 'in_progress' THEN
        RAISE EXCEPTION 'Sample must be in progress to submit for review';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.results
        WHERE sample_id = p_sample_id
    ) THEN
        RAISE EXCEPTION 'Cannot submit sample with no assigned tests';
    END IF;

    SELECT COUNT(*) INTO v_missing_count
    FROM public.results
    WHERE sample_id = p_sample_id
      AND (value IS NULL OR value = '');

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'All tests must have results before submitting';
    END IF;

    UPDATE public.samples
    SET status = 'review',
        updated_at = NOW()
    WHERE id = p_sample_id;

    RETURN jsonb_build_object(
        'sample_id', p_sample_id,
        'new_status', 'review'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_sample_for_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sample_for_review(UUID) TO authenticated;

COMMENT ON FUNCTION public.submit_sample_for_review(UUID)
IS 'Transitions sample status from in_progress to review after verifying all assigned results have values (analyst-only).';

-- Refresh PostgREST schema cache so new RPC is callable immediately
NOTIFY pgrst, 'reload schema';
