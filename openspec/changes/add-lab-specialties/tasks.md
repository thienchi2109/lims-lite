## 1. Database & Security
- [x] 1.1 Create `lab_specialties` table (UUID PK, code unique, name, display_order default 0, description, audit columns, soft delete) on pg_default with updated_at trigger.
- [x] 1.2 Enable RLS on `lab_specialties`; add policies for authenticated read and manager-only insert/update/delete with role checks; document security impact.
- [x] 1.3 Seed standard specialties (HEM, BIO, IMM, MIC, MOL, PAT) with Vietnamese names/descriptions and stable codes.
- [x] 1.4 Add nullable `specialty_id` to `assay_definitions` with RESTRICT FK and btree index; keep existing audit patterns.

## 2. Application & Data Model
- [x] 2.1 Update assay model/types and server actions to surface `specialty_id` and include specialty in create/update flows.
- [x] 2.2 Add filtering/grouping by specialty to assay management UI; display specialty name in assay grids and detail views.
- [x] 2.3 Adjust seeds/fixtures and tests to cover specialty linkage and RESTRICT behavior (cannot delete specialty when referenced; use soft delete instead).

## 3. Verification
- [x] 3.1 Run migration and security tests (`run_security_tests()`), then `npm run typecheck`.
- [x] 3.2 Smoke-test assay create/edit with specialty assignment and ensure RLS blocks non-managers from writes.
