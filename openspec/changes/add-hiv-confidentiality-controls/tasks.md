## 1. Database Schema for Confidential Controls
- [ ] 1.1 Add `assay_definitions.is_confidential BOOLEAN NOT NULL DEFAULT FALSE`
- [ ] 1.2 Add `users.can_access_confidential BOOLEAN NOT NULL DEFAULT FALSE`
- [ ] 1.3 Create `user_can_access_confidential()` helper function (SECURITY DEFINER, STABLE)
- [ ] 1.4 Add indexes to support confidential policy predicates
- [ ] 1.5 Backfill HIV assay definitions to `is_confidential = true`

## 2. RLS Policy Enforcement
- [ ] 2.1 Update `results` SELECT policy to allow confidential rows only for authorized users
- [ ] 2.2 Update `results` INSERT policy to require confidential access when assay is confidential
- [ ] 2.3 Update `results` UPDATE policy to require confidential access when assay is confidential
- [ ] 2.4 Verify no overlapping/orphaned policies weaken confidential enforcement
- [ ] 2.5 Run policy verification queries for expected policy state

## 3. App-layer Authorization Consistency
- [ ] 3.1 Extend TypeScript/Zod schemas with `is_confidential` and `can_access_confidential`
- [ ] 3.2 Update assay management actions to read/write `is_confidential`
- [ ] 3.3 Update user management actions to read/write `can_access_confidential`
- [ ] 3.4 Enforce confidential check in manager result approval flow (`approveResults`)
- [ ] 3.5 Preserve authorized analyst HIV workflow (view/enter/submit review)

## 4. PII Redaction for Unauthorized Access
- [ ] 4.1 Update sample detail retrieval to detect confidential-associated samples
- [ ] 4.2 Redact sensitive client fields for unauthorized users in confidential contexts
- [ ] 4.3 Ensure `/api/samples/[id]` returns confidentiality-safe payloads
- [ ] 4.4 Verify UI behavior does not display stale/unredacted sensitive data

## 5. Search and CoA Surface Hardening
- [ ] 5.1 Ensure search functions/RPC responses do not expose confidential HIV data to unauthorized users
- [ ] 5.2 Ensure global search behavior remains role-safe and confidentiality-safe
- [ ] 5.3 Apply confidential authorization checks in CoA staff view flow
- [ ] 5.4 Apply hardened access rules for confidential samples in CoA public flow
- [ ] 5.5 Verify storage and report access paths do not bypass confidential rules

## 6. Anonymized Export for Research/Epidemiology
- [ ] 6.1 Create dedicated anonymized export path (view/RPC), not direct operational table export
- [ ] 6.2 Remove direct identifiers and apply pseudonymization strategy
- [ ] 6.3 Apply generalization/suppression rules for re-identification control
- [ ] 6.4 Restrict anonymized export execution to explicitly authorized users
- [ ] 6.5 Audit-log all anonymized export operations

## 7. Security and Regression Verification
- [ ] 7.1 Extend `run_security_tests()` to include confidential-control assertions
- [ ] 7.2 Add negative access tests (unauthorized users cannot see HIV-confidential results)
- [ ] 7.3 Add positive access tests (authorized users retain intended workflow)
- [ ] 7.4 Add integration tests for sample detail redaction behavior
- [ ] 7.5 Add integration tests for search/CoA confidentiality rules
- [ ] 7.6 Run `npm run typecheck`

## 8. Rollout and Operational Safety
- [ ] 8.1 Prepare runbook: grant confidential access before enabling assay confidentiality
- [ ] 8.2 Validate migration sequencing in staging
- [ ] 8.3 Validate audit observability for confidential and anonymized access
- [ ] 8.4 Communicate role/permission implications to manager users

