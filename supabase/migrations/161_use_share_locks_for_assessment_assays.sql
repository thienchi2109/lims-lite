-- Migration 161: Use shared assay locks during assessment submissions
-- Security Impact: Low
-- Changes:
--   - Preserves exclusive locks on result rows.
--   - Uses shared locks on assay definitions so concurrent readers proceed
--     while assay updates and deletes remain blocked until snapshot creation.
--   - Patches only the function created by migration 160 and fails if its
--     expected baseline is absent.

SET search_path TO public, extensions;

DO $$
DECLARE
    v_function_definition TEXT;
    v_patched_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)'::regprocedure
    )
    INTO v_function_definition;

    IF v_function_definition IS NULL
       OR POSITION('FOR UPDATE OF result, assay;' IN v_function_definition) = 0 THEN
        RAISE EXCEPTION 'Migration 161 expected the migration 160 assessment RPC lock clause';
    END IF;

    v_patched_definition := REPLACE(
        v_function_definition,
        'FOR UPDATE OF result, assay;',
        'FOR UPDATE OF result FOR SHARE OF assay;'
    );

    EXECUTE v_patched_definition;

    SELECT pg_get_functiondef(
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)'::regprocedure
    )
    INTO v_function_definition;

    IF v_function_definition IS NULL
       OR POSITION('FOR UPDATE OF result FOR SHARE OF assay;' IN v_function_definition) = 0
       OR POSITION('FOR UPDATE OF result, assay;' IN v_function_definition) > 0 THEN
        RAISE EXCEPTION 'Migration 161 verification failed';
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
