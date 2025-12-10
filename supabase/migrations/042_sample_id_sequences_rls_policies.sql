-- Migration 042: Add RLS policies for sample_id_sequences
-- Security Impact: Low - Authenticated analysts/managers can read/write the counter table
-- Changes: Add SELECT/INSERT/UPDATE policies with role checks to avoid RLS lockout on sample_id_sequences

SET search_path TO public;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Analyst/manager can read sample id sequences" ON public.sample_id_sequences;
DROP POLICY IF EXISTS "Analyst/manager can insert sample id sequences" ON public.sample_id_sequences;
DROP POLICY IF EXISTS "Analyst/manager can update sample id sequences" ON public.sample_id_sequences;

-- Allow analysts and managers to read the daily counter (used by ID generator)
CREATE POLICY "Analyst/manager can read sample id sequences"
  ON public.sample_id_sequences
  FOR SELECT
  USING (get_user_role() IN ('analyst', 'manager'));

COMMENT ON POLICY "Analyst/manager can read sample id sequences" ON public.sample_id_sequences
IS 'Permit authenticated analysts/managers to read sample ID counters for generator function';

-- Allow analysts and managers to insert new day counters
CREATE POLICY "Analyst/manager can insert sample id sequences"
  ON public.sample_id_sequences
  FOR INSERT
  WITH CHECK (get_user_role() IN ('analyst', 'manager'));

COMMENT ON POLICY "Analyst/manager can insert sample id sequences" ON public.sample_id_sequences
IS 'Permit authenticated analysts/managers to start daily counter rows for sample ID generation';

-- Allow analysts and managers to increment existing counters
CREATE POLICY "Analyst/manager can update sample id sequences"
  ON public.sample_id_sequences
  FOR UPDATE
  USING (get_user_role() IN ('analyst', 'manager'))
  WITH CHECK (get_user_role() IN ('analyst', 'manager'));

COMMENT ON POLICY "Analyst/manager can update sample id sequences" ON public.sample_id_sequences
IS 'Permit authenticated analysts/managers to increment daily sample ID counters';
