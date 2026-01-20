-- Migration 118: Analyst E-Signature Sample Submissions
-- Security Impact: HIGH - Creates audit trail for sample submissions with e-signature linkage
-- 21 CFR Part 11: Implements electronic signature/record linking per §11.50 (signed record components)
-- Changes:
-- 1) Create sample_submissions table with signature linkage and superseded chain
-- 2) Add RLS policies (view: analysts own, managers all; insert: RPC only)
-- 3) Attach audit trigger for 21 CFR Part 11 §11.10(e) compliance
-- 4) Update submit_sample_for_review RPC with signature validation and atomic submission numbering

SET search_path TO public;

-- ============================================================================
-- 1. CREATE sample_submissions TABLE
-- ============================================================================
-- This table maintains an immutable audit trail of analyst sample submissions
-- Each submission records WHO signed (user_id), WHEN (submitted_at), and
-- WHAT they certified (signature_meaning + linked signature_id).
-- Re-submissions create new records and link via superseded_by chain.

CREATE TABLE public.sample_submissions (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Foreign keys (RESTRICT to preserve audit trail integrity)
    sample_id UUID NOT NULL REFERENCES public.samples(id) ON DELETE RESTRICT,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    signature_id UUID NOT NULL REFERENCES public.user_signatures(id) ON DELETE RESTRICT,

    -- Submission metadata
    submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Atomic submission numbering (prevents TOCTOU race conditions)
    -- Calculated via subquery in RPC to ensure uniqueness per sample
    submission_number INTEGER NOT NULL DEFAULT 1,

    -- Re-submission chain tracking
    -- When manager rejects sample → analyst re-submits → new record created
    -- Old record gets superseded_by = new_id to maintain history
    superseded_by UUID REFERENCES public.sample_submissions(id) ON DELETE SET NULL,

    -- 21 CFR Part 11 §11.50(a): Signature meaning requirement
    -- Must capture what the signer is certifying at time of signature
    signature_meaning TEXT NOT NULL DEFAULT 'I certify I performed these tests and entered these results accurately',

    -- Audit timestamp (immutable - no updated_at)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Ensure only one submission per sample per submission_number
    CONSTRAINT unique_sample_submission_number UNIQUE (sample_id, submission_number)
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Fast lookups by sample (CoA generation, submission history)
CREATE INDEX idx_sample_submissions_sample_id
    ON sample_submissions(sample_id);

-- Fast lookups by user (analyst submission history)
CREATE INDEX idx_sample_submissions_user_id
    ON sample_submissions(user_id);

-- Optimized query for latest submission per sample
-- Used in: CoA generation (get performer signature), submission history views
CREATE INDEX idx_sample_submissions_sample_latest
    ON sample_submissions(sample_id, submitted_at DESC);

-- Fast lookups for superseded chain navigation
CREATE INDEX idx_sample_submissions_superseded_by
    ON sample_submissions(superseded_by) WHERE superseded_by IS NOT NULL;

-- ============================================================================
-- 3. TABLE AND COLUMN COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE sample_submissions
IS '21 CFR Part 11 compliant record of analyst sample submissions with e-signature linkage. Immutable audit trail per §11.10(e).';

COMMENT ON COLUMN sample_submissions.signature_meaning
IS 'Legal meaning of signature per 21 CFR Part 11 §11.50(a) - what the signer certifies';

COMMENT ON COLUMN sample_submissions.superseded_by
IS 'Links to newer submission when sample is rejected and re-submitted (forms audit chain)';

COMMENT ON COLUMN sample_submissions.submission_number
IS 'Auto-incremented per sample (1, 2, 3...). Calculated atomically in RPC to prevent race conditions.';

COMMENT ON COLUMN sample_submissions.signature_id
IS 'FK to user_signatures - links submission to exact signature version used (integrity verification)';

-- ============================================================================
-- 4. ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Security model:
-- - SELECT: Analysts see own submissions, managers see all (approval workflow)
-- - INSERT: Only via submit_sample_for_review RPC (controlled workflow)
-- - UPDATE: Only via RPC for superseded_by field (no other columns mutable)
-- - DELETE: Not allowed (immutable audit trail per 21 CFR Part 11)

ALTER TABLE sample_submissions ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Analysts see own, managers see all
DROP POLICY IF EXISTS "Users can view submissions" ON sample_submissions;
CREATE POLICY "Users can view submissions" ON sample_submissions
    FOR SELECT USING (
        -- Analyst sees their own submissions
        user_id = auth.uid()
        -- Manager sees all submissions (approval workflow)
        OR get_user_role() = 'manager'
    );

-- INSERT policy: Deny direct inserts (use RPC only)
DROP POLICY IF EXISTS "Insert via RPC only" ON sample_submissions;
CREATE POLICY "Insert via RPC only" ON sample_submissions
    FOR INSERT WITH CHECK (false);

-- No UPDATE or DELETE policies = implicitly denied (immutable audit trail)
-- Exception: superseded_by field updated via SECURITY DEFINER RPC (bypasses RLS)

COMMENT ON POLICY "Insert via RPC only" ON sample_submissions
IS 'Submissions can only be created via submit_sample_for_review RPC for workflow integrity and signature validation';

-- ============================================================================
-- 5. AUDIT TRIGGER (21 CFR Part 11 §11.10(e) Compliance)
-- ============================================================================
-- Required: Generate audit trail for all changes to electronic signature records
-- Uses existing trigger_audit_log() function (defined in migration 078)

DROP TRIGGER IF EXISTS audit_sample_submissions_trigger ON sample_submissions;
CREATE TRIGGER audit_sample_submissions_trigger
    AFTER INSERT OR UPDATE OR DELETE ON sample_submissions
    FOR EACH ROW EXECUTE FUNCTION trigger_audit_log();

COMMENT ON TRIGGER audit_sample_submissions_trigger ON sample_submissions
IS '21 CFR Part 11 §11.10(e): Generate complete audit trail for all electronic signature events (who, what, when)';

-- ============================================================================
-- 6. UPDATE submit_sample_for_review RPC (Enhanced with E-Signature)
-- ============================================================================
-- CRITICAL CHANGES from migration 062:
-- 1. Signature validation: Check analyst has active signature before submission
-- 2. Signature integrity check: Verify signature_hash exists (not null/empty)
-- 3. Atomic submission numbering: Use subquery in INSERT to prevent race conditions
-- 4. Submission record creation: Link sample → user → signature
-- 5. Superseded chain tracking: Mark previous submission as superseded (re-submission flow)
-- 6. Vietnamese error messages: E4001 (no signature), E4002 (invalid signature)

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
    -- ========================================
    -- PHASE 1: AUTHENTICATION & AUTHORIZATION
    -- ========================================

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    -- Get user role from users table (not auth.jwt() - more reliable)
    SELECT role INTO v_user_role FROM public.users WHERE id = v_user_id;

    IF v_user_role IS NULL OR v_user_role != 'analyst' THEN
        RAISE EXCEPTION 'Only analysts can submit samples for review';
    END IF;

    -- ========================================
    -- PHASE 2: E-SIGNATURE VALIDATION (21 CFR Part 11)
    -- ========================================

    -- Check analyst has active signature uploaded
    SELECT id, signature_hash
    INTO v_signature_id, v_signature_hash
    FROM public.user_signatures
    WHERE user_id = v_user_id
      AND is_active = true
      AND deleted_at IS NULL;

    IF v_signature_id IS NULL THEN
        RAISE EXCEPTION 'E4001: Bạn cần tải lên chữ ký điện tử trước khi gửi duyệt. Vào trang Hồ sơ để tải lên chữ ký.';
    END IF;

    -- Verify signature integrity (hash must exist)
    IF v_signature_hash IS NULL OR v_signature_hash = '' THEN
        RAISE EXCEPTION 'E4002: Chữ ký không hợp lệ. Vui lòng tải lên lại chữ ký mới.';
    END IF;

    -- ========================================
    -- PHASE 3: SAMPLE VALIDATION
    -- ========================================

    -- Lock sample row to prevent concurrent status transitions
    SELECT status
    INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_sample_status != 'in_progress' THEN
        RAISE EXCEPTION 'Sample must be in progress to submit for review';
    END IF;

    -- Check sample has assigned tests
    IF NOT EXISTS (
        SELECT 1 FROM public.results WHERE sample_id = p_sample_id
    ) THEN
        RAISE EXCEPTION 'Cannot submit sample with no assigned tests';
    END IF;

    -- Check all results have values (no missing data)
    SELECT COUNT(*) INTO v_missing_count
    FROM public.results
    WHERE sample_id = p_sample_id
      AND (value IS NULL OR value = '');

    IF v_missing_count > 0 THEN
        RAISE EXCEPTION 'All tests must have results before submitting';
    END IF;

    -- ========================================
    -- PHASE 4: CREATE SUBMISSION RECORD (ATOMIC)
    -- ========================================

    -- Get previous submission ID for superseded_by chain
    -- (handles re-submission after manager rejection)
    SELECT id INTO v_previous_submission_id
    FROM public.sample_submissions
    WHERE sample_id = p_sample_id
      AND superseded_by IS NULL
    ORDER BY submission_number DESC
    LIMIT 1;

    -- Atomic INSERT with subquery to prevent TOCTOU race condition
    -- CRITICAL: submission_number calculated in subquery ensures uniqueness
    -- even with concurrent submissions (prevents duplicate submission_number)
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
        -- Atomic calculation: MAX(existing) + 1, or 1 if first submission
        (SELECT COALESCE(MAX(submission_number), 0) + 1
         FROM public.sample_submissions
         WHERE sample_id = p_sample_id),
        'I certify I performed these tests and entered these results accurately'
    )
    RETURNING id, submission_number INTO v_submission_id, v_submission_number;

    -- Mark previous submission as superseded (if re-submitting)
    -- This creates the audit chain: submission_1 → submission_2 → submission_3
    IF v_previous_submission_id IS NOT NULL THEN
        UPDATE public.sample_submissions
        SET superseded_by = v_submission_id
        WHERE id = v_previous_submission_id;
    END IF;

    -- ========================================
    -- PHASE 5: UPDATE SAMPLE STATUS
    -- ========================================

    UPDATE public.samples
    SET status = 'review',
        updated_at = NOW()
    WHERE id = p_sample_id;

    -- Return success with submission details
    RETURN jsonb_build_object(
        'sample_id', p_sample_id,
        'new_status', 'review',
        'submission_id', v_submission_id,
        'signature_id', v_signature_id,
        'submission_number', v_submission_number
    );
