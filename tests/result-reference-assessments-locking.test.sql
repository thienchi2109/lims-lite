-- RESULT REFERENCE ASSESSMENT LOCKING REGRESSION TEST
-- Verifies the assessment submission RPC preserves exclusive result locks while
-- using shared locks for assay definitions.
-- Usage:
--   docker exec -i lims-postgres psql -v ON_ERROR_STOP=1 -U postgres -d postgres < tests/result-reference-assessments-locking.test.sql

\set ON_ERROR_STOP on
SET search_path TO public, extensions;

BEGIN;

DO $$
DECLARE
    v_function_definition TEXT;
BEGIN
    SELECT pg_get_functiondef(
        'public.submit_sample_for_review_with_assessments(uuid,jsonb)'::regprocedure
    )
    INTO v_function_definition;

    IF v_function_definition IS NULL
       OR v_function_definition NOT ILIKE '%FOR UPDATE OF result FOR SHARE OF assay%' THEN
        RAISE EXCEPTION 'assessment submission RPC must lock results FOR UPDATE and assays FOR SHARE';
    END IF;

    IF v_function_definition ILIKE '%FOR UPDATE OF result, assay%' THEN
        RAISE EXCEPTION 'assessment submission RPC still locks assays FOR UPDATE';
    END IF;
END;
$$;

ROLLBACK;

SELECT 'result-reference-assessments-locking: ok' AS result;
