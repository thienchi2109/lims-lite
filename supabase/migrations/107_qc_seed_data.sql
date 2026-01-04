-- Migration: 107_qc_seed_data.sql
-- Description: Seed QC materials and definitions with realistic clinical chemistry data
-- Source: NotebookLM Westgard IQC Quality Control Guide (Bio-Rad, Roche specifications)
-- Created: 2026-01-04
--
-- This migration seeds the QC system with practical data for testing and demonstration.
-- Based on Bio-Rad Lyphochek® Assayed Chemistry Control specifications.

-- ============================================================================
-- QC MATERIALS - Bio-Rad Lyphochek Assayed Chemistry Control
-- ============================================================================

INSERT INTO qc_materials (id, name, lot_number, level, manufacturer, expiration_date, notes, created_by)
VALUES
    -- Level 1 (Normal Range)
    (
        'a0000001-0000-0000-0000-000000000001',
        'Lyphochek® Assayed Chemistry Control',
        '49041721',
        'normal',
        'Bio-Rad Laboratories',
        '2027-06-30',
        'Level 1 (Normal) - For routine clinical chemistry QC. Store at 2-8°C.',
        '00000000-0000-0000-0000-000000000000'
    ),
    -- Level 2 (Abnormal/Pathological Range)
    (
        'a0000001-0000-0000-0000-000000000002',
        'Lyphochek® Assayed Chemistry Control',
        '49041722',
        'high',
        'Bio-Rad Laboratories',
        '2027-06-30',
        'Level 2 (Abnormal/Pathological) - For routine clinical chemistry QC. Store at 2-8°C.',
        '00000000-0000-0000-0000-000000000000'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- ============================================================================
-- QC DEFINITIONS - Control Limits based on NotebookLM Westgard research
-- ============================================================================
-- Formula: SD = Mean × (CV% / 100)
-- Source: Bio-Rad educational materials, Roche Cobas c702 performance data

-- Helper function to get assay_id by name (first match)
DO $$
DECLARE
    v_manager_id UUID := '00000000-0000-0000-0000-000000000000';
    v_material_l1 UUID := 'a0000001-0000-0000-0000-000000000001';
    v_material_l2 UUID := 'a0000001-0000-0000-0000-000000000002';
    v_assay_id UUID;
BEGIN
    -- ==========================================================
    -- GLUCOSE (Fasting) - mg/dL
    -- L1: Mean=100, CV=1.5% → SD=1.5
    -- L2: Mean=250, CV=1.6% → SD=4.0
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Glucose (Fasting)' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 100.0, 1.5, 20, true, 'Glucose L1 - Based on Roche Cobas c702 CV 1.23-1.59%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 250.0, 4.0, 20, true, 'Glucose L2 - Based on Roche Cobas c702 CV 1.53-1.60%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- CHOLESTEROL (Total) - mg/dL
    -- L1: Mean=200, SD=4.0 (CV=2.0%) - from Bio-Rad educational example
    -- L2: Mean=250, SD=5.0 (CV=2.0%) - from Bio-Rad educational example
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Total Cholesterol' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 200.0, 4.0, 20, true, 'Cholesterol L1 - Bio-Rad educational example CV 2.0%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 250.0, 5.0, 20, true, 'Cholesterol L2 - Bio-Rad educational example CV 2.0%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- TRIGLYCERIDES - mg/dL
    -- L1: Mean=120, CV=1.5% → SD=1.8
    -- L2: Mean=280, CV=2.2% → SD=6.2
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Triglycerides' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 120.0, 1.8, 20, true, 'Triglycerides L1 - Based on Roche Cobas c702 CV 0.77-1.83%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 280.0, 6.2, 20, true, 'Triglycerides L2 - Based on Roche Cobas c702 CV 1.61-2.73%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- CREATININE - mg/dL
    -- L1: Mean=1.2, CV=2.4% → SD=0.029
    -- L2: Mean=5.5, CV=2.0% → SD=0.11
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Creatinine' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 1.2, 0.03, 20, true, 'Creatinine L1 - Based on Roche Cobas c702 CV 2.22-2.52%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 5.5, 0.11, 20, true, 'Creatinine L2 - Based on Roche Cobas c702 CV 1.59-2.38%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- ALT (SGPT) - U/L
    -- L1: Mean=35, CV=4.5% → SD=1.6
    -- L2: Mean=120, CV=2.0% → SD=2.4
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'ALT (SGPT)' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 35.0, 1.6, 20, true, 'ALT L1 - Based on Roche Cobas c702 CV 4.03-4.66%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 120.0, 2.4, 20, true, 'ALT L2 - Based on Roche Cobas c702 CV 1.96%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- AST (SGOT) - U/L
    -- L1: Mean=32, CV=4.5% → SD=1.4
    -- L2: Mean=150, CV=3.0% → SD=4.5
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'AST (SGOT)' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 32.0, 1.4, 20, true, 'AST L1 - Based on Roche Cobas c702 CV 3.38-5.80%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 150.0, 4.5, 20, true, 'AST L2 - Based on Roche Cobas c702 CV 2.25-3.63%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- HEMOGLOBIN - g/dL
    -- L1: Mean=12.5, CV=1.4% → SD=0.18
    -- L2: Mean=17.0, CV=1.4% → SD=0.24
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Hemoglobin (Hb)' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 12.5, 0.18, 20, true, 'Hemoglobin L1 - Desirable CV 1.4% per biological variation', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 17.0, 0.24, 20, true, 'Hemoglobin L2 - Desirable CV 1.4% per biological variation', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- HbA1C - % (NGSP)
    -- L1: Mean=5.5, CV=0.9% → SD=0.05
    -- L2: Mean=9.0, CV=0.9% → SD=0.08
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'HbA1C' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 5.5, 0.05, 20, true, 'HbA1C L1 - NGSP desirable precision 0.9%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 9.0, 0.08, 20, true, 'HbA1C L2 - NGSP desirable precision 0.9%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- BILIRUBIN TOTAL - mg/dL
    -- L1: Mean=1.0, CV=4.0% → SD=0.04
    -- L2: Mean=8.0, CV=3.5% → SD=0.28
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Bilirubin, Total' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 1.0, 0.04, 20, true, 'Bilirubin Total L1 - Typical CV 4.0%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 8.0, 0.28, 20, true, 'Bilirubin Total L2 - Typical CV 3.5%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- UREA NITROGEN (BUN) - mg/dL
    -- L1: Mean=15, CV=3.0% → SD=0.45
    -- L2: Mean=60, CV=2.5% → SD=1.5
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Urea Nitrogen (BUN)' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 15.0, 0.45, 20, true, 'BUN L1 - Typical CV 3.0%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 60.0, 1.5, 20, true, 'BUN L2 - Typical CV 2.5%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- HDL CHOLESTEROL - mg/dL
    -- L1: Mean=50, CV=2.5% → SD=1.25
    -- L2: Mean=80, CV=2.2% → SD=1.76
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'HDL Cholesterol' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 50.0, 1.25, 20, true, 'HDL L1 - Typical CV 2.5%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 80.0, 1.76, 20, true, 'HDL L2 - Typical CV 2.2%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- LDL CHOLESTEROL - mg/dL
    -- L1: Mean=100, CV=3.0% → SD=3.0
    -- L2: Mean=180, CV=2.8% → SD=5.04
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'LDL Cholesterol' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 100.0, 3.0, 20, true, 'LDL L1 - Typical CV 3.0%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 180.0, 5.04, 20, true, 'LDL L2 - Typical CV 2.8%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    -- ==========================================================
    -- ALBUMIN - g/dL
    -- L1: Mean=3.8, CV=2.0% → SD=0.076
    -- L2: Mean=5.5, CV=1.8% → SD=0.099
    -- ==========================================================
    SELECT id INTO v_assay_id FROM assay_definitions WHERE name = 'Albumin' LIMIT 1;
    IF v_assay_id IS NOT NULL THEN
        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l1, 3.8, 0.08, 20, true, 'Albumin L1 - Typical CV 2.0%', v_manager_id)
        ON CONFLICT DO NOTHING;

        INSERT INTO qc_definitions (assay_id, material_id, mean, sd, data_points_count, is_active, notes, created_by)
        VALUES (v_assay_id, v_material_l2, 5.5, 0.10, 20, true, 'Albumin L2 - Typical CV 1.8%', v_manager_id)
        ON CONFLICT DO NOTHING;
    END IF;

    RAISE NOTICE 'QC seed data inserted successfully';
END $$;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
DO $$
DECLARE
    v_materials_count INT;
    v_definitions_count INT;
BEGIN
    SELECT COUNT(*) INTO v_materials_count FROM qc_materials WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO v_definitions_count FROM qc_definitions WHERE is_active = true;

    RAISE NOTICE 'QC Materials: %, QC Definitions: %', v_materials_count, v_definitions_count;
END $$;

-- Add helpful comment
COMMENT ON TABLE qc_materials IS 'QC control materials for Westgard IQC. Seeded with Bio-Rad Lyphochek data.';
COMMENT ON TABLE qc_definitions IS 'QC control limits (mean, SD) per assay-material pair. Seeded with clinical chemistry specifications from NotebookLM Westgard guide.';
