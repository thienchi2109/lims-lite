-- Migration 091: Fix coa_reports_update_managers RLS policy
-- Security Impact: Medium - Allows managers to update CoA reports in any status
-- Changes: Modified USING clause to allow updates on any status, not just 'failed'

SET search_path TO public;

-- Drop old restrictive policy
DROP POLICY IF EXISTS "coa_reports_update_managers" ON public.coa_reports;

-- Create new policy allowing managers to update CoA reports in any status
-- USING: Managers can update any CoA report (removed status='failed' restriction)
-- WITH CHECK: Ensures status transitions are valid (pending, ready, failed)
CREATE POLICY "coa_reports_update_managers"
ON public.coa_reports FOR UPDATE
USING (get_user_role() = 'manager'::user_role)
WITH CHECK (
    (get_user_role() = 'manager'::user_role)
    AND (status = ANY (ARRAY['pending'::text, 'ready'::text, 'failed'::text]))
);

-- Document the policy
COMMENT ON POLICY "coa_reports_update_managers" ON public.coa_reports
IS 'Allows managers to update CoA reports in any status. Status must transition to pending, ready, or failed.';
