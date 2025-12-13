-- Migration 015: Allow analysts to accession and assign tests for their own samples
-- Adds scoped RLS policies and a transactional helper function for accession + assignment

SET search_path TO public;

-- ============================================================================
-- RLS POLICY ADJUSTMENTS
-- ============================================================================

-- Allow analysts to insert samples they receive (received_by must match auth.uid)
CREATE POLICY "Analysts can insert own samples"
ON public.samples FOR INSERT
WITH CHECK (
    get_user_role() = 'analyst'
    AND received_by = auth.uid()
);

-- Replace existing analyst insert policy on results with a scoped version
DROP POLICY IF EXISTS "Analysts can insert results" ON public.results;

CREATE POLICY "Analysts can insert results for own samples"
ON public.results FOR INSERT
WITH CHECK (
    auth.uid() IS NOT NULL
    AND status = 'pending'
    AND EXISTS (
        SELECT 1
        FROM public.samples s
        WHERE s.id = results.sample_id
          AND s.received_by = auth.uid()
          AND s.deleted_at IS NULL
    )
);

-- Managers still retain full control via existing "Managers can manage all results" policy

-- ============================================================================
-- HELPER FUNCTION: Accession + Assign Tests (transactional)
-- ============================================================================

CREATE OR REPLACE FUNCTION accession_and_assign_tests(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_tests JSONB
) RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_sample samples;
    v_start_of_day TIMESTAMPTZ;
    v_end_of_day TIMESTAMPTZ;
    v_today_count INTEGER;
    v_sample_code TEXT;
    v_inserted_results JSONB;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    SELECT role INTO v_role FROM public.users WHERE id = v_user_id;
    IF v_role IS NULL OR v_role NOT IN ('manager', 'analyst') THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    IF p_tests IS NULL OR jsonb_typeof(p_tests) <> 'array' OR jsonb_array_length(p_tests) = 0 THEN
        RAISE EXCEPTION 'At least one test is required';
    END IF;

    -- Compute sample ID based on today's count (CDC-XN-ddmmyyyy-000x)
    v_start_of_day := date_trunc('day', now());
    v_end_of_day := v_start_of_day + interval '1 day';
    SELECT COUNT(*) INTO v_today_count FROM public.samples s
    WHERE s.created_at >= v_start_of_day AND s.created_at < v_end_of_day;

    v_sample_code := 'CDC-XN-' || to_char(now(), 'DDMMYYYY') || '-' || lpad((v_today_count + 1)::text, 4, '0');

    -- Create sample (RLS ensures analysts can only insert their own)
    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        status,
        received_at,
        received_by
    ) VALUES (
        v_sample_code,
        p_client_id,
        p_client_name,
        'received',
        COALESCE(p_received_at, now()),
        v_user_id
    )
    RETURNING * INTO v_sample;

    -- Insert pending results for each provided assay/method
    WITH inserted AS (
        INSERT INTO public.results (sample_id, assay_id, method_id, status)
        SELECT
            v_sample.id,
            tests.assayId,
            tests.methodId,
            'pending'
        FROM jsonb_to_recordset(p_tests) AS tests("assayId" UUID, "methodId" UUID)
        RETURNING *
    )
    SELECT jsonb_agg(row_to_json(inserted.*)) INTO v_inserted_results FROM inserted;

    RETURN jsonb_build_object(
        'sample', to_jsonb(v_sample),
        'results', COALESCE(v_inserted_results, '[]'::jsonb)
    );
END;
$$;
