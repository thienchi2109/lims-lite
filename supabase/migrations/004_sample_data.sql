-- CDC-LIMS Sample Test Data
-- Migration 004: Sample Data for Testing Phase 3
-- Creates test methods, assays, and sample data for verification

-- Set search path
SET search_path TO public;

-- ============================================================================
-- TEST METHODS
-- ============================================================================
INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
('00000000-0000-0000-0000-000000000001', 'EPA Method 150.1', 'Standard pH Measurement', 'EPA-150.1-1982'),
('00000000-0000-0000-0000-000000000002', 'EPA Method 300.0', 'Determination of Inorganic Anions by Ion Chromatography', 'EPA-300.0-1993');

-- ============================================================================
-- ASSAY DEFINITIONS WITH VALIDATION RULES
-- ============================================================================
INSERT INTO public.assay_definitions (id, name, method_id, units, validation_rules) VALUES
-- pH Test (numeric with range)
('10000000-0000-0000-0000-000000000001', 'pH', '00000000-0000-0000-0000-000000000001', 'S.U.', 
'{"type": "numeric", "min": 0, "max": 14, "required": true}'::jsonb),

-- Temperature Test
('10000000-0000-0000-0000-000000000002', 'Temperature', '00000000-0000-0000-0000-000000000001', '°C', 
'{"type": "numeric", "min": -50, "max": 100, "required": true}'::jsonb),

-- Turbidity Test
('10000000-0000-0000-0000-000000000003', 'Turbidity', '00000000-0000-0000-0000-000000000001', 'NTU', 
'{"type": "numeric", "min": 0, "max": 1000, "required": true}'::jsonb),

-- Chlorine Test
('10000000-0000-0000-0000-000000000004', 'Free Chlorine', '00000000-0000-0000-0000-000000000002', 'mg/L', 
'{"type": "numeric", "min": 0, "max": 10, "required": true}'::jsonb),

-- Conductivity Test
('10000000-0000-0000-0000-000000000005', 'Conductivity', '00000000-0000-0000-0000-000000000001', 'µS/cm', 
'{"type": "numeric", "min": 0, "max": 50000, "required": true}'::jsonb);

-- ============================================================================
-- SAMPLE DATA (20 samples for testing)
-- ============================================================================
-- Note: Replace 'YOUR_USER_ID' with an actual user ID from your users table
-- You can get this by running: SELECT id FROM public.users LIMIT 1;

-- For now, we'll use a placeholder that should be updated manually
DO $$
DECLARE
    test_user_id UUID;
    sample_ids UUID[];
    i INTEGER;
BEGIN
    -- Get the first user (analyst or manager)
    SELECT id INTO test_user_id FROM public.users LIMIT 1;
    
    IF test_user_id IS NULL THEN
        RAISE NOTICE 'No users found. Please create a user first.';
        RETURN;
    END IF;

    -- Create 20 samples
    FOR i IN 1..20 LOOP
        INSERT INTO public.samples (id, sample_id, client_name, status, received_by, received_at)
        VALUES (
            gen_random_uuid(),
            'CDC-XN-' || TO_CHAR(CURRENT_DATE, 'DDMMYYYY') || '-' || LPAD(i::TEXT, 4, '0'),
            'Test Client ' || i,
            'received',
            test_user_id,
            CURRENT_TIMESTAMP - (i || ' hours')::INTERVAL
        ) RETURNING id INTO sample_ids;
    END LOOP;

    RAISE NOTICE 'Created 20 test samples for user: %', test_user_id;
END $$;

-- ============================================================================
-- ASSIGN TESTS TO FIRST 5 SAMPLES
-- ============================================================================
DO $$
DECLARE
    sample_record RECORD;
    assay_id UUID;
BEGIN
    -- Get first 5 samples
    FOR sample_record IN 
        SELECT id FROM public.samples 
        WHERE sample_id LIKE 'CDC-XN-%'
        ORDER BY created_at DESC
        LIMIT 5
    LOOP
        -- Assign all 5 assays to each sample
        FOR assay_id IN 
            SELECT id FROM public.assay_definitions 
            WHERE deleted_at IS NULL
        LOOP
            INSERT INTO public.results (sample_id, assay_id, status)
            VALUES (sample_record.id, assay_id, 'pending');
        END LOOP;

        -- Update sample status to 'assigned'
        UPDATE public.samples 
        SET status = 'assigned'
        WHERE id = sample_record.id;
    END LOOP;

    RAISE NOTICE 'Assigned 5 tests to 5 samples (25 total results)';
END $$;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Uncomment these to verify the data was inserted correctly

-- SELECT COUNT(*) as method_count FROM public.methods;
-- SELECT COUNT(*)  as assay_count FROM public.assay_definitions;
-- SELECT COUNT(*) as sample_count FROM public.samples WHERE sample_id LIKE 'CDC-XN-%';
-- SELECT COUNT(*) as result_count FROM public.results;

COMMENT ON TABLE public.methods IS 'Contains 2 test methods for Phase 3 verification';
COMMENT ON TABLE public.assay_definitions IS 'Contains 5 assay definitions with validation rules';
