-- Migration 025: Fix results insert policy with role check
-- Addresses P1 security vulnerability where any authenticated user could insert results
-- Restores role-based access control for analysts and managers only

SET search_path TO public;

-- Drop the vulnerable policy from migration 023
DROP POLICY IF EXISTS "Analysts can insert pending results" ON public.results;

-- Create a secure policy with proper role check
CREATE POLICY "Analysts and managers can insert pending results"
ON public.results FOR INSERT
WITH CHECK (
    -- ✅ Role check: Only analysts and managers can insert results
    get_user_role() IN ('analyst', 'manager')
    -- ✅ Status check: Can only insert pending results (not entered/approved)
    AND status = 'pending'
    -- ✅ Sample validation: Sample must exist and not be deleted
    AND EXISTS (
        SELECT 1
        FROM public.samples s
        WHERE s.id = public.results.sample_id
          AND s.deleted_at IS NULL
    )
);

COMMENT ON POLICY "Analysts and managers can insert pending results" ON public.results 
IS 'Allows analysts and managers to assign tests (insert pending results) to any non-deleted sample. Enforces role-based access control to prevent unauthorized data creation.';
