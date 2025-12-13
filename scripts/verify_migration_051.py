import re

def parse_markdown_table(md_file):
    assays = []
    with open(md_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    
    # Skip header and separator
    parsing = False
    for line in lines:
        if line.strip().startswith('| STT'):
            parsing = True
            continue
        if parsing and line.strip().startswith('| ---'):
            continue
        if parsing and line.strip().startswith('|'):
            parts = [p.strip() for p in line.split('|')]
            # | STT | Specialty | Name |
            # parts[0] is empty, parts[1] is STT, parts[2] is Specialty, parts[3] is Name
            if len(parts) >= 4:
                specialty = parts[2]
                name = parts[3]
                assays.append((specialty, name))
    return assays

def parse_sql_file(sql_file):
    with open(sql_file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Extract inserted names
    # pattern: INSERT INTO assay_definitions (name, specialty_id) VALUES ('Name', ...);
    # Handling potential differing whitespace
    pattern = re.compile(r"INSERT INTO assay_definitions\s*\(name,\s*specialty_id\)\s*VALUES\s*\('([^']+)',", re.IGNORECASE)
    matches = pattern.findall(content)
    return set(matches)

def compare():
    md_assays = parse_markdown_table('d:/lims-lite/docs/new_assays_specialties.md')
    md_names = set(item[1] for item in md_assays)
    
    sql_names = parse_sql_file('d:/lims-lite/supabase/migrations/051_fix_encoding_seed.sql')
    
    print(f"Total assays in Markdown: {len(md_names)}")
    print(f"Total inserts in SQL: {len(sql_names)}")
    
    missing_in_sql = md_names - sql_names
    extra_in_sql = sql_names - md_names
    
    if missing_in_sql:
        print("Missing in SQL:")
        for name in missing_in_sql:
            print(f"- {name}")
    else:
        print("All Markdown assays are present in SQL file.")
        
    if extra_in_sql:
        print("Extra in SQL (possibly duplicates or old ones?):")
        for name in extra_in_sql:
            print(f"- {name}")

compare()
