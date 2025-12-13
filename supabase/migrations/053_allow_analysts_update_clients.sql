-- Migration 053: Allow analysts to update clients
-- Security Impact: MEDIUM - Expands UPDATE permissions on clients to analysts
-- Changes: Replace manager-only UPDATE policy with analyst+manager UPDATE policy

SET search_path TO public;

-- Drop old policy (if replacing)
DROP POLICY IF EXISTS "Managers can update clients" ON public.clients;
DROP POLICY IF EXISTS "Analysts and managers can update clients" ON public.clients;

-- UPDATE: Analysts and managers can update clients
-- Rationale: Analysts must be able to correct client identity info entered during accessioning
CREATE POLICY "Analysts and managers can update clients"
ON public.clients FOR UPDATE
USING (get_user_role() IN ('analyst', 'manager'))
WITH CHECK (get_user_role() IN ('analyst', 'manager'));

COMMENT ON POLICY "Analysts and managers can update clients" ON public.clients
IS 'Allow analysts and managers to correct existing client records when needed';

