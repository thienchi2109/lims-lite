## 1. Implementation
- [ ] 1.1 Update `fetchSampleWithApprover` in `coa.ts` to select detailed client fields (DOB, gender, address, insurance).
- [ ] 1.2 Implement `fetchTestingDate(sampleId)` in `coa.ts` using `audit_logs` query.
- [ ] 1.3 Update `generateCoA` and `regenerateCoA` actions to accept `manualInputs` object (referrer, quality).
- [ ] 1.4 Create `CoAGenerationDialog` component in `src/components` (or inline in `coa-actions.tsx`) with form fields for manual inputs.
- [ ] 1.5 Update `renderCoATemplate` HTML to include new fields in the layout.
- [ ] 1.6 Verify complete CoA generation flow with manual inputs and correct database data.
