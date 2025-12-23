## 1. Implementation

### Phase 1: Type Definitions & Data Layer
- [ ] 1.1 Update TypeScript types in `src/types/index.ts`
  - Add `CoAManualInputs` interface (referrer: string, sampleQuality: string)
  - Add Zod schema `CoAManualInputsSchema` with validation
  - Update `SampleData` interface to include client demographic fields
  - Update `CoAData` interface to include testingDate and manualInputs

- [ ] 1.2 Update `fetchSampleWithApprover` in `coa.ts`
  - Extend select to include: `clients.date_of_birth`, `clients.gender`, `clients.address`, `clients.health_insurance_num`
  - Update return type to include new fields

- [ ] 1.3 Implement `fetchTestingDate(sampleId)` in `coa.ts`
  - Query `audit_logs` for first transition to `in_progress`
  - Handle case where no audit log exists (fallback to received_at)

### Phase 2: Server Actions
- [ ] 1.4 Update `generateCoA` action signature
  - Add `manualInputs?: CoAManualInputs` parameter
  - Validate inputs with Zod schema
  - Pass data to template renderer

- [ ] 1.5 Update `regenerateCoA` action signature
  - Add `manualInputs?: CoAManualInputs` parameter
  - Forward to generateCoA with validation

- [ ] 1.6 Update API client bindings in `src/lib/api-client.ts`
  - Update generateCoA/regenerateCoA function signatures
  - Ensure proper serialization of manualInputs

### Phase 3: UI Components
- [ ] 1.7 Create `CoAGenerationDialog` component
  - Form fields: Referrer/Physician (text), Sample Quality (select)
  - Sample quality options: "Tốt", "Đạt", "Không đạt"
  - Validation with react-hook-form + Zod resolver
  - Submit triggers CoA generation with manual inputs

- [ ] 1.8 Update `coa-actions.tsx` to use dialog
  - Replace direct regenerateCoA call with dialog trigger
  - Pass manual inputs from dialog to action

### Phase 4: Template Update
- [ ] 1.9 Update `renderCoATemplate` HTML layout
  - Add "Thông tin hành chính" section: DOB, Gender, Address, Insurance
  - Add "Thông tin mẫu" section: Sample Type, Referrer, Sample Quality
  - Add "Ngày xét nghiệm" field (Testing Date from audit logs)
  - Ensure proper Vietnamese labels and formatting

### Phase 5: Verification
- [ ] 1.10 Integration testing
  - Test CoA generation with all new fields populated
  - Test with missing optional fields (address, insurance)
  - Test with no audit log (fallback behavior)
  - Verify PDF/print layout renders correctly
