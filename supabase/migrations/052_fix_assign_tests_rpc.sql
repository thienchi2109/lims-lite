-- Migration 052: Fix assign_tests_to_sample RPC to handle empty methodId
-- Security Impact: None (maintains existing RLS and permissions)
-- Changes: Update public.assign_tests_to_sample to use NULLIF(..., '') for method_id casting

SET search_path TO public;

CREATE OR REPLACE FUNCTION public.assign_tests_to_sample(
    p_sample_id UUID,
    p_tests JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_role TEXT := get_user_role();
    v_sample_status sample_status;
    v_inserted_count INTEGER := 0;
    v_new_status sample_status;
    v_zero_uuid CONSTANT UUID := '00000000-0000-0000-0000-000000000000';
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF v_user_role NOT IN ('analyst', 'manager') THEN
        RAISE EXCEPTION 'Insufficient permissions';
    END IF;

    IF p_tests IS NULL OR jsonb_typeof(p_tests) <> 'array' OR jsonb_array_length(p_tests) = 0 THEN
        RAISE EXCEPTION 'At least one test must be provided';
    END IF;

    SELECT status
    INTO v_sample_status
    FROM public.samples
    WHERE id = p_sample_id
      AND deleted_at IS NULL
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Sample not found';
    END IF;

    IF v_user_role = 'analyst' AND v_sample_status NOT IN ('received', 'assigned') THEN
        RAISE EXCEPTION 'Analysts can only assign tests when the sample is received or already assigned';
    END IF;

    WITH expanded AS (
        SELECT
            (test->>'assayId')::uuid AS assay_id,
            -- FIX: Handle empty string for methodId by converting to NULL
            NULLIF(test->>'methodId', '')::uuid AS method_id
        FROM jsonb_array_elements(p_tests) AS test
    ),
    deduped AS (
        SELECT DISTINCT assay_id, method_id
        FROM expanded
        WHERE assay_id IS NOT NULL
    ),
    existing AS (
        SELECT assay_id, COALESCE(method_id, v_zero_uuid) AS method_id
        FROM public.results
        WHERE sample_id = p_sample_id
    ),
    to_insert AS (
        SELECT d.assay_id, d.method_id
        FROM deduped d
        LEFT JOIN existing e
          ON e.assay_id = d.assay_id
         AND e.method_id = COALESCE(d.method_id, v_zero_uuid)
        WHERE e.assay_id IS NULL
    ),
    inserted AS (
        INSERT INTO public.results (sample_id, assay_id, method_id, status)
        SELECT p_sample_id, assay_id, method_id, 'pending'
        FROM to_insert
        RETURNING id
    )
    SELECT COUNT(*) INTO v_inserted_count FROM inserted;

    IF v_inserted_count > 0 THEN
        v_new_status := CASE WHEN v_sample_status = 'received' THEN 'assigned' ELSE v_sample_status END;

        UPDATE public.samples
        SET status = v_new_status,
            updated_at = NOW()
        WHERE id = p_sample_id;
    ELSE
        v_new_status := v_sample_status;
    END IF;

    RETURN jsonb_build_object(
        'sample_id', p_sample_id,
        'inserted_count', v_inserted_count,
        'new_status', v_new_status
    );
END;
$$;

COMMENT ON FUNCTION public.assign_tests_to_sample(UUID, JSONB)
IS 'Assigns tests to a sample, updating status/updated_at atomically with RLS-safe permissions. Handles empty/null method_ids safely.';