END;
$$;

-- Grant execute permission to authenticated users
REVOKE ALL ON FUNCTION public.submit_sample_for_review(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_sample_for_review(UUID) TO authenticated;

COMMENT ON FUNCTION public.submit_sample_for_review(UUID)
IS 'Transitions sample from in_progress to review with 21 CFR Part 11 compliant e-signature capture. Validates signature exists and creates immutable submission record.';

-- ============================================================================
-- 7. VERIFICATION (Self-Test)
-- ============================================================================
-- Verify critical components created successfully

DO $$
DECLARE
    v_table_exists BOOLEAN;
    v_trigger_exists BOOLEAN;
    v_rpc_exists BOOLEAN;
    v_column_count INTEGER;
BEGIN
    -- Verify table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'sample_submissions'
    ) INTO v_table_exists;

    IF NOT v_table_exists THEN
        RAISE EXCEPTION 'MIGRATION FAILED: sample_submissions table not created';
    END IF;

    -- Verify all required columns exist (9 columns expected)
    SELECT COUNT(*) INTO v_column_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sample_submissions';

    IF v_column_count < 9 THEN
        RAISE EXCEPTION 'MIGRATION FAILED: sample_submissions missing columns (expected 9, got %)', v_column_count;
    END IF;

    -- Verify audit trigger exists (21 CFR Part 11 requirement)
    SELECT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'audit_sample_submissions_trigger'
    ) INTO v_trigger_exists;

    IF NOT v_trigger_exists THEN
        RAISE EXCEPTION 'MIGRATION FAILED: Audit trigger not created - 21 CFR Part 11 §11.10(e) violation';
    END IF;

    -- Verify RPC function exists with correct signature
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
          AND p.proname = 'submit_sample_for_review'
          AND p.pronargs = 1  -- Expects 1 argument (p_sample_id UUID)
    ) INTO v_rpc_exists;

    IF NOT v_rpc_exists THEN
        RAISE EXCEPTION 'MIGRATION FAILED: submit_sample_for_review RPC not created or has wrong signature';
    END IF;

    RAISE NOTICE 'Migration 118 verification passed: table (% columns), trigger, RPC all created successfully', v_column_count;
END $$;

-- ============================================================================
-- 8. REFRESH POSTGREST SCHEMA CACHE
-- ============================================================================
-- Critical: Make new RPC immediately callable via REST API

NOTIFY pgrst, 'reload schema';
