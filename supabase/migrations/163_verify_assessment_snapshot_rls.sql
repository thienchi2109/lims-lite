-- Migration 163: Verify assessment snapshot RLS protections
-- Security Impact: Low
-- Changes:
--   - Supersedes migration 162's verification gate without modifying it.
--   - Verifies RLS remains enabled on the assessment snapshot table.
--   - Counts FOR ALL policies alongside INSERT, UPDATE, and DELETE policies.

SET search_path TO public;

DO $$
DECLARE
    v_rls_enabled BOOLEAN;
    v_write_policy_count INTEGER;
BEGIN
    SELECT relrowsecurity
    INTO v_rls_enabled
    FROM pg_class
    WHERE oid = 'public.result_reference_assessments'::regclass;

    IF NOT COALESCE(v_rls_enabled, false) THEN
        RAISE EXCEPTION
            'RLS is disabled on public.result_reference_assessments';
    END IF;

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
