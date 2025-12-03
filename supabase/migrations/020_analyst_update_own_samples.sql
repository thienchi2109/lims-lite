-- Migration 020: Allow analysts to update their own samples (status to assigned)

SET search_path TO public;

-- Allow analysts to update samples they received (needed for accession_and_assign_tests)
CREATE POLICY IF NOT EXISTS "Analysts can update own samples"
ON public.samples FOR UPDATE
USING (
    get_user_role() = 'analyst'
    AND received_by = auth.uid()
    AND deleted_at IS NULL
)
WITH CHECK (
    get_user_role() = 'analyst'
    AND received_by = auth.uid()
    AND deleted_at IS NULL
);
