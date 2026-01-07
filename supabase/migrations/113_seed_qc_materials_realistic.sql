-- Migration: Seed qc_materials with realistic QC control materials
-- Based on Vietnamese clinical laboratory practices (Roche Cobas, Bio-Rad)
-- Source: NotebookLM research on QC materials used in Vietnam hospitals

-- ============================================================================
-- SEED QC MATERIALS
-- ============================================================================

-- Roche PreciControl ClinChem Multi (Clinical Chemistry)
-- Used for: Glucose, ALT, AST, Cholesterol, Urea, Creatinine
INSERT INTO qc_materials (
    id, name, manufacturer, lot_number, level, level_normalized,
    expiration_date, concentration_value, concentration_unit, notes
) VALUES
    (
        'b1000001-0001-4000-8000-000000000001',
        'PreciControl ClinChem Multi 1',
        'Roche Diagnostics',
        '604821',
        'normal',
        'L1',
        '2026-05-31',
        NULL,
        NULL,
        'Level 1 (Normal) - Lyophilized serum for routine clinical chemistry on Cobas analyzers'
    ),
    (
        'b1000001-0001-4000-8000-000000000002',
        'PreciControl ClinChem Multi 2',
        'Roche Diagnostics',
        '604822',
        'high',
        'L2',
        '2026-05-31',
        NULL,
        NULL,
        'Level 2 (Pathological) - Lyophilized serum for routine clinical chemistry on Cobas analyzers'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- Bio-Rad Lyphochek Assayed Chemistry Control (Third-party QC)
-- Used for: Independent verification of Glucose, Creatinine, Electrolytes
INSERT INTO qc_materials (
    id, name, manufacturer, lot_number, level, level_normalized,
    expiration_date, concentration_value, concentration_unit, notes
) VALUES
    (
        'b1000002-0001-4000-8000-000000000001',
        'Lyphochek Assayed Chemistry Control',
        'Bio-Rad Laboratories',
        '49520',
        'normal',
        'L1',
        '2025-11-30',
        NULL,
        NULL,
        'Level 1 (Normal) - Third-party QC for clinical chemistry verification'
    ),
    (
        'b1000002-0001-4000-8000-000000000002',
        'Lyphochek Assayed Chemistry Control',
        'Bio-Rad Laboratories',
        '49521',
        'high',
        'L2',
        '2025-11-30',
        NULL,
        NULL,
        'Level 2 (Abnormal) - Third-party QC for clinical chemistry verification'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- Roche PreciControl HbA1c (Diabetes Monitoring)
INSERT INTO qc_materials (
    id, name, manufacturer, lot_number, level, level_normalized,
    expiration_date, concentration_value, concentration_unit, notes
) VALUES
    (
        'b1000003-0001-4000-8000-000000000001',
        'PreciControl HbA1c',
        'Roche Diagnostics',
        '182930',
        'normal',
        'L1',
        '2025-08-31',
        5.5,
        '%',
        'Level 1 (Normal) - Whole blood control for HbA1c testing'
    ),
    (
        'b1000003-0001-4000-8000-000000000002',
        'PreciControl HbA1c',
        'Roche Diagnostics',
        '182931',
        'high',
        'L2',
        '2025-08-31',
        9.8,
        '%',
        'Level 2 (Pathological) - Whole blood control for HbA1c testing'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- Roche PreciControl Universal (Immunoassay - TSH, Hormones)
INSERT INTO qc_materials (
    id, name, manufacturer, lot_number, level, level_normalized,
    expiration_date, concentration_value, concentration_unit, notes
) VALUES
    (
        'b1000004-0001-4000-8000-000000000001',
        'PreciControl Universal',
        'Roche Diagnostics',
        '204419',
        'low',
        'L1',
        '2025-12-31',
        1.15,
        'μIU/mL',
        'Level 1 (Low/Normal) - For TSH and thyroid panel immunoassays'
    ),
    (
        'b1000004-0001-4000-8000-000000000002',
        'PreciControl Universal',
        'Roche Diagnostics',
        '204420',
        'high',
        'L2',
        '2025-12-31',
        9.50,
        'μIU/mL',
        'Level 2 (High) - For TSH and thyroid panel immunoassays'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- Roche PreciControl Tumor Marker (Oncology markers)
INSERT INTO qc_materials (
    id, name, manufacturer, lot_number, level, level_normalized,
    expiration_date, concentration_value, concentration_unit, notes
) VALUES
    (
        'b1000005-0001-4000-8000-000000000001',
        'PreciControl Tumor Marker',
        'Roche Diagnostics',
        '305510',
        'normal',
        'L1',
        '2026-03-31',
        NULL,
        NULL,
        'Level 1 (Normal) - For AFP, CEA, CA 19-9, PSA tumor markers'
    ),
    (
        'b1000005-0001-4000-8000-000000000002',
        'PreciControl Tumor Marker',
        'Roche Diagnostics',
        '305511',
        'high',
        'L2',
        '2026-03-31',
        NULL,
        NULL,
        'Level 2 (Pathological) - For AFP, CEA, CA 19-9, PSA tumor markers'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- Bio-Rad Liquichek Immunoassay Plus Control (Third-party immunoassay QC)
INSERT INTO qc_materials (
    id, name, manufacturer, lot_number, level, level_normalized,
    expiration_date, concentration_value, concentration_unit, notes
) VALUES
    (
        'b1000006-0001-4000-8000-000000000001',
        'Liquichek Immunoassay Plus Control',
        'Bio-Rad Laboratories',
        '62150',
        'normal',
        'L1',
        '2026-02-28',
        NULL,
        NULL,
        'Level 1 - Third-party QC for immunoassay verification (TSH, FT4, Ferritin)'
    ),
    (
        'b1000006-0001-4000-8000-000000000002',
        'Liquichek Immunoassay Plus Control',
        'Bio-Rad Laboratories',
        '62151',
        'high',
        'L2',
        '2026-02-28',
        NULL,
        NULL,
        'Level 2 - Third-party QC for immunoassay verification (TSH, FT4, Ferritin)'
    ),
    (
        'b1000006-0001-4000-8000-000000000003',
        'Liquichek Immunoassay Plus Control',
        'Bio-Rad Laboratories',
        '62152',
        'low',
        'L1',
        '2026-02-28',
        NULL,
        NULL,
        'Level 3 (Low) - Third-party QC for immunoassay verification'
    )
ON CONFLICT (lot_number) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    material_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO material_count FROM qc_materials WHERE deleted_at IS NULL;
    RAISE NOTICE 'QC Materials seeded successfully. Total active materials: %', material_count;
END $$;
