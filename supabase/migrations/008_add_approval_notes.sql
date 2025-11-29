-- CDC-LIMS Phase 4: Add Approval Notes Field
-- Migration 008: Add approval_note column to results table for audit trail

SET search_path TO public;

-- Add approval_note field to results table
ALTER TABLE public.results 
ADD COLUMN IF NOT EXISTS approval_note TEXT;

-- Add index for searching approval notes
CREATE INDEX IF NOT EXISTS idx_results_approval_note 
ON public.results(approval_note) 
WHERE approval_note IS NOT NULL;

-- Update comments
COMMENT ON COLUMN public.results.approval_note IS 'Optional note/reason for approval or revocation. Prefixed with "REVOKED: " when approval is canceled.';

-- Verification query (commented out)
-- SELECT id, status, approved_by, approved_at, approval_note 
-- FROM public.results 
-- WHERE approval_note IS NOT NULL 
-- LIMIT 10;
