-- Migration 162: Verify assessment snapshots have no write-capable RLS policy
-- Security Impact: Low
-- Changes:
--   - Re-runs the migration 159 write-policy verification.
--   - Counts FOR ALL policies (polcmd = '*') alongside INSERT, UPDATE, and
--     DELETE policies.
--   - Does not modify the already-applied migration 159 or current policies.

SET search_path TO public, extensions;

DO $$
DECLARE
    v_write_policy_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO v_write_policy_count
    FROM pg_policy
    WHERE polrelid = 'public.result_reference_assessments'::regclass
      AND polcmd IN ('a', 'w', 'd', '*');

    IF v_write_policy_count <> 0 THEN
        RAISE EXCEPTION
            'Assessment snapshots have % write-capable RLS policy or policies',
            v_write_policy_count;
    END IF;
END;
$$;
