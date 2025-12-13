-- Migration 016: Fix results insert policy to reference results.sample_id
-- Ensures analysts can insert pending results only for samples they received

SET search_path TO public;

-- Drop incorrect policy if present (uuid = text mismatch)
DROP POLICY IF EXISTS "Analysts can insert results for own samples" ON public.results;

-- Recreate policy with explicit table-qualified column reference
CREATE POLICY "Analysts can insert results for own samples"
ON public.results FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.samples s
        WHERE s.id = public.results.sample_id
          AND s.received_by = auth.uid()
          AND s.deleted_at IS NULL
    )
);
