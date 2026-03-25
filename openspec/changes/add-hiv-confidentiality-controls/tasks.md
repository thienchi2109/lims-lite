## TDD Rule
- [ ] 0.1 Follow strict `RED -> GREEN -> REFACTOR` for every slice below
- [ ] 0.2 Do not write production migration or app code before a focused failing test exists for that slice
- [ ] 0.3 For SQL changes, verify the new test fails for the expected reason before applying the migration
- [ ] 0.4 For TypeScript and route changes, run the narrowest relevant test file first, then expand to broader verification after green

## 1. TDD Slice: Confidential Schema and Authorization Helpers
### RED
- [ ] 1.1 Add failing SQL security tests for `assay_definitions.is_confidential`
- [ ] 1.2 Add failing SQL security tests for `users.can_access_confidential`
- [ ] 1.3 Add failing SQL security tests for `users.can_export_hiv_anonymized`
- [ ] 1.4 Add failing SQL security tests for `user_can_access_confidential()`
- [ ] 1.5 Add failing SQL security tests for `user_can_export_hiv_anonymized()`
### GREEN
- [ ] 1.6 Add the three schema fields and two helper functions in a migration
- [ ] 1.7 Add indexes to support confidential policy predicates and confidential-assay lookups
- [ ] 1.8 Re-run the schema and helper tests until they pass
### REFACTOR
- [ ] 1.9 Clean up migration naming, comments, and helper function structure without changing behavior

## 2. TDD Slice: `results` RLS Enforcement
### RED
- [ ] 2.1 Add a failing negative SQL test proving unauthorized users can still read confidential HIV results today
- [ ] 2.2 Add a failing negative SQL test proving unauthorized users can still insert confidential HIV results today
- [ ] 2.3 Add a failing negative SQL test proving unauthorized users can still update confidential HIV results today
- [ ] 2.4 Add a failing positive SQL test proving authorized users must retain confidential access
### GREEN
- [ ] 2.5 Update `results` SELECT policy to allow confidential rows only for authorized users
- [ ] 2.6 Update `results` INSERT policy to require confidential access when the assay is confidential
- [ ] 2.7 Update `results` UPDATE policy to require confidential access when the assay is confidential
- [ ] 2.8 Backfill HIV assay definitions to `is_confidential = true`
- [ ] 2.9 Re-run the targeted RLS tests until all unauthorized and authorized cases pass
### REFACTOR
- [ ] 2.10 Verify no overlapping or orphaned policies weaken confidential enforcement
- [ ] 2.11 Run policy verification queries and simplify policy definitions if needed without changing behavior

## 3. TDD Slice: Types, User Management, and Approval Guards
### RED
- [ ] 3.1 Add failing TypeScript or integration tests for schemas carrying `is_confidential`, `can_access_confidential`, and `can_export_hiv_anonymized`
- [ ] 3.2 Add a failing test proving manager approval of confidential results is not yet guarded correctly
- [ ] 3.3 Add a failing test proving authorized analysts must retain confidential HIV workflow capability
### GREEN
- [ ] 3.4 Extend TypeScript and Zod schemas with the new confidentiality fields
- [ ] 3.5 Update assay management actions to read and write `is_confidential`
- [ ] 3.6 Update user management actions to read and write both confidentiality-related user flags
- [ ] 3.7 Enforce confidential checks in manager result approval flow (`approveResults`)
- [ ] 3.8 Re-run the focused tests until the new types and approval behavior pass
### REFACTOR
- [ ] 3.9 Simplify shared authorization checks or schema helpers after green

## 4. TDD Slice: Sample Detail Redaction
### RED
- [ ] 4.1 Add a failing integration test for confidential-associated sample detail requested by an unauthorized user
- [ ] 4.2 Add a failing integration test proving authorized users still receive full sample detail
- [ ] 4.3 Add a failing integration test for `/api/samples/[id]` returning an unsafe payload in confidential context
### GREEN
- [ ] 4.4 Update sample detail retrieval to detect confidential-associated samples
- [ ] 4.5 Redact sensitive client fields for unauthorized users in confidential contexts
- [ ] 4.6 Ensure `/api/samples/[id]` returns confidentiality-safe payloads
- [ ] 4.7 Re-run the sample detail tests until authorized and unauthorized paths both pass
### REFACTOR
- [ ] 4.8 Centralize redaction logic so API and action layers cannot drift

## 5. TDD Slice: Search and CoA Hardening
### RED
- [ ] 5.1 Add a failing test proving search functions or RPC responses can expose confidential HIV data to unauthorized users
- [ ] 5.2 Add a failing test proving client or global search can leak confidential context
- [ ] 5.3 Add a failing test proving staff CoA preview, download, or direct view lacks confidential authorization checks
- [ ] 5.4 Add a failing test proving the public `/coa/access` flow can still surface confidential HIV CoAs
### GREEN
- [ ] 5.5 Ensure search functions and RPC responses do not expose confidential HIV data to unauthorized users
- [ ] 5.6 Ensure global and client search behavior remains role-safe and confidentiality-safe
- [ ] 5.7 Apply confidential authorization checks in CoA staff preview, download, and direct view flows
- [ ] 5.8 Exclude confidential HIV CoAs from the public `/coa/access` flow in MVP
- [ ] 5.9 Re-run the search and CoA tests until all targeted leaks are closed
### REFACTOR
- [ ] 5.10 Verify storage and report access paths do not bypass confidential rules

## 6. TDD Slice: Anonymized Export for Research and Epidemiology
### RED
- [ ] 6.1 Add a failing test proving operational confidential access alone can reach the export path
- [ ] 6.2 Add a failing test proving direct identifiers are still present in export output
- [ ] 6.3 Add a failing test proving suppression or generalization rules are not yet enforced
- [ ] 6.4 Add a failing test proving export audit logging is missing or incomplete
### GREEN
- [ ] 6.5 Create a dedicated anonymized export path (view or RPC), not direct operational-table export
- [ ] 6.6 Restrict anonymized export execution to users with `can_export_hiv_anonymized = true`
- [ ] 6.7 Remove direct identifiers and apply a stable pseudonymization strategy
- [ ] 6.8 Apply generalization and suppression rules for re-identification control
- [ ] 6.9 Audit-log all anonymized export operations
- [ ] 6.10 Re-run the export tests until authorization, de-identification, and audit behavior pass
### REFACTOR
- [ ] 6.11 Simplify export dataset shaping and audit helpers after green

## 7. Full Verification Gate
- [ ] 7.1 Extend `run_security_tests()` to include the new confidential-control assertions
- [ ] 7.2 Re-run `run_security_tests()` after each database slice reaches green
- [ ] 7.3 Run integration tests for sample detail redaction behavior
- [ ] 7.4 Run integration tests for search and CoA confidentiality rules
- [ ] 7.5 Run integration tests for anonymized export authorization and de-identification rules
- [ ] 7.6 Run `npm run typecheck`
- [ ] 7.7 Run the smallest relevant test target first for each slice, then the broader regression set before merge

## 8. Rollout and Operational Safety
- [ ] 8.1 Prepare runbook: grant confidential access before enabling assay confidentiality
- [ ] 8.2 Prepare runbook: grant export authorization before enabling anonymized HIV export
- [ ] 8.3 Validate migration sequencing in staging
- [ ] 8.4 Validate audit observability for confidential and anonymized access
- [ ] 8.5 Communicate role and permission implications to manager users
