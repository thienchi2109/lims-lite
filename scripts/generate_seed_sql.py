import re

markdown_table = """
| 1   | Sinh hóa               | Glucose                                   |
| 2   | Sinh hóa               | HbA1C                                     |
| 3   | Sinh hóa               | Cholesterol                               |
| 4   | Sinh hóa               | HDL-Cholesterol                           |
| 5   | Sinh hóa               | LDL-Cholesterol                           |
| 6   | Sinh hóa               | Triglyceride                              |
| 7   | Sinh hóa               | SGOT                                      |
| 8   | Sinh hóa               | SGPT                                      |
| 9   | Sinh hóa               | GGT                                       |
| 10  | Sinh hóa               | Creatinine                                |
| 11  | Sinh hóa               | Urea                                      |
| 12  | Sinh hóa               | Acid Uric                                 |
| 13  | Sinh hóa               | Calcium                                   |
| 14  | Sinh hóa               | Albumin                                   |
| 15  | Sinh hóa               | Protein total                             |
| 16  | Sinh hóa               | Total - Bilirubin                         |
| 17  | Sinh hóa               | Direct - Bilirubin                        |
| 18  | Miễn dịch              | Anti-H.Pylori                             |
| 19  | Tế bào học             | Tầm soát ung thư cổ tử cung               |
| 20  | Huyết học              | Tổng phân tích tế bào máu 18 thông số     |
| 21  | Huyết học              | WBC                                       |
| 22  | Huyết học              | RBC                                       |
| 23  | Huyết học              | HGB                                       |
| 24  | Huyết học              | HCT                                       |
| 25  | Huyết học              | MCV                                       |
| 26  | Huyết học              | MCH                                       |
| 27  | Huyết học              | MCHC                                      |
| 28  | Huyết học              | PLT                                       |
| 29  | Huyết học              | LYM%                                      |
| 30  | Huyết học              | MXD%                                      |
| 31  | Huyết học              | NEUT%                                     |
| 32  | Huyết học              | LYM#                                      |
| 33  | Huyết học              | MXD#                                      |
| 34  | Huyết học              | NEUT#                                     |
| 35  | Huyết học              | RDW-CV                                    |
| 36  | Huyết học              | PDW                                       |
| 37  | Huyết học              | MPV                                       |
| 38  | Huyết học              | PCT                                       |
| 39  | Huyết học              | Định nhóm máu                             |
| 40  | Huyết học              | Tổng phân tích tế bào máu 18 thông số     |
| 41  | Huyết học              | WBC                                       |
| 42  | Huyết học              | RBC                                       |
| 43  | Huyết học              | HGB                                       |
| 44  | Huyết học              | HCT                                       |
| 45  | Huyết học              | MCV                                       |
| 46  | Huyết học              | MCH                                       |
| 47  | Huyết học              | MCHC                                      |
| 48  | Huyết học              | PLT                                       |
| 49  | Huyết học              | LYM%                                      |
| 50  | Huyết học              | MO%                                       |
| 51  | Huyết học              | GR%                                       |
| 52  | Huyết học              | LYM#                                      |
| 53  | Huyết học              | MO#                                       |
| 54  | Huyết học              | GR#                                       |
| 55  | Huyết học              | RDW-CV                                    |
| 56  | Huyết học              | PCT                                       |
| 57  | Huyết học              | MPV                                       |
| 58  | Huyết học              | PDW                                       |
| 59  | Miễn dịch              | HBsAg định lượng                          |
| 60  | Miễn dịch              | Anti-HBs định lượng                       |
| 61  | Miễn dịch              | T3                                        |
| 62  | Miễn dịch              | FT3                                       |
| 63  | Miễn dịch              | T4                                        |
| 64  | Miễn dịch              | FT4                                       |
| 65  | Miễn dịch              | TSH                                       |
| 66  | Miễn dịch              | CA 15-3                                   |
| 67  | Miễn dịch              | CA 125                                    |
| 68  | Miễn dịch              | HBsAg                                     |
| 69  | Miễn dịch              | HBsAb                                     |
| 70  | Miễn dịch              | HBsAg định tính                           |
| 71  | Miễn dịch              | HBsAb định tính                           |
| 72  | Miễn dịch              | Anti HCV                                  |
| 73  | Miễn dịch              | HBeAg                                     |
| 74  | Miễn dịch              | HAV - IgM                                 |
| 75  | Miễn dịch              | HEV - IgM                                 |
| 76  | Miễn dịch              | Anti HCV                                  |
| 77  | Miễn dịch              | Syphilis (Giang mai)                      |
| 78  | Miễn dịch              | TPHA định tính                            |
| 79  | Miễn dịch              | TPHA định lượng                           |
| 80  | Miễn dịch              | RPR định tính                             |
| 81  | Miễn dịch              | Đếm số lượng tế bào CD3/CD4/CD8           |
| 82  | Miễn dịch              | HIV miễn dịch bán tự động                 |
| 83  | Miễn dịch              | HIV Ag/Ab định tính                       |
| 84  | Miễn dịch              | HIV khẳng định                            |
| 85  | Miễn dịch              | Chlamidia định tính                       |
| 86  | Miễn dịch              | HCV định tính                             |
| 87  | Miễn dịch              | Gonorrhoeae định tính                     |
| 88  | Sinh học phân tử       | HIV đo tải lượng hệ thống tự động         |
| 89  | Sinh học phân tử       | HBV đo tải lượng Realtime-PCR             |
| 90  | Nước tiểu              | Tổng phân tích nước tiểu                  |
| 91  | Nước tiểu              | BLD                                       |
| 92  | Nước tiểu              | BIL                                       |
| 93  | Nước tiểu              | URO                                       |
| 94  | Nước tiểu              | KETON                                     |
| 95  | Nước tiểu              | Protein total                             |
| 96  | Nước tiểu              | NIT                                       |
| 97  | Nước tiểu              | Glucose                                   |
| 98  | Nước tiểu              | pH                                        |
| 99  | Nước tiểu              | S,G                                       |
| 100 | Nước tiểu              | LEU                                       |
| 101 | Nước tiểu              | Heroin/Mophine                            |
| 102 | Nước tiểu              | Amphetamin (Chất kích thích)              |
| 103 | Nước tiểu              | MarijuaNa-te (Cần sa)                     |
| 104 | Nước tiểu              | Methamphetamin (Chất kích thích tổng hợp) |
| 105 | Nước tiểu              | Nanosign DOA (4 in 1)                     |
| 106 | Vi sinh/Ký sinh/Vi nấm | Sán dải chó (Echinococus)                 |
| 107 | Vi sinh/Ký sinh/Vi nấm | Giun đũa chó (Toxocara)                   |
| 108 | Vi sinh/Ký sinh/Vi nấm | Ấu trùng sán dải (Cysticercus)            |
| 109 | Vi sinh/Ký sinh/Vi nấm | Giun lươn (Strongyloides)                 |
| 110 | Vi sinh/Ký sinh/Vi nấm | Sán lá gan (Fasciola)                     |
| 111 | Vi sinh/Ký sinh/Vi nấm | Amip (E.Histolytica)                      |
| 112 | Vi sinh/Ký sinh/Vi nấm | Giun đũa                                  |
| 113 | Vi sinh/Ký sinh/Vi nấm | Giun móc                                  |
| 114 | Vi sinh/Ký sinh/Vi nấm | Giun kim                                  |
| 115 | Vi sinh/Ký sinh/Vi nấm | Sán dây (Taenia SP)                       |
| 116 | Vi sinh/Ký sinh/Vi nấm | Ký sinh trùng sốt rét                     |
| 117 | Vi sinh/Ký sinh/Vi nấm | Ấu trùng giun chỉ bạch huyết              |
| 118 | Vi sinh/Ký sinh/Vi nấm | Salmonella (Thương hàn)                   |
| 119 | Vi sinh/Ký sinh/Vi nấm | Shigella (Lỵ trực trùng)                  |
| 120 | Vi sinh/Ký sinh/Vi nấm | Vibrio cholera (Tả)                       |
| 121 | Vi sinh/Ký sinh/Vi nấm | Não mô cầu                                |
| 122 | Vi sinh/Ký sinh/Vi nấm | Vi khuẩn bạch hầu                         |
| 123 | Vi sinh/Ký sinh/Vi nấm | Vi phế cầu khuẩn                          |
| 124 | Vi sinh/Ký sinh/Vi nấm | Tụ cầu                                    |
"""

