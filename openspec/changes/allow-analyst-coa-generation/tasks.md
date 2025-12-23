## 1. Implementation

- [ ] 1.1 Add validation helper function `validateSampleForCoAGeneration()` in `src/app/actions/coa.ts`
  - [ ] 1.1.1 Fetch sample with status from database
  - [ ] 1.1.2 Implement role-specific status validation (analyst: completed only, manager: review/completed)
  - [ ] 1.1.3 Fetch all results for sample
  - [ ] 1.1.4 Implement results approval validation (analyst: all approved, manager: at least one approved)
  - [ ] 1.1.5 Return Vietnamese error messages for each failure case

- [ ] 1.2 Modify `generateCoA()` authorization block (lines 718-736)
  - [ ] 1.2.1 Change role check from manager-only to analyst+manager
  - [ ] 1.2.2 Call validation helper with user role
  - [ ] 1.2.3 Return validation errors if check fails

- [ ] 1.3 Update JSDoc comments for `generateCoA()` function (lines 672-698)
  - [ ] 1.3.1 Document analyst authorization rules
  - [ ] 1.3.2 Document manager authorization rules
  - [ ] 1.3.3 Update requirements section with new validation criteria

- [ ] 1.4 Verify `regenerateCoA()` remains manager-only (no changes needed)

## 2. Testing

- [ ] 2.1 Manual testing - Analyst happy path
  - [ ] 2.1.1 Create sample with status='completed' and all results approved
  - [ ] 2.1.2 Login as analyst, call generateCoA()
  - [ ] 2.1.3 Verify CoA generated successfully
  - [ ] 2.1.4 Verify coa_reports record created with correct metadata

- [ ] 2.2 Manual testing - Analyst validation failures
  - [ ] 2.2.1 Test with partial approvals (expect error)
  - [ ] 2.2.2 Test with status='review' (expect error)
  - [ ] 2.2.3 Test with status='in_progress' (expect error)
  - [ ] 2.2.4 Verify error messages are in Vietnamese and descriptive

- [ ] 2.3 Manual testing - Analyst regeneration blocked
  - [ ] 2.3.1 Create sample with existing CoA (status='ready')
  - [ ] 2.3.2 Login as analyst, attempt regenerateCoA()
  - [ ] 2.3.3 Verify error "Chỉ Quản lý mới có thể tạo lại CoA"

- [ ] 2.4 Manual testing - Manager privileges retained
  - [ ] 2.4.1 Test generateCoA() with status='review' (should succeed)
  - [ ] 2.4.2 Test generateCoA() with partial approvals (should succeed)
  - [ ] 2.4.3 Test regenerateCoA() (should succeed)

- [ ] 2.5 Database RLS verification
  - [ ] 2.5.1 Verify analysts can INSERT into coa_reports (SQL test)
  - [ ] 2.5.2 Verify analysts cannot UPDATE coa_reports (SQL test - should fail)
  - [ ] 2.5.3 Verify managers can UPDATE coa_reports (SQL test)

- [ ] 2.6 Security testing
  - [ ] 2.6.1 Attempt analyst regenerateCoA via direct API call (should be blocked)
  - [ ] 2.6.2 Verify audit logs capture analyst user_id in coa_reports records
  - [ ] 2.6.3 SQL injection test on sampleId parameter

- [ ] 2.7 Regression testing
  - [ ] 2.7.1 Verify manager CoA generation unchanged
  - [ ] 2.7.2 Verify signature verification still works
  - [ ] 2.7.3 Verify manual inputs (referrer, sampleQuality) still work

## 3. Documentation

- [ ] 3.1 Update inline code comments for new authorization logic
- [ ] 3.2 Create validation test documentation in docs/
- [ ] 3.3 Update CLAUDE.md if needed (CoA generation workflow)

## 4. Verification

- [ ] 4.1 Run TypeScript type checking (`npm run typecheck`)
- [ ] 4.2 Run linter (`npm run lint`)
- [ ] 4.3 Verify all manual tests pass
- [ ] 4.4 Verify no regression in existing CoA features
- [ ] 4.5 Validate OpenSpec proposal (`openspec validate allow-analyst-coa-generation --strict`)
