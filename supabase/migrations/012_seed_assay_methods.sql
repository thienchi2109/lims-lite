-- ============================================================================
-- Migration 012: Seed Data for Assay-Method M2M
-- ============================================================================
-- Adds example data to demonstrate multiple methods per assay
-- ============================================================================

SET search_path TO public;

-- 1. Create a new alternative method for pH
INSERT INTO public.methods (id, name, description)
VALUES (
    'dddddddd-dddd-dddd-dddd-dddddddddddd', 
    'Alternative pH Method', 
    'Electrochemical method using backup probe'
)
ON CONFLICT (id) DO NOTHING;

-- 2. Link this new method to the pH assay (ID: ...001)
-- Note: The default method should have been migrated by 011
INSERT INTO public.assay_methods (assay_id, method_id, is_default, notes)
VALUES (
    '10000000-0000-0000-0000-000000000001', -- pH assay
    'dddddddd-dddd-dddd-dddd-dddddddddddd', -- Alternative method
    false,
    'Use when standard probe is unavailable or for verification'
)
ON CONFLICT (assay_id, method_id) DO NOTHING;

-- 3. Add another method to "Temperature" (ID: ...002) just in case
INSERT INTO public.methods (id, name, description)
VALUES (
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 
    'Digital Thermometer', 
    'High precision digital sensor'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.assay_methods (assay_id, method_id, is_default, notes)
VALUES (
    '10000000-0000-0000-0000-000000000002', -- Temperature assay
    'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', -- Digital Thermometer
    false,
    'For high precision requirements'
)
ON CONFLICT (assay_id, method_id) DO NOTHING;
