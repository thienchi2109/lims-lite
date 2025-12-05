-- ============================================================================
-- ADVANCED SEED DATA SCRIPT
-- ============================================================================
-- Generates a comprehensive dataset for testing and development.
-- Includes:
-- 1. Users (Analyst, Manager)
-- 2. Extended Method Library
-- 3. Extended Assay Definitions
-- 4. Assay-Method Links (Many-to-Many)
-- 5. 50+ Samples with varied statuses and dates
-- 6. Results for samples in various stages (pending, entered, approved)
-- ============================================================================

-- Disable triggers to speed up bulk inserts and avoid audit noise
ALTER TABLE public.users DISABLE TRIGGER audit_users_trigger;

-- 1. USERS
-- ----------------------------------------------------------------------------
INSERT INTO public.users (id, username, full_name, role) VALUES
('a0000000-0000-0000-0000-000000000001', 'analyst', 'Test Analyst', 'analyst'),
('b0000000-0000-0000-0000-000000000001', 'manager', 'Test Manager', 'manager')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.users ENABLE TRIGGER audit_users_trigger;

-- 2. METHODS (Library of Lab Procedures)
-- ----------------------------------------------------------------------------
INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
-- Water Quality Methods
('a0000000-0000-0000-0000-000000000001', 'SM 9223 B', 'Enzyme Substrate Coliform Test', 'Standard Methods 23rd Ed.'),
('a0000000-0000-0000-0000-000000000002', 'EPA 200.8', 'Determination of Trace Elements by ICP-MS', 'EPA-200.8-1994'),
('a0000000-0000-0000-0000-000000000003', 'EPA 300.1', 'Inorganic Anions by Ion Chromatography', 'EPA-300.1-1999'),
-- Clinical Methods
('a0000000-0000-0000-0000-000000000004', 'CDC RT-PCR Influenza', 'Real-time RT-PCR for Influenza A/B', 'CDC-FLU-2023'),
('a0000000-0000-0000-0000-000000000005', 'ELISA Anti-HCV', 'Enzyme Immunoassay for Hepatitis C', 'Abbott-HCV-2.0')
ON CONFLICT (id) DO NOTHING;

-- 3. ASSAY DEFINITIONS (Tests that can be ordered)
-- ----------------------------------------------------------------------------
INSERT INTO public.assay_definitions (id, name, units, validation_rules) VALUES
-- Water Quality Assays
('d0000000-0000-0000-0000-000000000001', 'Total Coliforms', 'MPN/100mL', '{"type": "numeric", "min": 0, "max": 2419.6, "required": true}'),
('d0000000-0000-0000-0000-000000000002', 'E. coli', 'MPN/100mL', '{"type": "numeric", "min": 0, "max": 2419.6, "required": true}'),
('d0000000-0000-0000-0000-000000000003', 'Lead (Pb)', 'µg/L', '{"type": "numeric", "min": 0, "max": 1000, "required": true}'),
('d0000000-0000-0000-0000-000000000004', 'Nitrate (NO3)', 'mg/L', '{"type": "numeric", "min": 0, "max": 50, "required": true}'),
-- Clinical Assays
('d0000000-0000-0000-0000-000000000005', 'Influenza A', NULL, '{"type": "categorical", "options": ["Positive", "Negative", "Indeterminate"], "required": true}'),
('d0000000-0000-0000-0000-000000000006', 'Influenza B', NULL, '{"type": "categorical", "options": ["Positive", "Negative", "Indeterminate"], "required": true}')
ON CONFLICT (id) DO NOTHING;

-- 4. ASSAY-METHOD LINKS (Linking tests to methods)
-- ----------------------------------------------------------------------------
INSERT INTO public.assay_methods (assay_id, method_id, is_default, notes) VALUES
-- Coliforms -> SM 9223 B
('d0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', true, 'Primary method for drinking water'),
-- E. coli -> SM 9223 B
('d0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', true, 'Simultaneous detection with Coliforms'),
-- Lead -> EPA 200.8
('d0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', true, 'ICP-MS allows low detection limits'),
-- Nitrate -> EPA 300.1
('d0000000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', true, NULL),
-- Flu A/B -> PCR
('d0000000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000004', true, 'High sensitivity molecular test'),
('d0000000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000004', true, NULL)
ON CONFLICT (assay_id, method_id) DO NOTHING;


-- 5. SAMPLES GENERATION
-- ----------------------------------------------------------------------------
-- We will generate 50 samples with a distribution of statuses:
-- 10 Received (New)
-- 10 Assigned (Pending results)
-- 15 In Progress (Some results entered)
-- 15 Completed (All results approved)

DO $$
DECLARE
    analyst_id UUID := 'a0000000-0000-0000-0000-000000000001';
    manager_id UUID := 'b0000000-0000-0000-0000-000000000001';
    v_sample_id UUID;
    v_status TEXT;
    v_client TEXT;
    v_received_at TIMESTAMP;
    v_assay_rec RECORD;
    i INTEGER;
