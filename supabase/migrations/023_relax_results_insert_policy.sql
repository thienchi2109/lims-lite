-- Migration 023: Relax results insert policy for Analysts
-- Allows analysts to assign tests (insert pending results) to any sample, not just their own.

SET search_path TO public;

-- Drop the restrictive policy
DROP POLICY IF EXISTS "Analysts can insert results for own samples" ON public.results;

-- Create a more permissive policy
CREATE POLICY "Analysts can insert pending results"
ON public.results FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.samples s
        WHERE s.id = public.results.sample_id
          AND s.deleted_at IS NULL
    )
);
