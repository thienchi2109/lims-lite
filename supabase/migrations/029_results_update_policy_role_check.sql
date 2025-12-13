-- Migration 029: Add role check to results update policy
-- Security Impact: Medium
-- Changes: Replaces results update policy to include get_user_role() check and retain approved-status block

SET search_path TO public;

-- Replace update policy for results to enforce role check
DROP POLICY IF EXISTS "Analysts can update pending results" ON public.results;

CREATE POLICY "Analysts can update pending results"
ON public.results FOR UPDATE
USING (
    get_user_role() = 'analyst'
    AND status != 'approved'
)
WITH CHECK (
    get_user_role() = 'analyst'
    AND status != 'approved'
);

COMMENT ON POLICY "Analysts can update pending results" ON public.results
IS 'Analysts may update results that are not approved; includes role check to satisfy RLS security requirements.';

-- Verify security posture
SELECT * FROM run_security_tests();
