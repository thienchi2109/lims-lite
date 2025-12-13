-- Migration 043: Update RPC Functions for Sample Type
-- Security Impact: None (maintains existing RLS)
-- Changes: Add p_type parameter to sample creation RPCs

SET search_path TO public;

-- Drop old versions of functions (4 parameters)
DROP FUNCTION IF EXISTS create_sample_atomic(UUID, TEXT, TIMESTAMPTZ, UUID);
DROP FUNCTION IF EXISTS accession_and_assign_tests(UUID, TEXT, TIMESTAMPTZ, JSONB);

-- Update create_sample_atomic to accept type
CREATE OR REPLACE FUNCTION create_sample_atomic(
    p_client_id UUID,
    p_client_name TEXT,
    p_type TEXT,
    p_received_at TIMESTAMPTZ,
    p_received_by UUID
) RETURNS JSONB AS $$
DECLARE
    v_sample_id TEXT;
    v_sample JSONB;
BEGIN
    -- Generate next sample ID
    v_sample_id := generate_sample_id();
    
    -- Insert sample
    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        type,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_type,
        COALESCE(p_received_at, NOW()),
        p_received_by,
        'received'
    )
    RETURNING jsonb_build_object(
        'id', id,
        'sample_id', sample_id,
        'client_id', client_id,
        'client_name', client_name,
        'type', type,
        'status', status,
        'received_at', received_at,
        'created_at', created_at
    ) INTO v_sample;
    
    RETURN v_sample;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update accession_and_assign_tests to accept type
CREATE OR REPLACE FUNCTION accession_and_assign_tests(
    p_client_id UUID,
    p_client_name TEXT,
    p_type TEXT,
    p_received_at TIMESTAMPTZ,
    p_tests JSONB
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_sample_id TEXT;
    v_sample_uuid UUID;
    v_result JSONB;
    v_test JSONB;
    v_results JSONB := '[]'::JSONB;
BEGIN
    -- Get current user
    v_user_id := auth.uid();
    
    -- Generate sample ID
    v_sample_id := generate_sample_id();
    
    -- Insert sample
    INSERT INTO public.samples (
        sample_id,
        client_id,
        client_name,
        type,
        received_at,
        received_by,
        status
    ) VALUES (
        v_sample_id,
        p_client_id,
        p_client_name,
        p_type,
        COALESCE(p_received_at, NOW()),
        v_user_id,
        'assigned'
    )
    RETURNING id INTO v_sample_uuid;
    
    -- Insert test assignments
    FOR v_test IN SELECT * FROM jsonb_array_elements(p_tests)
    LOOP
        INSERT INTO public.results (
            sample_id,
            assay_id,
            method_id,
            status
        ) VALUES (
            v_sample_uuid,
            (v_test->>'assayId')::UUID,
            NULLIF(v_test->>'methodId', '')::UUID,
            'pending'
        )
        RETURNING jsonb_build_object(
            'id', id,
            'sample_id', sample_id,
            'assay_id', assay_id,
            'method_id', method_id,
            'status', status
        ) INTO v_result;
        
        v_results := v_results || jsonb_build_array(v_result);
    END LOOP;
    
    -- Return sample + results
    RETURN jsonb_build_object(
        'sample', jsonb_build_object(
            'id', v_sample_uuid,
            'sample_id', v_sample_id,
            'client_id', p_client_id,
            'client_name', p_client_name,
            'type', p_type,
            'status', 'assigned'
        ),
        'results', v_results
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_sample_atomic IS 'Creates a sample with atomic sample_id generation. Now includes sample type parameter.';
COMMENT ON FUNCTION accession_and_assign_tests IS 'Creates a sample and assigns tests in one transaction. Now includes sample type parameter.';
