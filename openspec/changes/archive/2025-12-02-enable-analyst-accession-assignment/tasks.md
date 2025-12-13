## 1. Proposal Validation
- [ ] 1.1 Validate change proposal files with `openspec validate enable-analyst-accession-assignment --strict`

## 2. Server/Data
- [x] 2.1 Add/adjust Supabase RLS policies so analysts can assign tests only for samples they received; keep manager rights intact.
- [x] 2.2 Create server action to accession + assign tests in one transaction, returning the new sample and assigned tests; enforce ownership/role checks.
- [x] 2.3 Update sample/create schemas to align with auto-generated `sample_id` and enriched fields captured at accession.

## 3. UI/UX
- [x] 3.1 Extend analyst accession form to collect richer sample metadata and required assays/methods in the same flow.
- [x] 3.2 Reuse or adapt assignment UI (assay + method selection) for analysts; ensure validation requires at least one test.
- [x] 3.3 Surface confirmation (sample ID + assigned tests) after successful submission; refresh lists appropriately.

## 4. QA
- [ ] 4.1 Add/update tests or manual test plan steps covering analyst accession + assignment, permission checks, and RLS constraints.
