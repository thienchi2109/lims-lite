## 1. Regression Contract

- [x] 1.1 Add a failing migration contract test for migration 229, including
  baseline assertions, system-manager RPC usage, active-only recovery, revision
  publication, audit reasons, and soft-delete exclusion.
- [x] 1.2 Run the focused test and confirm it fails because migration 229 does
  not exist.

## 2. Forward-Only Catalog Recovery

- [x] 2.1 Add migration `229_restore_active_assay_availability.sql` with
  production baseline checks and transaction-local system-manager claims.
- [x] 2.2 Clone revision 1, convert exactly 59 active `not_assignable` assays to
  `configured` for `LM-000001` through existing catalog RPCs, review the hash,
  and publish revision 2.
- [x] 2.3 Add atomic postconditions proving 84 active configured mappings,
  zero active `not_assignable` reviews, zero soft-deleted assay mappings, and
  correct revision supersession.
- [x] 2.4 Run the focused migration contract test and confirm it passes.

## 3. Verification And Delivery

- [x] 3.1 Run related compatibility migration tests, OpenSpec strict
  validation, and TypeScript typecheck.
- [x] 3.2 Review the diff for applied-migration immutability, SQL security,
  audit attribution, and scope containment.
- [x] 3.3 Commit, push the reviewed branch, fast-forward `main` without a PR,
  and sync source plus the home-server checkout.
- [x] 3.4 Apply migration 229 on the home server and run
  `run_security_tests()`.
- [x] 3.5 Verify revision 2, 84/84 active assay visibility, zero soft-deleted
  leakage, the four reported assay codes, and application health; then hand off
  production accession UI verification to the user.
- [x] 3.6 Close without recording a production accession UI result at the
  user's explicit archive direction on August 23, 2026.
