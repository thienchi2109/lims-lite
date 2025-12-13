-- Migration 032: Restrict result editing for samples under review
-- Description: Prevents analysts from editing results when the sample status is 'review' or 'completed'.
-- Security Impact: High - Enforces workflow integrity.

SET search_path TO public;

-- Drop old policy if it exists (renaming or replacing)
DROP POLICY IF EXISTS "Analysts can update pending results" ON public.results;
DROP POLICY IF EXISTS "Analysts can update non-review results" ON public.results;

-- Create new policy
CREATE POLICY "Analysts can update non-review results"
ON public.results FOR UPDATE
USING (
    auth.uid() IS NOT NULL AND
    status != 'approved' AND
    (SELECT status FROM public.samples WHERE id = results.sample_id) 
        NOT IN ('review', 'completed')
)
WITH CHECK (
    status != 'approved' AND
    (SELECT status FROM public.samples WHERE id = results.sample_id) 
        NOT IN ('review', 'completed')
);

COMMENT ON POLICY "Analysts can update non-review results" ON public.results 
IS 'Analysts can only update results if they are not approved AND the sample is not in review or completed status';
