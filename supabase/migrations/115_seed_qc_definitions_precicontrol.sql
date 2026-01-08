-- ============================================================================
-- Seed QC Definitions for Roche PreciControl Materials
-- ============================================================================
-- Data sourced from NotebookLM with Roche Cobas c702/c501 performance studies
-- Unit conversions applied: SI → Conventional US units
-- ============================================================================

-- Link assay IDs (verified from assay_definitions table)
-- Glucose (Fasting): 8723bcb1-e734-498a-b38a-33c3c8ce31dc (mg/dL)
-- ALT (SGPT): 2d8ee4e4-20f3-4ba7-9d83-41ec1cb4b412 (U/L)
-- AST (SGOT): 39ac77f3-6665-4f4e-978b-1f022c3f177b (U/L)
-- Creatinine: c7ea74cc-e4fe-4458-ac2f-bb076baf86fa (mg/dL)
-- Total Cholesterol: 5488f239-e6bd-4656-a6dd-4bb2ce9e19ab (mg/dL)
-- Triglycerides: 9c9afab7-eb42-462d-a376-30d26c9365bf (mg/dL)
-- Urea Nitrogen (BUN): 3295e939-004f-4422-80b7-2224821c4fea (mg/dL)
-- Bilirubin, Total: 427f5e13-614e-4210-8ad5-15520f79cd38 (mg/dL)
-- Albumin: a8949191-cd29-4158-8779-28295fcf8d1b (g/dL)
-- HbA1C: 60b9ac5d-596c-4f88-97d1-340bc0581003 (%)

-- Link material IDs (verified from qc_materials table)
-- PreciControl ClinChem Multi 1 (normal): b1000001-0001-4000-8000-000000000001
-- PreciControl ClinChem Multi 2 (high): b1000001-0001-4000-8000-000000000002
-- PreciControl HbA1c (normal): b1000003-0001-4000-8000-000000000001
-- PreciControl HbA1c (high): b1000003-0001-4000-8000-000000000002

-- ============================================================================
-- PreciControl ClinChem Multi 1 (Normal Level)
-- ============================================================================

-- Glucose - Normal: 5.30 mmol/L = 95.4 mg/dL, CV 1.23%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '8723bcb1-e734-498a-b38a-33c3c8ce31dc',  -- Glucose (Fasting)
    'b1000001-0001-4000-8000-000000000001',  -- PreciControl ClinChem Multi 1
    95.4,   -- Mean (mg/dL)
    1.17,   -- SD (95.4 * 0.0123)
    20,     -- Standard 20 data points
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- ALT - Normal: 42 U/L, CV 2.70%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '2d8ee4e4-20f3-4ba7-9d83-41ec1cb4b412',  -- ALT (SGPT)
    'b1000001-0001-4000-8000-000000000001',
    42.0,   -- Mean (U/L)
    1.13,   -- SD (42 * 0.027)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- AST - Normal: 40 U/L, CV 1.67%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '39ac77f3-6665-4f4e-978b-1f022c3f177b',  -- AST (SGOT)
    'b1000001-0001-4000-8000-000000000001',
    40.0,   -- Mean (U/L)
    0.67,   -- SD (40 * 0.0167)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Creatinine - Normal: 85 μmol/L = 0.96 mg/dL, CV 2.22%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    'c7ea74cc-e4fe-4458-ac2f-bb076baf86fa',  -- Creatinine
    'b1000001-0001-4000-8000-000000000001',
    0.96,   -- Mean (mg/dL)
    0.021,  -- SD (0.96 * 0.0222)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Total Cholesterol - Normal: 4.50 mmol/L = 174 mg/dL, CV 1.00%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '5488f239-e6bd-4656-a6dd-4bb2ce9e19ab',  -- Total Cholesterol
    'b1000001-0001-4000-8000-000000000001',
    174.0,  -- Mean (mg/dL)
    1.74,   -- SD (174 * 0.01)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Triglycerides - Normal: 1.10 mmol/L = 97 mg/dL, CV 0.77%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '9c9afab7-eb42-462d-a376-30d26c9365bf',  -- Triglycerides
    'b1000001-0001-4000-8000-000000000001',
    97.0,   -- Mean (mg/dL)
    0.75,   -- SD (97 * 0.0077)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Urea (BUN) - Normal: 6.00 mmol/L = 16.8 mg/dL, CV 2.72%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '3295e939-004f-4422-80b7-2224821c4fea',  -- Urea Nitrogen (BUN)
    'b1000001-0001-4000-8000-000000000001',
    16.8,   -- Mean (mg/dL)
    0.46,   -- SD (16.8 * 0.0272)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Bilirubin Total - Normal: 15 μmol/L = 0.88 mg/dL, CV 3.61%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '427f5e13-614e-4210-8ad5-15520f79cd38',  -- Bilirubin, Total
    'b1000001-0001-4000-8000-000000000001',
    0.88,   -- Mean (mg/dL)
    0.032,  -- SD (0.88 * 0.0361)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Albumin - Normal: 42 g/L = 4.2 g/dL, CV 1.86%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    'a8949191-cd29-4158-8779-28295fcf8d1b',  -- Albumin
    'b1000001-0001-4000-8000-000000000001',
    4.2,    -- Mean (g/dL)
    0.078,  -- SD (4.2 * 0.0186)
    20,
    true,
    'Roche Cobas c501 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- PreciControl ClinChem Multi 2 (Pathological/High Level)
