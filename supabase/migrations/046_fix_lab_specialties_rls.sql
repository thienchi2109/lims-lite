-- Migration 046: Fix lab_specialties manager RLS policy
-- Security Impact: Medium
-- Changes: Replaces "Managers can manage lab specialties" policy to add explicit WITH CHECK for INSERT/UPDATE/DELETE

SET search_path TO public;

-- Drop old policy (missing WITH CHECK)
DROP POLICY IF EXISTS "Managers can manage lab specialties" ON public.lab_specialties;

-- Managers can manage lab specialties (explicit checks for all commands)
CREATE POLICY "Managers can manage lab specialties"
ON public.lab_specialties FOR ALL
USING (get_user_role() = 'manager')
WITH CHECK (get_user_role() = 'manager');

COMMENT ON POLICY "Managers can manage lab specialties" ON public.lab_specialties
IS 'Managers can INSERT/UPDATE/DELETE lab specialties; WITH CHECK explicitly enforces manager role for writes.';
