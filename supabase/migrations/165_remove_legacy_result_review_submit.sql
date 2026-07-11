-- Migration 165: Remove the legacy result-review submission RPC.
-- Security Impact: High - closes the remaining path that could move a sample
-- to review without one explicit analyst assessment for every current result.
-- The assessment-aware SECURITY DEFINER RPC remains the only supported path.

SET search_path TO public, extensions;

DO $$
BEGIN
    IF to_regprocedure(
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'Required assessment-aware submission RPC is missing';
    END IF;

    IF to_regprocedure('public.submit_sample_for_review(uuid)') IS NULL THEN
        RAISE EXCEPTION
            'Expected legacy submit_sample_for_review(uuid) baseline is missing';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_sample_for_review(UUID)
FROM PUBLIC, anon, authenticated, service_role;

DROP FUNCTION public.submit_sample_for_review(UUID);

NOTIFY pgrst, 'reload schema';
