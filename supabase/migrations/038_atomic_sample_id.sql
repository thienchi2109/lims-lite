-- Migration 038: Implement Atomic Sample ID Generation
-- Description: Introduces a sequence table and helper function to generate sample IDs atomically,
-- preventing race conditions. Updates usage in new RPC and existing accession flow.

SET search_path TO public;

-- 1. Create Sequence Table
CREATE TABLE IF NOT EXISTS public.sample_id_sequences (
    date_key DATE PRIMARY KEY DEFAULT CURRENT_DATE,
    current_count INTEGER DEFAULT 0
);

ALTER TABLE public.sample_id_sequences ENABLE ROW LEVEL SECURITY;

-- No RLS policies needed as this is an internal table used by SECURITY DEFINER functions

-- 2. Create Atomic ID Generator Function
CREATE OR REPLACE FUNCTION generate_next_sample_id()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    v_today DATE := CURRENT_DATE;
    v_count INTEGER;
    v_sample_id TEXT;
BEGIN
    -- Atomic Upsert: Increment count for today, or insert 1 if no record exists
    INSERT INTO public.sample_id_sequences (date_key, current_count)
    VALUES (v_today, 1)
    ON CONFLICT (date_key)
    DO UPDATE SET current_count = sample_id_sequences.current_count + 1
    RETURNING current_count INTO v_count;

    -- Format: CDC-XN-ddmmyyyy-xxxx
    v_sample_id := 'CDC-XN-' || to_char(v_today, 'DDMMYYYY') || '-' || lpad(v_count::text, 4, '0');

    RETURN v_sample_id;
END;
$$;

-- 3. Create New RPC for Atomic Sample Creation (replaces client-side logic in createSample)
CREATE OR REPLACE FUNCTION create_sample_atomic(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_received_by UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_sample_id TEXT;
    v_sample samples;
    v_role user_role;
BEGIN
    -- Permission Check
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    
    -- Verify received_by matches auth.uid if analyst (or allow if manager)
    -- This logic mirrors the "Analysts can insert own samples" policy
    SELECT role INTO v_role FROM public.users WHERE id = v_user_id;

    IF v_role = 'analyst' AND p_received_by <> v_user_id THEN
         RAISE EXCEPTION 'Analysts can only receive samples for themselves';
    END IF;

    -- Generate ID Atomically
    v_sample_id := generate_next_sample_id();

    -- Insert Sample
    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        status,
        received_at,
        received_by
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        'received',
        COALESCE(p_received_at, now()),
        p_received_by 
    )
    RETURNING * INTO v_sample;

    RETURN to_jsonb(v_sample);
END;
$$;

-- 4. Update Existing RPC `accession_and_assign_tests` to use atomic generator
-- (Copy of Migration 019 but with updated ID generation logic)
CREATE OR REPLACE FUNCTION accession_and_assign_tests(
    p_client_id UUID,
    p_client_name TEXT,
    p_received_at TIMESTAMPTZ,
    p_tests JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Keep security definer
SET search_path = public
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_role user_role;
    v_sample samples;
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

    -- NEW: Generate ID Atomically
    v_sample_code := generate_next_sample_id();

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
            (tests."assayId")::UUID,
            (tests."methodId")::UUID,
            'pending'
        FROM jsonb_to_recordset(p_tests) AS tests("assayId" TEXT, "methodId" TEXT)
        RETURNING *
    )
    SELECT jsonb_agg(row_to_json(inserted.*)) INTO v_inserted_results FROM inserted;

    -- Mark sample as assigned now that tests exist
    UPDATE public.samples
    SET status = 'assigned',
    updated_at = now()
    WHERE id = v_sample.id
    RETURNING * INTO v_sample;

    RETURN jsonb_build_object(
        'sample', to_jsonb(v_sample),
        'results', COALESCE(v_inserted_results, '[]'::jsonb)
    );
END;
$$;
