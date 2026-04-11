-- ============================================================================
-- Migration 021: Extended Seed Data
-- ============================================================================
-- Adds 25+ additional records for methods, assays, and samples
-- Maintains proper constraints and relationships via assay_methods junction
-- ============================================================================

SET search_path TO public;

-- ============================================================================
-- STEP 1: ADD 25 NEW LABORATORY METHODS
-- ============================================================================

INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
-- Water Quality Methods (EPA)
(gen_random_uuid(), 'EPA Method 160.1', 'Total Dissolved Solids (TDS) Gravimetric', 'EPA-160.1-1971'),
(gen_random_uuid(), 'EPA Method 180.1', 'Turbidity Nephelometric', 'EPA-180.1-1993'),
(gen_random_uuid(), 'EPA Method 310.1', 'Alkalinity Titrimetric', 'EPA-310.1-1978'),
(gen_random_uuid(), 'EPA Method 335.4', 'Cyanide Total by Distillation', 'EPA-335.4-1993'),
(gen_random_uuid(), 'EPA Method 365.1', 'Phosphorus Total by Colorimetric', 'EPA-365.1-1993'),

-- Microbiology Methods (Standard Methods)
(gen_random_uuid(), 'SM 9221 B', 'Coliform Group - Multiple-Tube Fermentation', 'SM-9221B-2017'),
(gen_random_uuid(), 'SM 9222 D', 'E.coli - Membrane Filter', 'SM-9222D-2017'),
(gen_random_uuid(), 'SM 9230 C', 'Fecal Streptococcus/Enterococcus', 'SM-9230C-2017'),
(gen_random_uuid(), 'SM 9215 B', 'Heterotrophic Plate Count Pour Plate', 'SM-9215B-2017'),

-- Heavy Metals Methods (ICP/AAS)
(gen_random_uuid(), 'EPA Method 200.7', 'Trace Elements by ICP-AES', 'EPA-200.7-2001'),
(gen_random_uuid(), 'EPA Method 200.8', 'Trace Elements by ICP-MS', 'EPA-200.8-1994'),
(gen_random_uuid(), 'EPA Method 245.1', 'Mercury by Cold Vapor AAS', 'EPA-245.1-1994'),
(gen_random_uuid(), 'EPA Method 200.9', 'Trace Elements by Stabilized Temperature GF-AAS', 'EPA-200.9-2009'),

-- Organic Compounds Methods
(gen_random_uuid(), 'EPA Method 524.2', 'VOCs by GC/MS Purge & Trap', 'EPA-524.2-1995'),
(gen_random_uuid(), 'EPA Method 525.2', 'Organic Compounds by GC/MS Liquid-Solid', 'EPA-525.2-1995'),
(gen_random_uuid(), 'EPA Method 8260', 'VOCs by GC/MS Capillary Column', 'EPA-8260D-2006'),
(gen_random_uuid(), 'EPA Method 8270', 'Semivolatile Organic Compounds by GC/MS', 'EPA-8270E-2014'),

-- Chemical Oxygen Demand & Nutrients
(gen_random_uuid(), 'EPA Method 410.4', 'COD by Colorimetric', 'EPA-410.4-1993'),
(gen_random_uuid(), 'EPA Method 351.2', 'Nitrogen Total Kjeldahl', 'EPA-351.2-1993'),
(gen_random_uuid(), 'EPA Method 353.2', 'Nitrate-Nitrite by Colorimetric', 'EPA-353.2-1993'),

-- Physical Parameters
(gen_random_uuid(), 'EPA Method 120.1', 'Conductivity', 'EPA-120.1-1982'),
(gen_random_uuid(), 'SM 2550', 'Temperature', 'SM-2550-2017'),
(gen_random_uuid(), 'EPA Method 160.2', 'Total Suspended Solids (TSS) Gravimetric', 'EPA-160.2-1999'),

-- Disinfection Byproducts
(gen_random_uuid(), 'EPA Method 524.3', 'Disinfection Byproducts DBP by GC/MS', 'EPA-524.3-2009'),
(gen_random_uuid(), 'EPA Method 552.2', 'Haloacetic Acids by GC-ECD', 'EPA-552.2-1995')

ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 2: ADD 30 NEW ASSAY DEFINITIONS
-- ============================================================================

