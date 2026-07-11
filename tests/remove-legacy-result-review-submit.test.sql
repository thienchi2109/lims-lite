-- Phase 2 regression: the legacy submission RPC must not bypass mandatory assessments.
-- This test is expected to fail before migration 165 removes the one-argument function.

SET search_path TO public, extensions;

DO $$
BEGIN
    IF to_regprocedure('public.submit_sample_for_review(uuid)') IS NOT NULL THEN
        RAISE EXCEPTION
            'legacy submit_sample_for_review(uuid) must be removed after the assessment-aware caller is deployed';
    END IF;

    IF to_regprocedure(
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)'
    ) IS NULL THEN
        RAISE EXCEPTION
            'assessment-aware submit_sample_for_review_with_assessments(uuid,jsonb) must remain available';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.run_security_tests()
        WHERE test_name = 'Result Review Submission RPC Guard'
          AND passed
    ) THEN
        RAISE EXCEPTION
            'run_security_tests() must enforce the result-review submission RPC contract';
    END IF;
END;
$$;