-- ============================================================================

-- Glucose - High: 15.50 mmol/L = 279 mg/dL, CV 1.60%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '8723bcb1-e734-498a-b38a-33c3c8ce31dc',  -- Glucose (Fasting)
    'b1000001-0001-4000-8000-000000000002',  -- PreciControl ClinChem Multi 2
    279.0,  -- Mean (mg/dL)
    4.46,   -- SD (279 * 0.016)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- ALT - High: 135 U/L, CV 1.46%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '2d8ee4e4-20f3-4ba7-9d83-41ec1cb4b412',  -- ALT (SGPT)
    'b1000001-0001-4000-8000-000000000002',
    135.0,  -- Mean (U/L)
    1.97,   -- SD (135 * 0.0146)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- AST - High: 130 U/L, CV 1.12%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '39ac77f3-6665-4f4e-978b-1f022c3f177b',  -- AST (SGOT)
    'b1000001-0001-4000-8000-000000000002',
    130.0,  -- Mean (U/L)
    1.46,   -- SD (130 * 0.0112)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Creatinine - High: 350 μmol/L = 3.96 mg/dL, CV 1.59%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    'c7ea74cc-e4fe-4458-ac2f-bb076baf86fa',  -- Creatinine
    'b1000001-0001-4000-8000-000000000002',
    3.96,   -- Mean (mg/dL)
    0.063,  -- SD (3.96 * 0.0159)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Total Cholesterol - High: 6.50 mmol/L = 251 mg/dL, CV 0.96%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '5488f239-e6bd-4656-a6dd-4bb2ce9e19ab',  -- Total Cholesterol
    'b1000001-0001-4000-8000-000000000002',
    251.0,  -- Mean (mg/dL)
    2.41,   -- SD (251 * 0.0096)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Triglycerides - High: 2.20 mmol/L = 195 mg/dL, CV 1.61%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '9c9afab7-eb42-462d-a376-30d26c9365bf',  -- Triglycerides
    'b1000001-0001-4000-8000-000000000002',
    195.0,  -- Mean (mg/dL)
    3.14,   -- SD (195 * 0.0161)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Urea (BUN) - High: 16.00 mmol/L = 44.8 mg/dL, CV 2.48%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '3295e939-004f-4422-80b7-2224821c4fea',  -- Urea Nitrogen (BUN)
    'b1000001-0001-4000-8000-000000000002',
    44.8,   -- Mean (mg/dL)
    1.11,   -- SD (44.8 * 0.0248)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Bilirubin Total - High: 50 μmol/L = 2.92 mg/dL, CV 1.51%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '427f5e13-614e-4210-8ad5-15520f79cd38',  -- Bilirubin, Total
    'b1000001-0001-4000-8000-000000000002',
    2.92,   -- Mean (mg/dL)
    0.044,  -- SD (2.92 * 0.0151)
    20,
    true,
    'Roche Cobas c702 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- Albumin - High (actually low pathological): 28 g/L = 2.8 g/dL, CV 2.11%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    'a8949191-cd29-4158-8779-28295fcf8d1b',  -- Albumin
    'b1000001-0001-4000-8000-000000000002',
    2.8,    -- Mean (g/dL) - pathologically low
    0.059,  -- SD (2.8 * 0.0211)
    20,
    true,
    'Roche Cobas c501 performance data. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- PreciControl HbA1c (Normal and Pathological Levels)
-- ============================================================================

-- HbA1c - Normal: 5.5%, CV 1.85%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '60b9ac5d-596c-4f88-97d1-340bc0581003',  -- HbA1C
    'b1000003-0001-4000-8000-000000000001',  -- PreciControl HbA1c Normal
    5.5,    -- Mean (%)
    0.10,   -- SD (5.5 * 0.0185)
    20,
    true,
    'Biological variation target CV 1.85%. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- HbA1c - Pathological: 9.8%, CV 1.50%
INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes)
VALUES (
    '60b9ac5d-596c-4f88-97d1-340bc0581003',  -- HbA1C
    'b1000003-0001-4000-8000-000000000002',  -- PreciControl HbA1c High
    9.8,    -- Mean (%)
    0.15,   -- SD (9.8 * 0.015)
    20,
    true,
    'Biological variation target CV 1.50%. Source: NotebookLM QC reference.'
) ON CONFLICT DO NOTHING;

-- ============================================================================
-- Verification query (run after migration)
-- ============================================================================
-- SELECT
--     qd.mean,
--     qd.sd,
--     ROUND((qd.sd/qd.mean*100)::numeric, 2) as cv_pct,
--     ad.name as assay_name,
--     ad.units,
--     qm.name as material_name,
--     qm.level
-- FROM qc_definitions qd
-- JOIN assay_definitions ad ON qd.assay_id = ad.id
-- JOIN qc_materials qm ON qd.material_id = qm.id
-- WHERE qm.name LIKE 'PreciControl%'
-- ORDER BY qm.name, ad.name;
