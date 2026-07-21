# Phase 6 Rollout Evidence

This file records the source, deployment, database, and security verification
used to close Phase 6 of `add-sample-quality-assessment` on 2026-07-21.
Migrations 189 and 190 were already applied and immutable, so the closeout
verified their live state instead of attempting to reapply them.

## Source Verification

- Focused Vitest and immediate read-path blast radius: 18 files, 114 tests
  passed.
- `npm run typecheck`: passed.
- `npm run check:no-explicit-any`: passed.
- Full ESLint: exit 0 with 0 errors and 92 existing warnings.
- React Doctor: exit 0 with 334 existing warnings across 126 of 647 files.
- Browser verification was explicitly waived by the user. Desktop and mobile
  required-selection behavior remained covered by focused component tests.
- Deferred read-only display is tracked in GitHub Issue #89.
- Deferred filtering and reporting is tracked in GitHub Issue #88.

## Deployment

- Source `main` was pushed before production deployment.
- The home-server checkout pulled exact commit
  `2852193fc4b3996f2b37f5304a0963681d121e29`.
- The `app` image was rebuilt and the service was force-recreated.
- PostgREST was restarted after deployment.
- The application reported `healthy`; PostgREST reported `running`.
- Application and PostgREST logs contained no `error`, `fatal`, or `panic`
  lines during the post-deployment verification window.

## Database And Security

- `public.samples.sample_quality` is `BOOLEAN NULL` with no default.
- All 80 historical samples remain `NULL`; no backfill occurred.
- Only the six-argument quality-aware `create_sample_atomic` and
  `accession_and_assign_tests` signatures remain.
- Both RPCs remain `SECURITY DEFINER`, use fixed
  `search_path=public, extensions`, allow `authenticated` execute, and deny
  `anon` and `service_role` execute.
- RLS remains enabled on `public.samples`.
- The sample audit, analyst receiver, quality enforcement, search update,
  client-name sync, status transition, and updated-at triggers remain enabled.
- `run_security_tests()` passed 29 of 29 checks.
- Migration checksums matched between the source workspace and home server:
  - `189_add_sample_quality_compatibility.sql`:
    `683a968847d34ffded5d2b21de0bc97ae57c83dda0990ed4b8ce59fd8c728956`
  - `190_enforce_sample_quality.sql`:
    `a9691ffbaad1c3b40fb530316396c09a6e6bc996d2555c41b9b79f7d18648308`

## Runtime Smoke Tests

A rollback-only live SQL smoke test passed all four combinations:

- `Không đạt` without assigned tests.
- `Đạt` without assigned tests.
- `Không đạt` with assigned tests.
- `Đạt` with assigned tests.

The smoke test also verified audit JSONB values and rejection of `NULL` quality
on both RPC paths. After rollback, the database still contained 80 samples and
all 80 historical rows remained `NULL`.

All 31 SQL files were executed with rollback protection. Nineteen passed,
including all three sample-quality schema, runtime, and enforcement suites.
Twelve unrelated suites failed because of stale schema expectations or missing
fixtures; remediation is tracked separately in GitHub Issue #90.