-- Store method UUIDs for reference
DO $$
DECLARE
    -- Water Quality
    method_tds UUID;
    method_turbidity UUID;
    method_alkalinity UUID;
    method_cyanide UUID;
    method_phosphorus UUID;
    
    -- Microbiology
    method_coliform UUID;
    method_ecoli UUID;
    method_enterococcus UUID;
    method_hpc UUID;
    
    -- Heavy Metals
    method_icp_aes UUID;
    method_icp_ms UUID;
    method_mercury UUID;
    method_gfaas UUID;
    
    -- Organics
    method_voc_524 UUID;
    method_voc_8260 UUID;
    method_svoc_8270 UUID;
    
    -- Nutrients
    method_cod UUID;
    method_tkn UUID;
    method_nitrate UUID;
    
    -- Physical
    method_conductivity UUID;
    method_temp UUID;
    method_tss UUID;
    
    -- DBPs
    method_dbp UUID;
    method_haa UUID;

BEGIN
    -- Get method IDs
    SELECT id INTO method_tds FROM public.methods WHERE procedure_reference = 'EPA-160.1-1971';
    SELECT id INTO method_turbidity FROM public.methods WHERE procedure_reference = 'EPA-180.1-1993';
    SELECT id INTO method_alkalinity FROM public.methods WHERE procedure_reference = 'EPA-310.1-1978';
    SELECT id INTO method_cyanide FROM public.methods WHERE procedure_reference = 'EPA-335.4-1993';
    SELECT id INTO method_phosphorus FROM public.methods WHERE procedure_reference = 'EPA-365.1-1993';
    SELECT id INTO method_coliform FROM public.methods WHERE procedure_reference = 'SM-9221B-2017';
    SELECT id INTO method_ecoli FROM public.methods WHERE procedure_reference = 'SM-9222D-2017';
    SELECT id INTO method_enterococcus FROM public.methods WHERE procedure_reference = 'SM-9230C-2017';
    SELECT id INTO method_hpc FROM public.methods WHERE procedure_reference = 'SM-9215B-2017';
    SELECT id INTO method_icp_aes FROM public.methods WHERE procedure_reference = 'EPA-200.7-2001';
    SELECT id INTO method_icp_ms FROM public.methods WHERE procedure_reference = 'EPA-200.8-1994';
    SELECT id INTO method_mercury FROM public.methods WHERE procedure_reference = 'EPA-245.1-1994';
    SELECT id INTO method_gfaas FROM public.methods WHERE procedure_reference = 'EPA-200.9-2009';
    SELECT id INTO method_voc_524 FROM public.methods WHERE procedure_reference = 'EPA-524.2-1995';
    SELECT id INTO method_voc_8260 FROM public.methods WHERE procedure_reference = 'EPA-8260D-2006';
    SELECT id INTO method_svoc_8270 FROM public.methods WHERE procedure_reference = 'EPA-8270E-2014';
    SELECT id INTO method_cod FROM public.methods WHERE procedure_reference = 'EPA-410.4-1993';
    SELECT id INTO method_tkn FROM public.methods WHERE procedure_reference = 'EPA-351.2-1993';
    SELECT id INTO method_nitrate FROM public.methods WHERE procedure_reference = 'EPA-353.2-1993';
    SELECT id INTO method_conductivity FROM public.methods WHERE procedure_reference = 'EPA-120.1-1982';
    SELECT id INTO method_temp FROM public.methods WHERE procedure_reference = 'SM-2550-2017';
    SELECT id INTO method_tss FROM public.methods WHERE procedure_reference = 'EPA-160.2-1999';
    SELECT id INTO method_dbp FROM public.methods WHERE procedure_reference = 'EPA-524.3-2009';
    SELECT id INTO method_haa FROM public.methods WHERE procedure_reference = 'EPA-552.2-1995';

    -- Insert Assay Definitions
    
    -- Water Quality Parameters
    INSERT INTO public.assay_definitions (name, units, validation_rules) VALUES
    ('Total Dissolved Solids (TDS)', 'mg/L', '{"type": "numeric", "min": 0, "max": 5000, "decimals": 1, "required": true}'::jsonb),
    ('Turbidity', 'NTU', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 2, "required": true}'::jsonb),
    ('Alkalinity Total', 'mg/L as CaCO3', '{"type": "numeric", "min": 0, "max": 500, "decimals": 1, "required": true}'::jsonb),
    ('Cyanide Total', 'µg/L', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 1, "required": true}'::jsonb),
    ('Phosphorus Total', 'mg/L', '{"type": "numeric", "min": 0, "max": 50, "decimals": 3, "required": true}'::jsonb),
    
    -- Microbiological Parameters
    ('Total Coliforms', 'MPN/100mL', '{"type": "numeric", "min": 0, "max": 100000, "decimals": 0, "required": true}'::jsonb),
    ('E. coli', 'CFU/100mL', '{"type": "numeric", "min": 0, "max": 10000, "decimals": 0, "required": true}'::jsonb),
    ('Enterococcus', 'CFU/100mL', '{"type": "numeric", "min": 0, "max": 10000, "decimals": 0, "required": true}'::jsonb),
    ('Heterotrophic Plate Count', 'CFU/mL', '{"type": "numeric", "min": 0, "max": 1000000, "decimals": 0, "required": true}'::jsonb),
    
    -- Heavy Metals (trace elements)
    ('Arsenic (As)', 'µg/L', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 2, "required": true}'::jsonb),
    ('Lead (Pb)', 'µg/L', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 2, "required": true}'::jsonb),
    ('Cadmium (Cd)', 'µg/L', '{"type": "numeric", "min": 0, "max": 100, "decimals": 2, "required": true}'::jsonb),
    ('Chromium (Cr)', 'µg/L', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 2, "required": true}'::jsonb),
    ('Mercury (Hg)', 'µg/L', '{"type": "numeric", "min": 0, "max": 10, "decimals": 3, "required": true}'::jsonb),
    ('Copper (Cu)', 'mg/L', '{"type": "numeric", "min": 0, "max": 10, "decimals": 3, "required": true}'::jsonb),
    ('Zinc (Zn)', 'mg/L', '{"type": "numeric", "min": 0, "max": 50, "decimals": 3, "required": true}'::jsonb),
    
    -- Organic Compounds
    ('Benzene', 'µg/L', '{"type": "numeric", "min": 0, "max": 100, "decimals": 2, "required": true}'::jsonb),
    ('Toluene', 'µg/L', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 2, "required": true}'::jsonb),
    ('Xylene Total', 'µg/L', '{"type": "numeric", "min": 0, "max": 10000, "decimals": 2, "required": true}'::jsonb),
    ('PCBs Total', 'µg/L', '{"type": "numeric", "min": 0, "max": 10, "decimals": 3, "required": true}'::jsonb),
    
    -- Nutrients
    ('COD (Chemical Oxygen Demand)', 'mg/L', '{"type": "numeric", "min": 0, "max": 1000, "decimals": 1, "required": true}'::jsonb),
    ('Nitrogen Total Kjeldahl (TKN)', 'mg/L', '{"type": "numeric", "min": 0, "max": 100, "decimals": 2, "required": true}'::jsonb),
    ('Nitrate as N', 'mg/L', '{"type": "numeric", "min": 0, "max": 50, "decimals": 2, "required": true}'::jsonb),
    ('Nitrite as N', 'mg/L', '{"type": "numeric", "min": 0, "max": 10, "decimals": 3, "required": true}'::jsonb),
    
    -- Physical Parameters
    ('Conductivity', 'µS/cm', '{"type": "numeric", "min": 0, "max": 100000, "decimals": 1, "required": true}'::jsonb),
    ('Temperature', '°C', '{"type": "numeric", "min": -10, "max": 100, "decimals": 1, "required": true}'::jsonb),
    ('Total Suspended Solids (TSS)', 'mg/L', '{"type": "numeric", "min": 0, "max": 5000, "decimals": 1, "required": true}'::jsonb),
    
    -- Disinfection Byproducts
    ('Trihalomethanes Total (TTHMs)', 'µg/L', '{"type": "numeric", "min": 0, "max": 500, "decimals": 2, "required": true}'::jsonb),
    ('Haloacetic Acids (HAA5)', 'µg/L', '{"type": "numeric", "min": 0, "max": 300, "decimals": 2, "required": true}'::jsonb),
    ('Bromate', 'µg/L', '{"type": "numeric", "min": 0, "max": 50, "decimals": 2, "required": true}'::jsonb)
    ON CONFLICT DO NOTHING;

    RAISE NOTICE 'Created 30 new assay definitions';