specialty_map = {
    'Sinh hóa': {'code': 'BIO'},
    'Miễn dịch': {'code': 'IMM'},
    'Huyết học': {'code': 'HEM'},
    'Sinh học phân tử': {'code': 'MOL'},
    'Tế bào học': {'code': 'CYTO'},
    'Nước tiểu': {'code': 'URI'},
    'Vi sinh/Ký sinh/Vi nấm': {'code': 'MIC'}
}

# Parse table
lines = markdown_table.strip().split('\n')
assays = []

for line in lines:
    parts = [p.strip() for p in line.split('|')]
    if len(parts) >= 4:
        spec_name = parts[2]
        assay_name = parts[3]
        if spec_name in specialty_map:
             assays.append({
                 'specialty': spec_name,
                 'code': specialty_map[spec_name]['code'],
                 'name': assay_name
             })

# Generate SQL
sql = """-- Migration 051: Fix encoding and seed new assays
-- Generated from @docs/new_assays_specialties.md
-- Fixes corruption from Migration 050

SET search_path TO public;

-- 1. CLEANUP GARBLED DATA
---------------------------------------------------------------------------
-- Delete assays with multiple question marks (sign of encoding corruption)
DELETE FROM assay_definitions WHERE name LIKE '%??%';

-- 2. SEED DATA
---------------------------------------------------------------------------
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
    
    -- Fix/Update 'Vi sinh' (MIC)
    SELECT id INTO v_mic_id FROM lab_specialties WHERE code = 'MIC';
    IF v_mic_id IS NOT NULL THEN
        UPDATE lab_specialties 
        SET name = 'Vi sinh/Ký sinh/Vi nấm' 
        WHERE id = v_mic_id;
    ELSE
        INSERT INTO lab_specialties (name, code) VALUES ('Vi sinh/Ký sinh/Vi nấm', 'MIC') RETURNING id INTO v_mic_id;
    END IF;

    -- Fix/Create 'Tế bào học' (CYTO)
    SELECT id INTO v_cyto_id FROM lab_specialties WHERE code = 'CYTO';
    IF v_cyto_id IS NOT NULL THEN
        UPDATE lab_specialties SET name = 'Tế bào học' WHERE id = v_cyto_id;
    ELSE
        INSERT INTO lab_specialties (name, code) VALUES ('Tế bào học', 'CYTO') RETURNING id INTO v_cyto_id;
    END IF;
    
    -- Fix/Create 'Nước tiểu' (URI)
    SELECT id INTO v_uri_id FROM lab_specialties WHERE code = 'URI';
    IF v_uri_id IS NOT NULL THEN
        UPDATE lab_specialties SET name = 'Nước tiểu' WHERE id = v_uri_id;
    ELSE
        INSERT INTO lab_specialties (name, code) VALUES ('Nước tiểu', 'URI') RETURNING id INTO v_uri_id;
    END IF;

    -- 2. Insert Assays
    ---------------------------------------------------------------------------
"""

# Group by specialty for cleaner SQL
grouped_assays = {}
for a in assays:
    code = a['code']
    if code not in grouped_assays:
        grouped_assays[code] = []
    grouped_assays[code].append(a['name'])

for code, names in grouped_assays.items():
    var_name = f"v_{code.lower()}_id"
    sql += f"\n    -- Specialty: {code}\n"
    for name in names:
        # Use simple quote escaping
        safe_name = name.replace("'", "''")
        
        # Insert logic
        sql += "    IF NOT EXISTS (\n"
        sql += f"        SELECT 1 FROM assay_definitions WHERE name = '{safe_name}' AND specialty_id = {var_name}\n"
        sql += "    ) THEN\n"
        sql += f"        INSERT INTO assay_definitions (name, specialty_id) VALUES ('{safe_name}', {var_name});\n"
        sql += "    END IF;\n"

sql += "\nEND $$;\n"

output_path = "supabase/migrations/051_fix_encoding_seed.sql"
with open(output_path, "w", encoding="utf-8") as f:
    f.write(sql)
print(f"Successfully generated {output_path}")
