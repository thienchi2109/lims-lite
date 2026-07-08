-- Backfill assay-owned method names for active assay definitions.
-- Security impact:
-- - No RLS policies, privileges, or SECURITY DEFINER functions are changed.
-- - Updates only nullable assay_definitions.method_name text for active rows that are still blank.
-- - Source data is limited to docs/assays_definition.md exact rows and explicit alias matches for renamed assays.

SET search_path TO public;

DO $$
DECLARE
    v_updated_count integer;
    v_remaining_blank_count integer;
BEGIN
    WITH method_backfill(specialty_name, assay_name, method_name, source_note) AS (
        VALUES
        ('Huyết học', 'Định nhóm máu', 'Phản ứng Latex', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'GR#', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'GR%', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'HCT', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'Hematocrit (Hct)', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md alias: HCT'),
        ('Huyết học', 'Hemoglobin (Hb)', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md alias: HGB'),
        ('Huyết học', 'HGB', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'LYM#', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'LYM%', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MCH', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MCHC', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MCV', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MO#', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MO%', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MPV', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MXD#', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'MXD%', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'NEUT#', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'NEUT%', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'PCT', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'PDW', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'Platelet Count', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md alias: PLT'),
        ('Huyết học', 'PLT', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'RBC', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'RBC Count', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md alias: RBC'),
        ('Huyết học', 'RDW-CV', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'WBC', 'Máy huyết học Sysmex xp-100', 'docs/assays_definition.md exact row'),
        ('Huyết học', 'WBC Count', 'Máy huyết học Nihon Kohden', 'docs/assays_definition.md alias: WBC'),
        ('Miễn dịch', 'Anti-H.Pylori', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'Anti-HBs định lượng', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'CA 125', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'CA 15-3', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'Chlamidia định tính', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'Đếm số lượng tế bào CD3/CD4/CD8', 'Phân tích dòng chảy tế bào/Patec - Cyflow counter', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'FT3', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'FT4', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'Gonorrhoeae định tính', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HAV - IgM', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HBeAg', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HBsAb', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HBsAb định tính', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HBsAg', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HBsAg định lượng', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HBsAg định tính', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HCV định tính', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HEV - IgM', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HIV Ag/Ab định tính', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HIV khẳng định', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'HIV miễn dịch bán tự động', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'RPR định tính', 'Ngưng kết hạt', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'Syphilis (Giang mai)', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'T3', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'T4', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'TPHA định lượng', 'Ngưng kết hạt', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'TPHA định tính', 'Ngưng kết hạt', 'docs/assays_definition.md exact row'),
        ('Miễn dịch', 'TSH', 'Máy Miễn dịch tự động Cobas e411', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'Amphetamin (Chất kích thích)', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'BIL', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'BLD', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'Glucose', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'Heroin/Mophine', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'KETON', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'LEU', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'MarijuaNa-te (Cần sa)', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'Methamphetamin (Chất kích thích tổng hợp)', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'Nanosign DOA (4 in 1)', 'Test nhanh', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'NIT', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'pH', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'Protein total', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'S,G', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Nước tiểu', 'URO', 'Máy phân tích nước tiểu UroMeter 120', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Acid Uric', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Albumin', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'ALT (SGPT)', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: SGPT'),
        ('Sinh hóa', 'AST (SGOT)', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: SGOT'),
        ('Sinh hóa', 'Bilirubin, Total', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: Total - Bilirubin'),
        ('Sinh hóa', 'Calcium', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Cholesterol', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Creatinine', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Direct - Bilirubin', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'GGT', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Glucose', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Glucose (Fasting)', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: Glucose'),
        ('Sinh hóa', 'HbA1C', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'HDL Cholesterol', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: HDL-Cholesterol'),
        ('Sinh hóa', 'LDL Cholesterol', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: LDL-Cholesterol'),
        ('Sinh hóa', 'Protein total', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'SGOT', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'SGPT', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Total - Bilirubin', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Total Cholesterol', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: Cholesterol'),
        ('Sinh hóa', 'Total Protein', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: Protein total'),
        ('Sinh hóa', 'Triglyceride', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh hóa', 'Triglycerides', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md alias: Triglyceride'),
        ('Sinh hóa', 'Urea', 'Máy sinh hóa tự động AU400', 'docs/assays_definition.md exact row'),
        ('Sinh học phân tử', 'HBV đo tải lượng Realtime-PCR', 'Realtime-PCR', 'docs/assays_definition.md exact row'),
        ('Sinh học phân tử', 'HIV đo tải lượng hệ thống tự động', 'Hệ thống tự động Cobas 4800', 'docs/assays_definition.md exact row'),
        ('Tế bào học', 'Tầm soát ung thư cổ tử cung', 'Nhuộm Papanicolaou', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Amip (E.Histolytica)', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Ấu trùng giun chỉ bạch huyết', 'Nhuộm Giemsa/Soi tươi', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Ấu trùng sán dải (Cysticercus)', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Giun đũa', 'Soi tươi', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Giun đũa chó (Toxocara)', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Giun kim', 'Soi tươi', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Giun lươn (Strongyloides)', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Giun móc', 'Soi tươi', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Ký sinh trùng sốt rét', 'Nhuộm Giemsa/Soi tươi', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Não mô cầu', 'Soi tươi/Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Salmonella (Thương hàn)', 'Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Sán dải chó (Echinococus)', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Sán dây (Taenia SP)', 'Soi tươi', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Sán lá gan (Fasciola)', 'Elisa', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Shigella (Lỵ trực trùng)', 'Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Tụ cầu', 'Soi tươi/Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Vi khuẩn bạch hầu', 'Soi tươi/Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Vi phế cầu khuẩn', 'Soi tươi/Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row'),
        ('Vi sinh/Ký sinh/Vi nấm', 'Vibrio cholera (Tả)', 'Nuôi cấy, phân lập và xác định', 'docs/assays_definition.md exact row')
    ),
    updated_assays AS (
        UPDATE public.assay_definitions AS assay
        SET method_name = method_backfill.method_name,
            updated_at = now()
        FROM method_backfill
        JOIN public.lab_specialties AS specialty
            ON specialty.name = method_backfill.specialty_name
        WHERE assay.specialty_id = specialty.id
          AND assay.name = method_backfill.assay_name
          AND assay.deleted_at IS NULL
          AND (assay.method_name IS NULL OR btrim(assay.method_name) = '')
        RETURNING assay.id
    )
    SELECT count(*) INTO v_updated_count
    FROM updated_assays;

    SELECT count(*) INTO v_remaining_blank_count
    FROM public.assay_definitions AS assay
    WHERE assay.deleted_at IS NULL
      AND (assay.method_name IS NULL OR btrim(assay.method_name) = '');

    RAISE NOTICE 'Backfilled % assay method_name values from sourced assay definition data; % active assays still blank.',
        v_updated_count,
        v_remaining_blank_count;
END $$;
