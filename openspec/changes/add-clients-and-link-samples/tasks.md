## 1. Design & Decisions ✅ COMPLETE
> **See**: [PHASE1_DESIGN_DECISIONS.md](./PHASE1_DESIGN_DECISIONS.md) for full specification
- [x] 1.1 Confirm mapping of QR payload to fields (id_card_num, name, DOB dd/mm/yyyy → DATE, gender) and allowed lists
- [x] 1.2 Finalize DB constraints (CHECKs for gender/type, UNIQUE on name+date_of_birth, NOT NULL columns) and trigger behavior for snapshots/updated_at
- [x] 1.3 Define RLS policy matrix for clients (analyst/manager) and samples changes (role checks, drop/create pattern)

## 2. Database Migration ✅ COMPLETE
> **See**: [PHASE2_MIGRATION_SUMMARY.md](./PHASE2_MIGRATION_SUMMARY.md) for detailed instructions  
> **See**: [PHASE2_COMPLETION_REPORT.md](./PHASE2_COMPLETION_REPORT.md) for results and verification
- [x] 2.1 Create migration adding `clients` table with audit/updated_at triggers, CHECKs (gender, phone format), UNIQUE, indexes → **039_add_clients_table.sql**
- [x] 2.2 Update `samples` table: client_id NOT NULL FK, client_name required + auto-fill trigger, type TEXT with CHECK list, keep sample_status enum for status → **040_update_samples_for_clients.sql**
- [x] 2.3 Add/adjust RLS policies for clients and samples per migration security checklist; document Security Impact → **Included in 039**
- [x] 2.4 Backfill existing samples with client records and linkages (data migration strategy that respects audit/RLS) → **041_backfill_clients_from_samples.sql**
- [x] 2.5 Run `run_security_tests()` and validate constraints after migration → **✅ COMPLETE** (4/5 tests passed, 1 pre-existing issue)

## 3. Backend Integration ✅ COMPLETE
- [x] 3.1 Update server actions/Zod schemas/types for clients + sample creation to require client_id and validated type/gender/phone → **Complete**: Client/Sample types, schemas in `src/types/index.ts`; RPC migration **043_update_rpc_for_sample_type.sql** applied
- [x] 3.2 Implement client upsert/find logic → **Complete**: `src/app/actions/clients.ts` with upsertClient, findClientByIdentity, getClients, updateClient
- [x] 3.3 Update sample creation actions to use client_id and type → **Complete**: `createSample()` and `accessionAndAssignTests()` in `src/app/actions/samples.ts` now pass `p_client_id` and `p_type` to RPCs
- [x] 3.4 Wire client actions to API router → **Complete** (Commit de64bca): Added 4 client action types to `ClientActionName` in `src/lib/client-actions/types.ts` and route handlers in `src/app/api/client-actions/route.ts` with Vietnamese validation
- [x] 3.5 Add API client wrapper functions → **Complete** (Commit de64bca): Added upsertClientClient, findClientByIdentityClient, fetchClientsClient, updateClientClient to `src/lib/api-client.ts`
- [x] 3.6 Fix type errors and add placeholders → **Complete** (Commit de64bca): Fixed `src/components/sample-accession-form.tsx` with placeholder client_id/type values and TODO comments for Phase 4 UI; all TypeScript checks passing

## 4. Frontend Integration ✅ COMPLETE
- [x] 4.1 Update sample intake UI to select/create client, snapshot name, pick type from allowed list, and require phone input; keep Vietnamese labels
- [x] 4.2 Wire QR scan flow to auto-fill client fields (QR provides id_card, name, DOB, gender; phone is manual entry) and handle validation errors gracefully
- [x] 4.3 Adjust lists/detail views to display client linkage

## 5. Testing & Docs
- [ ] 5.1 Update seeds/fixtures for clients + linked samples
- [ ] 5.2 Add/extend SQL/manual test cases for RLS, QR intake, and validation; run typecheck/lint
- [ ] 5.3 Document QR intake + client workflow in README/docs