BEGIN
    FOR i IN 1..50 LOOP
        -- Deterministic Randomness for consistent seed data
        
        -- Determine Status based on index
        IF i <= 10 THEN
            v_status := 'received';
            v_received_at := NOW() - (i || ' hours')::INTERVAL;
        ELSIF i <= 20 THEN
            v_status := 'assigned';
            v_received_at := NOW() - '1 day'::INTERVAL - (i || ' hours')::INTERVAL;
        ELSIF i <= 35 THEN
            v_status := 'in_progress';
            v_received_at := NOW() - '3 days'::INTERVAL - (i || ' hours')::INTERVAL;
        ELSE
            v_status := 'completed';
            v_received_at := NOW() - '7 days'::INTERVAL - (i || ' hours')::INTERVAL;
        END IF;

        -- Determine Client
        IF i % 3 = 0 THEN v_client := 'City Water Dept';
        ELSIF i % 3 = 1 THEN v_client := 'Regional Hospital';
        ELSE v_client := 'Private Well Owner';
        END IF;

        -- INSERT SAMPLE
        INSERT INTO public.samples (sample_id, client_name, status, received_by, received_at)
        VALUES (
            'CDC-SEED-' || TO_CHAR(v_received_at, 'YYMMDD') || '-' || LPAD(i::TEXT, 3, '0'),
            v_client,
            v_status,
            analyst_id,
            v_received_at
        )
        ON CONFLICT (sample_id) DO UPDATE SET status = EXCLUDED.status
        RETURNING id INTO v_sample_id;

        -- ASSIGN TESTS & RESULTS (If not just 'received')
        IF v_status <> 'received' AND v_sample_id IS NOT NULL THEN
            
            -- Assign a mix of tests based on Client Type
            FOR v_assay_rec IN 
                SELECT id, name FROM public.assay_definitions 
                WHERE (v_client = 'City Water Dept' AND name IN ('Total Coliforms', 'E. coli', 'Lead (Pb)', 'Nitrate (NO3)'))
                   OR (v_client = 'Regional Hospital' AND name IN ('Influenza A', 'Influenza B'))
                   OR (v_client = 'Private Well Owner' AND name IN ('Total Coliforms', 'Nitrate (NO3)'))
            LOOP
                
                -- Create Result Record
                INSERT INTO public.results (sample_id, assay_id, method_id, status, value, entered_by, entered_at, approved_by, approved_at)
                SELECT 
                    v_sample_id, 
                    v_assay_rec.id,
                    (SELECT method_id FROM public.assay_methods WHERE assay_id = v_assay_rec.id AND is_default = true LIMIT 1),
                    CASE 
                        WHEN v_status = 'assigned' THEN 'pending'::result_status
                        WHEN v_status = 'in_progress' THEN 
                             CASE WHEN random() > 0.5 THEN 'entered'::result_status ELSE 'pending'::result_status END
                        ELSE 'approved'::result_status
                    END,
                    CASE 
                        WHEN v_status = 'assigned' THEN NULL
                        -- Random realistic values
                        WHEN v_assay_rec.name = 'Total Coliforms' THEN (floor(random() * 100))::text
                        WHEN v_assay_rec.name = 'E. coli' THEN (floor(random() * 10))::text
                        WHEN v_assay_rec.name = 'Lead (Pb)' THEN (floor(random() * 15))::text
                        WHEN v_assay_rec.name = 'Nitrate (NO3)' THEN (floor(random() * 10))::text
                        WHEN v_assay_rec.name LIKE 'Influenza%' THEN (ARRAY['Positive', 'Negative'])[floor(random() * 2 + 1)]
                        ELSE '0'
                    END,
                    CASE WHEN v_status <> 'assigned' THEN analyst_id ELSE NULL END,
                    CASE WHEN v_status <> 'assigned' THEN v_received_at + '2 hours'::INTERVAL ELSE NULL END,
                    CASE WHEN v_status = 'completed' THEN manager_id ELSE NULL END,
                    CASE WHEN v_status = 'completed' THEN v_received_at + '4 hours'::INTERVAL ELSE NULL END
                ON CONFLICT DO NOTHING;

            END LOOP;
        END IF;

    END LOOP;
END $$;

-- Summary Output
SELECT 'Users:' as item, COUNT(*)::text as count FROM public.users
UNION ALL SELECT 'Methods:', COUNT(*)::text FROM public.methods
UNION ALL SELECT 'Assays:', COUNT(*)::text FROM public.assay_definitions
UNION ALL SELECT 'Samples:', COUNT(*)::text FROM public.samples WHERE sample_id LIKE 'CDC-SEED-%'
UNION ALL SELECT 'Results:', COUNT(*)::text FROM public.results;