END $$;

-- ============================================================================
-- STEP 3: LINK ASSAYS TO METHODS (via assay_methods junction table)
-- ============================================================================

DO $$
DECLARE
    assay_rec RECORD;
    method_rec RECORD;
    links_created INTEGER := 0;
    v_assay_id UUID;
    v_method_id UUID;
BEGIN
    -- All new assay-method links will have is_default=false to avoid conflicts
    -- Existing assays already have their default methods set
    
    -- Link TDS to EPA 160.1
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Total Dissolved Solids (TDS)' AND m.procedure_reference = 'EPA-160.1-1971'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Link Turbidity to EPA 180.1
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Turbidity' AND m.procedure_reference = 'EPA-180.1-1993'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Link Alkalinity to EPA 310.1
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Alkalinity Total' AND m.procedure_reference = 'EPA-310.1-1978'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- For remaining assays, use a simpler approach: insert without is_default=true if it would conflict
    -- This prevents the unique constraint violation
    -- Use ROW_NUMBER to ensure only first matching assay gets is_default=true
    
    -- Link Cyanide to EPA 335.4
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id, 
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Cyanide Total' AND m.procedure_reference = 'EPA-335.4-1993'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Link Phosphorus to EPA 365.1
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id,
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Phosphorus Total' AND m.procedure_reference = 'EPA-365.1-1993'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Microbiological tests
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id,
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Total Coliforms' AND m.procedure_reference = 'SM-9221B-2017'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id,
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'E. coli' AND m.procedure_reference = 'SM-9222D-2017'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id,
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Enterococcus' AND m.procedure_reference = 'SM-9230C-2017'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id,
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Heterotrophic Plate Count' AND m.procedure_reference = 'SM-9215B-2017'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Heavy Metals - Link multiple metals to ICP-AES (EPA 200.7)
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT 
        a.id, 
        m.id,
        false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name IN ('Arsenic (As)', 'Lead (Pb)', 'Cadmium (Cd)', 'Chromium (Cr)', 'Copper (Cu)', 'Zinc (Zn)')
    AND m.procedure_reference = 'EPA-200.7-2001'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Also link some metals to ICP-MS (alternative method)
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a, public.methods m
    WHERE a.name IN ('Arsenic (As)', 'Lead (Pb)', 'Cadmium (Cd)')
    AND m.procedure_reference = 'EPA-200.8-1994'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Mercury special method
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Mercury (Hg)' AND m.procedure_reference = 'EPA-245.1-1994'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- VOCs - Link to both 524.2 and 8260
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name IN ('Benzene', 'Toluene', 'Xylene Total')
    AND m.procedure_reference = 'EPA-524.2-1995'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Also link some metals to ICP-MS (alternative method, not default)
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a, public.methods m
    WHERE a.name IN ('Arsenic (As)', 'Lead (Pb)', 'Cadmium (Cd)')
    AND m.procedure_reference = 'EPA-200.8-1994'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Mercury special method
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Mercury (Hg)' AND m.procedure_reference = 'EPA-245.1-1994'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- VOCs - Link to both 524.2 and 8260
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name IN ('Benzene', 'Toluene', 'Xylene Total')
    AND m.procedure_reference = 'EPA-524.2-1995'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id, false
    FROM public.assay_definitions a, public.methods m
    WHERE a.name IN ('Benzene', 'Toluene', 'Xylene Total')
    AND m.procedure_reference = 'EPA-8260D-2006'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- PCBs to semivolatiles method
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'PCBs Total' AND m.procedure_reference = 'EPA-8270E-2014'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Nutrients
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'COD (Chemical Oxygen Demand)' AND m.procedure_reference = 'EPA-410.4-1993'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Nitrogen Total Kjeldahl (TKN)' AND m.procedure_reference = 'EPA-351.2-1993'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name IN ('Nitrate as N', 'Nitrite as N') AND m.procedure_reference = 'EPA-353.2-1993'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- Physical Parameters
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Conductivity' AND m.procedure_reference = 'EPA-120.1-1982'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Temperature' AND m.procedure_reference = 'SM-2550-2017'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Total Suspended Solids (TSS)' AND m.procedure_reference = 'EPA-160.2-1999'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    -- DBPs
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name IN ('Trihalomethanes Total (TTHMs)', 'Bromate') AND m.procedure_reference = 'EPA-524.3-2009'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    INSERT INTO public.assay_methods (assay_id, method_id, is_default)
    SELECT a.id, m.id,
           false
    FROM public.assay_definitions a
    CROSS JOIN public.methods m
    WHERE a.name = 'Haloacetic Acids (HAA5)' AND m.procedure_reference = 'EPA-552.2-1995'
    ON CONFLICT (assay_id, method_id) DO NOTHING;
    
    RAISE NOTICE 'Created assay-method relationships';
