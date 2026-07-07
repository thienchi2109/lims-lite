-- Add nullable clinical reference ranges for CoA rendering.
--
-- Security impact:
-- - No RLS policies, grants, or SECURITY DEFINER functions are changed.
-- - Adds nullable TEXT metadata to the existing assay catalog.
-- - Backfill is scoped to active assay_definitions matched by specialty code and assay name.
-- - Ambiguous duplicate source rows are intentionally left NULL rather than guessed.

ALTER TABLE public.assay_definitions
ADD COLUMN IF NOT EXISTS normal_range TEXT;

COMMENT ON COLUMN public.assay_definitions.normal_range IS
    'Clinical reference range text displayed on Certificate of Analysis result rows.';

WITH reference_ranges(specialty_code, assay_name, normal_range) AS (
    VALUES
    ('BIO', 'Acid Uric', 'Nam: 208 - 428 µmol/L
Nữ: 155 - 357 µmol/L'),
    ('BIO', 'ALT (SGPT)', 'Nam: < 50 U/L
Nữ: < 35 U/L'),
    ('BIO', 'AST (SGOT)', 'Nam: < 50 U/L
Nữ: < 35 U/L'),
    ('BIO', 'Calcium', '2,20 - 2,56 mmol/L'),
    ('BIO', 'Cholesterol', '< 5,2 mmol/L'),
    ('BIO', 'Direct - Bilirubin', '< 3,4 µmol/L'),
    ('BIO', 'GGT', 'Nam: < 55 U/L
Nữ: < 38 U/L'),
    ('BIO', 'Glucose', '4,1 - 5,9 mmol/L'),
    ('BIO', 'HbA1C', '4,0 - 6,0%'),
    ('BIO', 'Protein total', '66 - 83 g/L'),
    ('BIO', 'SGOT', 'Nam: < 50 U/L
Nữ: < 35 U/L'),
    ('BIO', 'SGPT', 'Nam: < 50 U/L
Nữ: < 35 U/L'),
    ('BIO', 'Total - Bilirubin', '5 - 21 µmol/L'),
    ('BIO', 'Triglyceride', 'Nam: 0,45 - 1,81 mmol/L
Nữ: 0,40 - 1,53 mmol/L'),
    ('BIO', 'Urea', '2,8 - 7,2 mmol/L'),
    ('CYTO', 'Tầm soát ung thư cổ tử cung', 'Âm tính'),
    ('HEM', 'Định nhóm máu', 'Phân loại: A/B/AB/O'),
    ('HEM', 'GR#', '(1,7 - 7,7) x 10^3/µL'),
    ('HEM', 'GR%', '42 - 85 %'),
    ('HEM', 'Hematocrit (Hct)', '37,0 - 54,0%'),
    ('HEM', 'Hemoglobin (Hb)', '11,0 - 16,0 g/dL'),
    ('HEM', 'MO#', '(0,0 - 0,9) x 10^3/µL'),
    ('HEM', 'MO%', '0 - 10 %'),
    ('HEM', 'MXD#', '(0,0 - 1,2) x 10^3/µL'),
    ('HEM', 'MXD%', '3,0 - 10,0%'),
    ('HEM', 'NEUT#', '(1,5 - 7,0) x 10^3/µL'),
    ('HEM', 'NEUT%', '45,0 - 95,0%'),
    ('HEM', 'Platelet Count', '(150 - 400) x 10^3/µL'),
    ('HEM', 'RBC Count', '(3,5 - 5,5) x 10^6/µL'),
    ('HEM', 'WBC Count', '(4,0 - 10,0) x 10^3/µL'),
    ('IMM', 'Anti-H.Pylori', 'Âm tính'),
    ('IMM', 'Anti-HBs định lượng', '2,0 - 10 IU/L'),
    ('IMM', 'CA 125', '< 35 U/mL'),
    ('IMM', 'CA 15-3', '< 28 U/mL'),
    ('IMM', 'Chlamidia định tính', 'Âm tính'),
    ('IMM', 'Đếm số lượng tế bào CD3/CD4/CD8', '(407 - 1404) tế bào/mm^3'),
    ('IMM', 'FT3', '2,2 - 4,4 pg/mL'),
    ('IMM', 'FT4', '12 - 22 pmol/L'),
    ('IMM', 'Gonorrhoeae định tính', 'Âm tính'),
    ('IMM', 'HAV - IgM', 'Âm tính'),
    ('IMM', 'HBeAg', 'Âm tính'),
    ('IMM', 'HBsAb', '0 - 10 IU/mL'),
    ('IMM', 'HBsAb định tính', 'Âm tính'),
    ('IMM', 'HBsAg', 'Neg < 0,9 S/CO
Pos > 1,1 S/CO'),
    ('IMM', 'HBsAg định lượng', '< 0,9 COI'),
    ('IMM', 'HBsAg định tính', 'Âm tính'),
    ('IMM', 'HCV định tính', 'Âm tính'),
    ('IMM', 'HEV - IgM', 'Âm tính'),
    ('IMM', 'HIV Ag/Ab định tính', 'Âm tính'),
    ('IMM', 'HIV khẳng định', 'Âm tính'),
    ('IMM', 'RPR định tính', 'Âm tính'),
    ('IMM', 'Syphilis (Giang mai)', 'Âm tính'),
    ('IMM', 'T3', '1,3 - 3,1 mmol/mL'),
    ('IMM', 'T4', '66 - 181 nmol/L'),
    ('IMM', 'TPHA định lượng', 'Âm tính'),
    ('IMM', 'TPHA định tính', 'Âm tính'),
    ('IMM', 'TSH', '0,27 - 4,2 µIU/mL'),
    ('MIC', 'Amip (E.Histolytica)', 'Neg < 0,1 OD
Pos > 0,5 OD'),
    ('MIC', 'Ấu trùng giun chỉ bạch huyết', 'Âm tính'),
    ('MIC', 'Ấu trùng sán dải (Cysticercus)', 'Neg < 0,1 OD
Pos > 0,5 OD'),
    ('MIC', 'Giun đũa', 'Âm tính'),
    ('MIC', 'Giun đũa chó (Toxocara)', 'Neg < 0,1 OD
Pos > 0,5 OD'),
    ('MIC', 'Giun kim', 'Âm tính'),
    ('MIC', 'Giun lươn (Strongyloides)', 'Neg < 0,2 OD
Pos > 0,5 OD'),
    ('MIC', 'Giun móc', 'Âm tính'),
    ('MIC', 'Ký sinh trùng sốt rét', 'Âm tính'),
    ('MIC', 'Não mô cầu', 'Âm tính'),
    ('MIC', 'Salmonella (Thương hàn)', 'Âm tính'),
    ('MIC', 'Sán dải chó (Echinococus)', 'Neg < 0,2 OD
Pos > 0,5 OD'),
    ('MIC', 'Sán dây (Taenia SP)', 'Âm tính'),
    ('MIC', 'Sán lá gan (Fasciola)', 'Neg < 0,1 OD
Pos > 0,5 OD'),
    ('MIC', 'Shigella (Lỵ trực trùng)', 'Âm tính'),
    ('MIC', 'Tụ cầu', 'Âm tính'),
    ('MIC', 'Vi khuẩn bạch hầu', 'Âm tính'),
    ('MIC', 'Vi phế cầu khuẩn', 'Âm tính'),
    ('MIC', 'Vibrio cholera (Tả)', 'Âm tính'),
    ('MOL', 'HBV đo tải lượng Realtime-PCR', '50 - 14 x 10^9'),
    ('MOL', 'HIV đo tải lượng hệ thống tự động', '20 - 4,18 x 10^9'),
    ('URI', 'Amphetamin (Chất kích thích)', 'Âm tính'),
    ('URI', 'BIL', 'Âm tính'),
    ('URI', 'BLD', 'Âm tính'),
    ('URI', 'Glucose', 'Âm tính'),
    ('URI', 'Heroin/Mophine', 'Âm tính'),
    ('URI', 'KETON', 'Âm tính'),
    ('URI', 'LEU', 'Âm tính'),
    ('URI', 'MarijuaNa-te (Cần sa)', 'Âm tính'),
    ('URI', 'Methamphetamin (Chất kích thích tổng hợp)', 'Âm tính'),
    ('URI', 'Nanosign DOA (4 in 1)', 'Âm tính'),
    ('URI', 'NIT', 'Âm tính'),
    ('URI', 'pH', '4,8 - 7,4'),
    ('URI', 'Protein total', 'Âm tính'),
    ('URI', 'S,G', '1,015 - 1,03'),
    ('URI', 'URO', 'Norm')
)
UPDATE public.assay_definitions AS assay
SET normal_range = reference_ranges.normal_range,
    updated_at = now()
FROM reference_ranges
JOIN public.lab_specialties AS specialty
    ON specialty.code = reference_ranges.specialty_code
WHERE assay.specialty_id = specialty.id
  AND assay.name = reference_ranges.assay_name
  AND assay.deleted_at IS NULL
  AND assay.normal_range IS DISTINCT FROM reference_ranges.normal_range;
