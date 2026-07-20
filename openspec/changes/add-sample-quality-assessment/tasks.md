## Phase 1: Contract Tests And Baseline

- [x] 1.1 Add failing focused UI tests for two directly visible Shadcn `Checkbox` choices, placement below `Loại mẫu`, no default selection, mutual exclusion, and required validation on desktop and mobile.
- [x] 1.2 Add failing accession-form tests proving both the no-tests and assigned-tests branches include the selected boolean `sample_quality`, preserve it through confirmation, and clear it only when starting a new accession.
- [x] 1.3 Add failing Server Action and client-action contract tests for required `sample_quality`, exact RPC arguments, analyst authorization, and rejection of missing values before any database call.
- [x] 1.4 Add SQL regression coverage for nullable historical rows, new RPC signatures, role checks, grants, audit JSONB content, and missing-quality rejection.
- [x] 1.5 Reconfirm the live home-server baseline through read-only SSH queries, including the next migration number, current RPC definitions/grants, sample triggers, RLS policies, and absence of `sample_quality`; treat every existing migration as immutable.

## Phase 2: Compatibility Database Contract

- [x] 2.1 Create the next forward-only compatibility migration that adds `public.samples.sample_quality BOOLEAN NULL` with no default and no backfill, including explicit security and historical-data impact comments.
- [x] 2.2 Add quality-aware overloads of `create_sample_atomic` and `accession_and_assign_tests` that require `p_sample_quality BOOLEAN`, reject `NULL`, write the value in the same transaction, and return it in the sample payload where applicable.
- [x] 2.3 Preserve the live `SECURITY DEFINER`, fixed `search_path`, analyst-only checks, `REVOKE EXECUTE FROM PUBLIC`, and authenticated execute grants while temporarily retaining the legacy signatures for deployment compatibility.
- [x] 2.4 Add source-level migration tests that verify no default/backfill SQL is present, both new overloads preserve security hardening, and legacy signatures remain available until the enforcement migration.

## Phase 3: Application Data Flow

- [x] 3.1 Add the read/write domain contract for sample quality: nullable on persisted `Sample` data, required on both create schemas, and excluded from the generic sample update contract; extract touched sample schemas if needed to keep files within repository size limits.
- [x] 3.2 Update `createSample` and `accessionAndAssignTests` plus their client-action wrappers/types to pass `sample_quality` to the new RPC signatures without changing existing role guards or error handling.
- [x] 3.3 Ensure both success payload paths preserve current sample/result behavior and do not map `sample_quality = FALSE` to rejection, discard, status changes, or a required reason.
- [x] 3.4 Make the Phase 1 application contract tests pass and run the focused auth/client-action regression tests for the immediate blast radius.

## Phase 4: Desktop And Mobile Accession UI

- [x] 4.1 Build a focused sample-quality field using two directly visible Shadcn `Checkbox` controls labeled `Đạt` and `Không đạt`; do not use a dropdown/select, and implement an accessible single-selection state with no default.
- [x] 4.2 Place the quality field immediately below `Loại mẫu` in the desktop accession form and keep the existing `Thời gian nhận` and test-assignment layout stable.
- [x] 4.3 Place the same field immediately below `Loại mẫu` and before `Thời gian nhận` in the mobile customer/sample step, then show the selected value in the mobile review step.
- [x] 4.4 Disable save/confirm while no quality is selected, retain submit-time validation as a second guard, preserve the selection across the no-tests confirmation dialog, and reset it for a new accession.
- [x] 4.5 Make the Phase 1 UI tests pass and verify the desktop/mobile layouts do not overlap, shift unexpectedly, or expose both checkboxes as selected.

## Phase 5: Database Enforcement And Security Closeout

- [ ] 5.1 Create the next forward-only enforcement migration with baseline assertions that the quality-aware RPC signatures and nullable column from Phase 2 are present.
- [ ] 5.2 Revoke and drop the legacy RPC signatures so authenticated callers cannot bypass the required quality value, while preserving the quality-aware signatures and their exact least-privilege grants.
- [ ] 5.3 Add a `public.samples` guard that rejects new INSERTs with `sample_quality IS NULL` without backfilling or blocking unrelated updates to historical rows.
- [ ] 5.4 Update existing SQL fixtures and tests that insert directly into `public.samples` so post-enforcement coverage supplies an explicit quality value where the row represents a new accession.
- [ ] 5.5 Register or extend `run_security_tests()` coverage for RPC role checks, grants, insert enforcement, RLS preservation, historical `NULL` rows, and audit behavior; keep the enforcement migration unapplied until Phase 6.

## Phase 6: Rollout And Verification

- [ ] 6.1 Run focused Vitest and SQL source-level suites for accession UI, mobile wizard/review, Server Actions, client-action routing, migrations, and affected direct-insert fixtures, followed by `npm run typecheck`, relevant lint checks, React Doctor, and browser verification at desktop/mobile viewports.
- [ ] 6.2 Confirm no unrelated sample list/report/filter behavior changed, document intentionally deferred display/reporting work as follow-up issues, then commit and push the implementation from the source workspace.
- [ ] 6.3 Pull the exact pushed commit on the home server and prepare the application build before changing database contracts.
- [ ] 6.4 Apply the compatibility migration through `sudo -n docker exec ... psql`, refresh/restart PostgREST so the new overloads are visible, run all SQL regression tests plus `SELECT * FROM run_security_tests();`, and verify existing rows remain `NULL`.
- [ ] 6.5 Deploy the application using the quality-aware RPC signatures and smoke-test all four combinations: `Đạt`/`Không đạt` with and without assigned tests, plus missing-selection rejection on desktop and mobile.
- [ ] 6.6 Apply the enforcement migration only after the new application is verified, refresh/restart PostgREST again, rerun all SQL/security tests, and confirm legacy RPC signatures are no longer executable.
- [ ] 6.7 Verify live schema, RPC signatures, grants, RLS policies, sample triggers, audit logs, application health, and final git synchronization; use a new forward-only migration for any rollback correction.
