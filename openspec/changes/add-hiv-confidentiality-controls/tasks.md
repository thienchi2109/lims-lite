## TDD Rule
- [ ] 0.1 Follow strict `RED -> GREEN -> REFACTOR` for every batch below
- [ ] 0.2 Do not write production migration or app code before a focused failing test exists for that batch
- [ ] 0.3 For SQL changes, verify the new test fails for the expected reason before applying the migration
- [ ] 0.4 For TypeScript and route changes, run the narrowest relevant test file first, then expand to broader verification after green

## Batch Dependency Map
- [ ] D.1 `Batch 1 -> Batch 2 -> Batch 3`
- [ ] D.2 `Batch 4`, `Batch 5`, and `Batch 6` depend on `Batch 3` and can run in parallel after it reaches green
- [ ] D.3 `Batch 7` is the final verification gate for `Batch 1` through `Batch 6`
- [ ] D.4 `Batch 8` is rollout-only and starts after `Batch 7` is green

## Batch 1: Confidential Schema and Authorization Helpers
### RED
- [x] 1.1 Add failing SQL security tests for `assay_definitions.is_confidential`
- [x] 1.2 Add failing SQL security tests for `users.can_access_confidential`
- [x] 1.3 Add failing SQL security tests for `user_can_access_confidential()`
### GREEN
- [x] 1.4 Add `assay_definitions.is_confidential`, `users.can_access_confidential`, and `user_can_access_confidential()` in a migration
- [x] 1.5 Add indexes to support confidential policy predicates and confidential-assay lookups
- [x] 1.6 Re-run the schema and helper tests until they pass
### REFACTOR
- [x] 1.7 Clean up migration naming, comments, and helper function structure without changing behavior

## Batch 2: `results` RLS Enforcement
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

## Batch 3: Types, User Management, and Approval Guards
### RED
- [ ] 3.1 Add failing TypeScript or integration tests for schemas carrying `is_confidential` and `can_access_confidential`
- [ ] 3.2 Add a failing test proving manager approval of confidential results is not yet guarded correctly
- [ ] 3.3 Add a failing test proving managers without confidential authorization can still see confidential items in approval workspace tabs or approval counts
- [ ] 3.4 Add a failing test proving authorized analysts must retain confidential HIV workflow capability
### GREEN
- [ ] 3.5 Extend TypeScript and Zod schemas with the new confidentiality fields
- [ ] 3.6 Update assay management actions to read and write `is_confidential`
- [ ] 3.7 Update user management actions to read and write `can_access_confidential`
- [ ] 3.8 Enforce confidential checks in manager result approval flow (`approveResults`)
- [ ] 3.9 Filter confidential items out of unauthorized approval workspace tabs, pending-approval lists, completed-results lists, and approval counts
- [ ] 3.10 Re-run the focused tests until the new types and approval behavior pass
### REFACTOR
- [ ] 3.11 Simplify shared authorization checks or schema helpers after green

## Batch 4: Sample Concealment in Lists and Detail
### RED
- [ ] 4.1 Add a failing integration test for confidential-associated sample detail requested by an unauthorized user returning an existence-confirming response
- [ ] 4.2 Add a failing integration test proving unauthorized sample lists, work queues, or exact lookups can still surface confidential-associated samples
- [ ] 4.3 Add a failing integration test proving authorized users still receive full sample visibility and detail
### GREEN
- [ ] 4.4 Update sample retrieval to detect confidential-associated samples consistently across list and detail flows
- [ ] 4.5 Exclude confidential-associated samples from unauthorized lists, work queues, and exact-identifier lookup results
- [ ] 4.6 Ensure `/api/samples/[id]` and related detail actions return generic not-found or equivalent authorization-neutral responses for unauthorized users
- [ ] 4.7 Re-run the sample concealment tests until authorized and unauthorized paths both pass
### REFACTOR
- [ ] 4.8 Centralize confidential-associated sample detection and authorization-neutral response logic so API and action layers cannot drift

## Batch 5: Search Hardening
### RED
- [ ] 5.1 Add a failing test proving exact searches by sample code, name, phone, or national ID can expose confidential-associated records to unauthorized users
- [ ] 5.2 Add a failing test proving client, sample, result, or global search can leak confidential context through counts, snippets, or mixed-result responses
### GREEN
- [ ] 5.3 Ensure search functions and RPC responses return zero confidential-associated matches for unauthorized users, including exact-identifier searches
- [ ] 5.4 Ensure mixed-result searches return only permitted non-confidential matches without leaking hidden confidential counts or snippets
- [ ] 5.5 Re-run the search tests until all targeted leaks are closed
### REFACTOR
- [ ] 5.6 Simplify centralized confidential-search filtering and authorization-neutral response shaping after green

## Batch 6: CoA Hardening
### RED
- [ ] 6.1 Add a failing test proving staff CoA preview, download, or direct view confirms confidential CoA existence to unauthorized users
- [ ] 6.2 Add a failing test proving the public `/coa/access` flow can still surface confidential HIV CoAs
### GREEN
- [ ] 6.3 Apply confidentiality checks in CoA staff preview, download, and direct view flows so unauthorized callers get no existence confirmation
- [ ] 6.4 Exclude confidential HIV CoAs from the public `/coa/access` flow in MVP
- [ ] 6.5 Re-run the CoA tests until all targeted leaks are closed
### REFACTOR
- [ ] 6.6 Verify storage, report, and error-handling paths do not bypass confidential rules or confirm hidden CoA existence

## Batch 7: Full Verification Gate
- [ ] 7.1 Extend `run_security_tests()` to include the new confidential-control assertions
- [ ] 7.2 Re-run `run_security_tests()` after each database batch reaches green
- [ ] 7.3 Run integration tests for confidential sample non-discoverability in list and detail flows
- [ ] 7.4 Run integration tests for search non-discoverability rules
- [ ] 7.5 Run integration tests for CoA non-discoverability rules
- [ ] 7.6 Run `npm run typecheck`
- [ ] 7.7 Run the smallest relevant test target first for each batch, then the broader regression set before merge

## Batch 8: Rollout and Operational Safety
- [ ] 8.1 Prepare runbook: grant confidential access before enabling assay confidentiality
- [ ] 8.2 Validate migration sequencing in staging
- [ ] 8.3 Validate audit observability for confidential access
- [ ] 8.4 Communicate that confidential-associated samples disappear entirely from unauthorized sample, search, and CoA workflows
