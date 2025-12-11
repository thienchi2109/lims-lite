## Why
Assays lack a managed specialty/category, making it hard to organize workflows (e.g., Sinh hóa vs. Huyết học), filter UIs, or enforce ownership by department. A dedicated lookup with soft-delete and RLS is needed so assays can be routed and audited by specialty.

## What Changes
- Add `lab_specialties` table (UUID PK, code, name, display_order, description, audit timestamps, soft delete) with updated_at trigger and unique code constraint using pg_default tablespace.
- Enable RLS on `lab_specialties` with authenticated read and manager-only write policies; seed standard Vietnamese specialties (HEM, BIO, IMM, MIC, MOL, PAT).
- Add nullable `specialty_id` FK (RESTRICT) and index to `assay_definitions` to link assays to a single specialty for routing and reporting.

## Impact
- Affected specs: assay-management
- Affected code: Supabase migrations/RLS, seeds, assay data model (assay_definitions)
