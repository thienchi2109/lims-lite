## 1. Design & Decisions
- [ ] 1.1 Confirm mapping of QR payload to fields (id_card_num, name, DOB dd/mm/yyyy → DATE, gender) and allowed lists
- [ ] 1.2 Finalize DB constraints (CHECKs for gender/type, UNIQUE on name+date_of_birth, NOT NULL columns) and trigger behavior for snapshots/updated_at
- [ ] 1.3 Define RLS policy matrix for clients (analyst/manager) and samples changes (role checks, drop/create pattern)

## 2. Database Migration
- [ ] 2.1 Create migration adding `clients` table with audit/updated_at triggers, CHECKs, UNIQUE, indexes
- [ ] 2.2 Update `samples` table: client_id NOT NULL FK, client_name required + auto-fill trigger, type TEXT with CHECK list, keep sample_status enum for status
- [ ] 2.3 Add/adjust RLS policies for clients and samples per migration security checklist; document Security Impact
- [ ] 2.4 Backfill existing samples with client records and linkages (data migration strategy that respects audit/RLS)
- [ ] 2.5 Run `run_security_tests()` and validate constraints after migration

## 3. Backend Integration
- [ ] 3.1 Update server actions/Zod schemas/types for clients + sample creation to require client_id and validated type/gender
- [ ] 3.2 Implement QR payload parser/validator (dd/mm/yyyy → DATE) and client upsert/find logic
- [ ] 3.3 Adjust API client routes to use new endpoints/actions; ensure RLS-friendly access

## 4. Frontend Integration
- [ ] 4.1 Update sample intake UI to select/create client, snapshot name, and pick type from allowed list; keep Vietnamese labels
- [ ] 4.2 Wire QR scan flow to auto-fill client fields and handle validation errors gracefully
- [ ] 4.3 Adjust lists/detail views to display client linkage

## 5. Testing & Docs
- [ ] 5.1 Update seeds/fixtures for clients + linked samples
- [ ] 5.2 Add/extend SQL/manual test cases for RLS, QR intake, and validation; run typecheck/lint
- [ ] 5.3 Document QR intake + client workflow in README/docs
