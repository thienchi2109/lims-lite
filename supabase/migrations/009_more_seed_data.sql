-- CDC-LIMS Additional Seed Data
-- Migration 009: Add 40+ assays for scalability testing (Environmental + Clinical)

SET search_path TO public;

-- ============================================================================
-- 1. ENVIRONMENTAL TESTS (Standard Methods)
-- ============================================================================
INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
('00000000-0000-0000-0000-000000000003', 'Standard Methods 23rd Ed.', 'Standard Methods for the Examination of Water and Wastewater', 'SM-23rd-Ed');

INSERT INTO public.assay_definitions (name, method_id, units, validation_rules) VALUES
-- Metals
('Aluminum', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 10}'::jsonb),
('Antimony', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 1}'::jsonb),
('Arsenic', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.5}'::jsonb),
('Barium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 10}'::jsonb),
('Beryllium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.5}'::jsonb),
('Cadmium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.1}'::jsonb),
('Calcium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 500}'::jsonb),
('Chromium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 5}'::jsonb),
('Copper', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 10}'::jsonb),
('Iron', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 20}'::jsonb),
('Lead', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.5}'::jsonb),
('Magnesium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 500}'::jsonb),
('Manganese', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 5}'::jsonb),
('Mercury', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.05}'::jsonb),
('Nickel', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 5}'::jsonb),
('Selenium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.5}'::jsonb),
('Silver', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 1}'::jsonb),
('Sodium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 500}'::jsonb),
('Thallium', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 0.1}'::jsonb),
('Zinc', '00000000-0000-0000-0000-000000000003', 'mg/L', '{"type": "numeric", "min": 0, "max": 20}'::jsonb);

-- ============================================================================
-- 2. CLINICAL PATHOLOGY TESTS
-- ============================================================================
INSERT INTO public.methods (id, name, description, procedure_reference) VALUES
('00000000-0000-0000-0000-000000000004', 'Clinical Hematology', 'Standard Hematology Analyzer Protocol', 'CLSI H20-A2'),
('00000000-0000-0000-0000-000000000005', 'Clinical Biochemistry', 'Serum Chemistry Analysis', 'CLSI C24-A3');

INSERT INTO public.assay_definitions (name, method_id, units, validation_rules) VALUES
-- Hematology
('Hemoglobin (Hb)', '00000000-0000-0000-0000-000000000004', 'g/dL', '{"type": "numeric", "min": 0, "max": 25}'::jsonb),
('Hematocrit (Hct)', '00000000-0000-0000-0000-000000000004', '%', '{"type": "numeric", "min": 0, "max": 100}'::jsonb),
('RBC Count', '00000000-0000-0000-0000-000000000004', 'M/µL', '{"type": "numeric", "min": 0, "max": 10}'::jsonb),
('WBC Count', '00000000-0000-0000-0000-000000000004', 'K/µL', '{"type": "numeric", "min": 0, "max": 100}'::jsonb),
('Platelet Count', '00000000-0000-0000-0000-000000000004', 'K/µL', '{"type": "numeric", "min": 0, "max": 1000}'::jsonb),
('MCV', '00000000-0000-0000-0000-000000000004', 'fL', '{"type": "numeric", "min": 50, "max": 150}'::jsonb),
('MCH', '00000000-0000-0000-0000-000000000004', 'pg', '{"type": "numeric", "min": 15, "max": 50}'::jsonb),
('MCHC', '00000000-0000-0000-0000-000000000004', 'g/dL', '{"type": "numeric", "min": 20, "max": 40}'::jsonb),

-- Biochemistry
('Glucose (Fasting)', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 1000}'::jsonb),
('Urea Nitrogen (BUN)', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 200}'::jsonb),
('Creatinine', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 20}'::jsonb),
('Total Cholesterol', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 1000}'::jsonb),
('HDL Cholesterol', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 200}'::jsonb),
('LDL Cholesterol', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 500}'::jsonb),
('Triglycerides', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 2000}'::jsonb),
('ALT (SGPT)', '00000000-0000-0000-0000-000000000005', 'U/L', '{"type": "numeric", "min": 0, "max": 1000}'::jsonb),
('AST (SGOT)', '00000000-0000-0000-0000-000000000005', 'U/L', '{"type": "numeric", "min": 0, "max": 1000}'::jsonb),
('Bilirubin, Total', '00000000-0000-0000-0000-000000000005', 'mg/dL', '{"type": "numeric", "min": 0, "max": 30}'::jsonb),
('Albumin', '00000000-0000-0000-0000-000000000005', 'g/dL', '{"type": "numeric", "min": 0, "max": 10}'::jsonb),
('Total Protein', '00000000-0000-0000-0000-000000000005', 'g/dL', '{"type": "numeric", "min": 0, "max": 15}'::jsonb);
