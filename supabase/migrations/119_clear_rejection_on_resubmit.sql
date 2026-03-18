-- Migration 119: Clear stale rejection metadata on re-submit lifecycle
-- Security Impact: Medium (RPC behavior fix + data cleanup; no policy/RLS changes)
-- 21 CFR Part 11: Preserve rejection history in audit_logs; remove stale rejection fields from active sample row state
-- Changes:
-- 1) Update submit_sample_for_review RPC to clear rejection metadata on successful submit/re-submit
-- 2) Backfill existing review/completed rows with stale rejection metadata
-- 3) Add self-verification block that fails loudly if stale metadata remains

SET search_path TO public;

-- ============================================================================
-- 1. UPDATE submit_sample_for_review RPC
-- ============================================================================
-- Behavior fix:
-- - When analyst successfully submits/re-submits sample for review, clear
--   rejection metadata from the live samples row.
-- - Historical rejection events remain preserved in audit_logs.

CREATE OR REPLACE FUNCTION public.submit_sample_for_review(p_sample_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role user_role;
    v_sample_status sample_status;
    v_signature_id UUID;
    v_signature_hash TEXT;
    v_submission_id UUID;
    v_submission_number INTEGER;
    v_missing_count INTEGER := 0;
    v_previous_submission_id UUID;
BEGIN
    -- Authentication and authorization
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

    IF v_user_role IS NULL OR v_user_role != 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can submit samples for review';
    END IF;

    -- E-signature validation
    SELECT id, signature_hash
    INTO v_signature_id, v_signature_hash
    FROM public.user_signatures
    WHERE user_id = v_user_id
      AND is_active = true
      AND deleted_at IS NULL;

    IF v_signature_id IS NULL THEN
        RAISE EXCEPTION 'E4001: Bạn cần tải lên chữ ký điện tử trước khi gửi duyệt. Vào trang Hồ sơ để tải lên chữ ký.';
    END IF;

    IF v_signature_hash IS NULL OR v_signature_hash = '' THEN
        RAISE EXCEPTION 'E4002: Chữ ký không hợp lệ. Vui lòng tải lên lại chữ ký mới.';
    END IF;

    -- Sample validation
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

    -- Submission record creation
    SELECT id INTO v_previous_submission_id
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
    ) VALUES (
        p_sample_id,
        v_user_id,
        v_signature_id,
        (SELECT COALESCE(MAX(submission_number), 0) + 1
         FROM public.sample_submissions
         WHERE sample_id = p_sample_id),
        'I certify I performed these tests and entered these results accurately'
    )
    RETURNING id, submission_number INTO v_submission_id, v_submission_number;

    IF v_previous_submission_id IS NOT NULL THEN
        UPDATE public.sample_submissions
        SET superseded_by = v_submission_id
        WHERE id = v_previous_submission_id;
    END IF;

    -- Lifecycle fix: successful submit/re-submit clears rejection metadata
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
        'submission_number', v_submission_number
    );
END;
$$;

COMMENT ON FUNCTION public.submit_sample_for_review(UUID)
IS 'Transitions sample from in_progress to review with e-signature capture and clears stale rejection metadata on successful submit/re-submit. Rejection history remains in audit_logs.';

-- ============================================================================
-- 2. ONE-TIME BACKFILL: clear stale rejection metadata
-- ============================================================================
-- Scope-limited cleanup:
-- - review rows should not carry old rejection metadata after re-submit
-- - completed rows should not carry old rejection metadata after approval
-- - discarded rows are intentionally untouched

UPDATE public.samples
SET rejection_reason = NULL,
    rejected_at = NULL,
    rejected_by = NULL,
    updated_at = NOW()
WHERE deleted_at IS NULL
  AND status IN ('review', 'completed')
  AND (
      rejection_reason IS NOT NULL
      OR rejected_at IS NOT NULL
      OR rejected_by IS NOT NULL
  );

-- ============================================================================
-- 3. REGRESSION PROTECTION: self-verification block
-- ============================================================================
-- Fail loudly if any stale rejection metadata remains for review/completed rows.

DO $$
DECLARE
    v_review_stale_count INTEGER;
    v_completed_stale_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_review_stale_count
    FROM public.samples
    WHERE deleted_at IS NULL
      AND status = 'review'
      AND (
          rejection_reason IS NOT NULL
          OR rejected_at IS NOT NULL
          OR rejected_by IS NOT NULL
      );

    IF v_review_stale_count > 0 THEN
        RAISE EXCEPTION
            'MIGRATION FAILED: stale rejection metadata remains on review samples (% rows)',
            v_review_stale_count;
    END IF;

    SELECT COUNT(*) INTO v_completed_stale_count
    FROM public.samples
    WHERE deleted_at IS NULL
      AND status = 'completed'
      AND (
          rejection_reason IS NOT NULL
          OR rejected_at IS NOT NULL
          OR rejected_by IS NOT NULL
      );

    IF v_completed_stale_count > 0 THEN
        RAISE EXCEPTION
            'MIGRATION FAILED: stale rejection metadata remains on completed samples (% rows)',
            v_completed_stale_count;
    END IF;

    RAISE NOTICE
        'Migration 119 verification passed: no stale rejection metadata on review or completed samples';
END $$;

NOTIFY pgrst, 'reload schema';