END $$;

-- ============================================================================
-- STEP 4: CREATE 30 NEW SAMPLE RECORDS
-- ============================================================================

DO $$
DECLARE
    v_analyst_id UUID;
    v_sample_id UUID;
    i INTEGER;
    sample_types TEXT[] := ARRAY['Drinking Water', 'Wastewater', 'Surface Water', 'Groundwater', 'Industrial Effluent', 'Stormwater'];
    locations TEXT[] := ARRAY['Site A', 'Site B', 'Site C', 'Site D', 'Site E', 'Plant 1', 'Plant 2', 'Well 3', 'River Intake'];
    statuses sample_status[] := ARRAY['received', 'assigned', 'in_progress'];
    created_count INTEGER := 0;
BEGIN
    -- Get user IDs
    SELECT id INTO v_analyst_id FROM public.users WHERE username = 'analyst';
    
    -- Create 30 diverse samples
    FOR i IN 1..30 LOOP
        INSERT INTO public.samples (
            sample_id, 
            client_name, 
            status, 
            received_by, 
            received_at
        )
        VALUES (
            'LAB-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD((1000 + i)::TEXT, 4, '0'),
            sample_types[(i % 6) + 1] || ' - ' || locations[(i % 9) + 1],
            statuses[(i % 3) + 1],
            v_analyst_id,
            CURRENT_TIMESTAMP - ((i * 3) || ' hours')::INTERVAL
        )
        ON CONFLICT (sample_id) DO NOTHING
        RETURNING id INTO v_sample_id;
        
        IF v_sample_id IS NOT NULL THEN
            created_count := created_count + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Created % new samples', created_count;
