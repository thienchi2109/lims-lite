-- Migration 050: Seed new assays and specialties
-- Generated from @docs/new_assays_specialties.md

SET search_path TO public;

DO $$ 
DECLARE
    v_bio_id UUID;
    v_imm_id UUID;
    v_hem_id UUID;
    v_mol_id UUID;
    v_cyto_id UUID;
    v_uri_id UUID;
    v_mic_id UUID;
    v_chem_id UUID;
BEGIN
    -- 1. Setup Specialties
    ---------------------------------------------------------------------------
    
    -- Existing ones
    SELECT id INTO v_bio_id FROM lab_specialties WHERE code = 'BIO';
    SELECT id INTO v_imm_id FROM lab_specialties WHERE code = 'IMM';
    SELECT id INTO v_hem_id FROM lab_specialties WHERE code = 'HEM';
    SELECT id INTO v_mol_id FROM lab_specialties WHERE code = 'MOL';
    SELECT id INTO v_chem_id FROM lab_specialties WHERE code = 'CHEM';
    
    -- Update 'Vi sinh' name and get ID
    SELECT id INTO v_mic_id FROM lab_specialties WHERE code = 'MIC';
    IF v_mic_id IS NOT NULL THEN
        UPDATE lab_specialties 
        SET name = 'Vi sinh/Ký sinh/Vi nấm' 
        WHERE id = v_mic_id AND name != 'Vi sinh/Ký sinh/Vi nấm';
    ELSE
        INSERT INTO lab_specialties (name, code) VALUES ('Vi sinh/Ký sinh/Vi nấm', 'MIC') RETURNING id INTO v_mic_id;
    END IF;

    -- Create 'Tế bào học' (CYTO) if not exists
    SELECT id INTO v_cyto_id FROM lab_specialties WHERE code = 'CYTO';
    IF v_cyto_id IS NULL THEN
        INSERT INTO lab_specialties (name, code) VALUES ('Tế bào học', 'CYTO') RETURNING id INTO v_cyto_id;
    END IF;
    
    -- Create 'Nước tiểu' (URI) if not exists
    SELECT id INTO v_uri_id FROM lab_specialties WHERE code = 'URI';
    IF v_uri_id IS NULL THEN
        INSERT INTO lab_specialties (name, code) VALUES ('Nước tiểu', 'URI') RETURNING id INTO v_uri_id;
    END IF;

    -- 2. Insert Assays
    ---------------------------------------------------------------------------

    -- Specialty: BIO
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Glucose' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Glucose', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HbA1C' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HbA1C', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Cholesterol' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Cholesterol', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HDL-Cholesterol' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HDL-Cholesterol', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'LDL-Cholesterol' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('LDL-Cholesterol', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Triglyceride' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Triglyceride', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'SGOT' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('SGOT', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'SGPT' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('SGPT', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'GGT' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('GGT', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Creatinine' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Creatinine', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Urea' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Urea', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Acid Uric' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Acid Uric', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Calcium' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Calcium', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Albumin' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Albumin', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Protein total' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Protein total', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Total - Bilirubin' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Total - Bilirubin', v_bio_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Direct - Bilirubin' AND specialty_id = v_bio_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Direct - Bilirubin', v_bio_id);
    END IF;

    -- Specialty: IMM
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Anti-H.Pylori' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Anti-H.Pylori', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBsAg định lượng' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBsAg định lượng', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Anti-HBs định lượng' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Anti-HBs định lượng', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'T3' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('T3', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'FT3' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('FT3', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'T4' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('T4', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'FT4' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('FT4', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'TSH' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('TSH', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'CA 15-3' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('CA 15-3', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'CA 125' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('CA 125', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBsAg' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBsAg', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBsAb' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBsAb', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBsAg định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBsAg định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBsAb định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBsAb định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Anti HCV' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Anti HCV', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBeAg' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBeAg', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HAV - IgM' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HAV - IgM', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HEV - IgM' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HEV - IgM', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Anti HCV' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Anti HCV', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Syphilis (Giang mai)' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Syphilis (Giang mai)', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'TPHA định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('TPHA định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'TPHA định lượng' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('TPHA định lượng', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'RPR định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('RPR định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Đếm số lượng tế bào CD3/CD4/CD8' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Đếm số lượng tế bào CD3/CD4/CD8', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HIV miễn dịch bán tự động' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HIV miễn dịch bán tự động', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HIV Ag/Ab định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HIV Ag/Ab định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HIV khẳng định' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HIV khẳng định', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Chlamidia định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Chlamidia định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HCV định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HCV định tính', v_imm_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Gonorrhoeae định tính' AND specialty_id = v_imm_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Gonorrhoeae định tính', v_imm_id);
    END IF;

    -- Specialty: CYTO
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Tầm soát ung thư cổ tử cung' AND specialty_id = v_cyto_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Tầm soát ung thư cổ tử cung', v_cyto_id);
    END IF;

    -- Specialty: HEM
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Tổng phân tích tế bào máu 18 thông số' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Tổng phân tích tế bào máu 18 thông số', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'WBC' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('WBC', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'RBC' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('RBC', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HGB' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HGB', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HCT' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HCT', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MCV' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MCV', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MCH' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MCH', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MCHC' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MCHC', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'PLT' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('PLT', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'LYM%' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('LYM%', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MXD%' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MXD%', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'NEUT%' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('NEUT%', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'LYM#' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('LYM#', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MXD#' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MXD#', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'NEUT#' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('NEUT#', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'RDW-CV' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('RDW-CV', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'PDW' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('PDW', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MPV' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MPV', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'PCT' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('PCT', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Định nhóm máu' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Định nhóm máu', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Tổng phân tích tế bào máu 18 thông số' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Tổng phân tích tế bào máu 18 thông số', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'WBC' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('WBC', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'RBC' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('RBC', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HGB' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HGB', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HCT' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HCT', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MCV' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MCV', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MCH' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MCH', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MCHC' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MCHC', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'PLT' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('PLT', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'LYM%' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('LYM%', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MO%' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MO%', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'GR%' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('GR%', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'LYM#' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('LYM#', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MO#' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MO#', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'GR#' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('GR#', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'RDW-CV' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('RDW-CV', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'PCT' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('PCT', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MPV' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MPV', v_hem_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'PDW' AND specialty_id = v_hem_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('PDW', v_hem_id);
    END IF;

    -- Specialty: MOL
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HIV đo tải lượng hệ thống tự động' AND specialty_id = v_mol_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HIV đo tải lượng hệ thống tự động', v_mol_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'HBV đo tải lượng Realtime-PCR' AND specialty_id = v_mol_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('HBV đo tải lượng Realtime-PCR', v_mol_id);
    END IF;

    -- Specialty: URI
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Tổng phân tích nước tiểu' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Tổng phân tích nước tiểu', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'BLD' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('BLD', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'BIL' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('BIL', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'URO' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('URO', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'KETON' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('KETON', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Protein total' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Protein total', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'NIT' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('NIT', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Glucose' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Glucose', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'pH' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('pH', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'S,G' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('S,G', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'LEU' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('LEU', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Heroin/Mophine' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Heroin/Mophine', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Amphetamin (Chất kích thích)' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Amphetamin (Chất kích thích)', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'MarijuaNa-te (Cần sa)' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('MarijuaNa-te (Cần sa)', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Methamphetamin (Chất kích thích tổng hợp)' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Methamphetamin (Chất kích thích tổng hợp)', v_uri_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Nanosign DOA (4 in 1)' AND specialty_id = v_uri_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Nanosign DOA (4 in 1)', v_uri_id);
    END IF;

    -- Specialty: MIC
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Sán dải chó (Echinococus)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Sán dải chó (Echinococus)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Giun đũa chó (Toxocara)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Giun đũa chó (Toxocara)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Ấu trùng sán dải (Cysticercus)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Ấu trùng sán dải (Cysticercus)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Giun lươn (Strongyloides)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Giun lươn (Strongyloides)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Sán lá gan (Fasciola)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Sán lá gan (Fasciola)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Amip (E.Histolytica)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Amip (E.Histolytica)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Giun đũa' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Giun đũa', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Giun móc' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Giun móc', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Giun kim' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Giun kim', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Sán dây (Taenia SP)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Sán dây (Taenia SP)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Ký sinh trùng sốt rét' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Ký sinh trùng sốt rét', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Ấu trùng giun chỉ bạch huyết' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Ấu trùng giun chỉ bạch huyết', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Salmonella (Thương hàn)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Salmonella (Thương hàn)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Shigella (Lỵ trực trùng)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Shigella (Lỵ trực trùng)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Vibrio cholera (Tả)' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Vibrio cholera (Tả)', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Não mô cầu' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Não mô cầu', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Vi khuẩn bạch hầu' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Vi khuẩn bạch hầu', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Vi phế cầu khuẩn' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Vi phế cầu khuẩn', v_mic_id);
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM assay_definitions WHERE name = 'Tụ cầu' AND specialty_id = v_mic_id
    ) THEN
        INSERT INTO assay_definitions (name, specialty_id) VALUES ('Tụ cầu', v_mic_id);
    END IF;

END $$;