END $$;

-- ============================================================================
-- STEP 5: ASSIGN RANDOM TESTS TO SOME SAMPLES
-- ============================================================================

DO $$
DECLARE
    sample_rec RECORD;
    assay_rec RECORD;
    method_rec RECORD;
    result_count INTEGER := 0;
    tests_per_sample INTEGER;
    assay_count INTEGER;
BEGIN
    -- Count available assays
    SELECT COUNT(*) INTO assay_count FROM public.assay_definitions WHERE deleted_at IS NULL;
    
    -- Assign tests to samples with 'assigned' status
    FOR sample_rec IN 
        SELECT id FROM public.samples 
        WHERE status = 'assigned'
        AND sample_id LIKE 'LAB-%'
        ORDER BY received_at DESC
    LOOP
        -- Randomly assign 3-8 tests per sample
        tests_per_sample := 3 + floor(random() * 6)::int;
        
        -- Get random assays and their default methods
        FOR assay_rec IN 
            SELECT DISTINCT ON (ad.id) 
                ad.id as assay_id,
                am.method_id
            FROM public.assay_definitions ad
            LEFT JOIN public.assay_methods am ON ad.id = am.assay_id AND am.is_default = true
            WHERE ad.deleted_at IS NULL
            ORDER BY ad.id, random()
            LIMIT tests_per_sample
        LOOP
            -- Insert result with pending status
            INSERT INTO public.results (sample_id, assay_id, method_id, status)
            VALUES (sample_rec.id, assay_rec.assay_id, assay_rec.method_id, 'pending')
            ON CONFLICT DO NOTHING;
            
            result_count := result_count + 1;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Created % test assignments for assigned samples', result_count;
END $$;

-- ============================================================================
-- VERIFICATION & SUMMARY
-- ============================================================================

DO $$
DECLARE
    method_count INTEGER;
    assay_count INTEGER;
    sample_count INTEGER;
    assay_method_count INTEGER;
    result_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO method_count FROM public.methods WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO assay_count FROM public.assay_definitions WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO sample_count FROM public.samples WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO assay_method_count FROM public.assay_methods;
    SELECT COUNT(*) INTO result_count FROM public.results;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'EXTENDED SEED DATA MIGRATION COMPLETE';
    RAISE NOTICE '========================================================================';
    RAISE NOTICE 'Total Methods: %', method_count;
    RAISE NOTICE 'Total Assays: %', assay_count;
    RAISE NOTICE 'Total Samples: %', sample_count;
    RAISE NOTICE 'Assay-Method Links: %', assay_method_count;
    RAISE NOTICE 'Total Test Results: %', result_count;
    RAISE NOTICE '========================================================================';
    RAISE NOTICE '';
END $$;

-- Final verification queries
SELECT 'Methods' as entity, COUNT(*) as total_count FROM public.methods WHERE deleted_at IS NULL
UNION ALL
SELECT 'Assays', COUNT(*) FROM public.assay_definitions WHERE deleted_at IS NULL
UNION ALL
SELECT 'Samples', COUNT(*) FROM public.samples WHERE deleted_at IS NULL
UNION ALL
SELECT 'Assay-Method Links', COUNT(*) FROM public.assay_methods
UNION ALL
SELECT 'Results', COUNT(*) FROM public.results;

-- Show sample distribution by status
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 1) as percentage
FROM public.samples
WHERE deleted_at IS NULL
GROUP BY status
ORDER BY status;

COMMENT ON COLUMN public.assay_definitions.validation_rules IS 'JSON validation rules: type, min, max, decimals, required';



