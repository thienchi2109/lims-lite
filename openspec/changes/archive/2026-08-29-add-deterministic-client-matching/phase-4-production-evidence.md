# Phase 4 Production Evidence

## Scope and landing point

- Phase 4 only (`4.1-4.11`) was implemented. Issue #126, Phase 5, shadow
  comparison, legacy caller cutover, client merge, UUID replacement, and
  sample/history relinking remain excluded.
- The implementation landed locally on `main` through:
  - `2ca1a50160a1626ee4932908db6f05033dd520b4`
    (`feat: Add deterministic client resolver Phase 4 (#111)`)
  - `023e0e8a531a60881a28d2f0473c47a5d6a8b72d`
    (`fix: Harden deterministic client resolver role guard (#111)`)
- Review findings were addressed before landing. Per user direction, no second
  review was requested after the findings pass.

## Immutable migrations

- Migrations `215-220` remained byte-for-byte unchanged after production
  deployment.
- Gate B applied these committed migrations in order through SSH and
  `sudo -n docker exec ... lims-postgres psql`:
  - `221_add_deterministic_client_resolver_v2.sql`:
    `8e0058aeeb3987f24466acac7b89af884b8e89a40cf0a5c19c4250b761a26783`
  - `222_harden_deterministic_client_resolver_v2.sql`:
    `dd5eab5d97f1acca06dae074f66b49fc1da69885bc75db4cffd5d213f4d02d08`
  - `223_fix_client_resolver_role_guard.sql`:
    `faad0e76d51d4ea09b36fbfbe88339f19db1c1c5a289487f502d91d6fafb144e`
- Migration `222` had already been applied to the isolated rehearsal database
  when its enum-coercion role-guard defect was found. It was not edited.
  Migration `223` is the forward-only correction.

## Gate A

- The server-only resolver adapter, strict contracts, Vietnamese outcome/reason
  mapping, API bridge, role guard, and legacy named-constraint sanitization were
  deployed before Gate B.
- Gate A used `ops/home-server/deploy.sh` from committed source. Production
  remained on the Phase 3 database state after the app deployment:
  resolver v2 functions and the trusted typed-ID index were absent.
- Existing business workflows do not select v2. Source search finds v2 only in
  the additive server/API adapter boundary and its operation declarations.
- The existing GitHub deploy workflow was not used or modified. Deployment
  followed the approved home-server SSH path.

## Gate B

- The read-only Phase 3 checkpoint passed with
  `expected_unresolved_pairs=0` and ended in `ROLLBACK`.
- Pre-apply production state contained 63 clients, 20 trusted CCCD rows, one
  trusted CMND row, 42 untrusted identities, 97 sample links, four
  adjudications, zero projection mismatches, and zero trusted typed-ID duplicate
  groups.
- Migrations `221`, `222`, and `223` each completed with `COMMIT`.
- PostgREST received `NOTIFY pgrst, 'reload schema'`; the `rest` service was
  restarted and returned to a running state.
- Post-apply production state preserved all aggregate counts above, with zero
  projection mismatches and zero trusted typed-ID duplicate groups. Both v2
  RPCs and the trusted typed-ID uniqueness index are present.
- No production concurrency fixture was executed because the test commits and
  removes synthetic rows. The overlapping, non-identical sorted-lock-set
  concurrency regression passed on the isolated rehearsal database.

## Verification

- TDD coverage includes typed CCCD/CMND precedence, unknown strong identities,
  lifecycle, exact/accent-only name collisions, phone guards, duplicate and
  cross-key evidence, restricted candidates, missing identity, all four
  outcomes, sorted lock sets, and named uniqueness re-resolution.
- Focused client/accession/profile Vitest: 42 files, 262 tests passed.
- Focused Phase 4/static Vitest: 16 files, 140 tests passed.
- Production `tests/client-resolution.test.sql` passed and ended in `ROLLBACK`.
- Production `tests/client-resolution-security.test.sql` passed and ended in
  `ROLLBACK`.
- Production `run_security_tests()` passed 35/35.
- Typecheck and `check:no-explicit-any` passed.
- Lint completed with zero errors and 80 pre-existing warnings.
- React Doctor exited successfully with no findings in the eight changed source
  files.
- Strict OpenSpec validation passed.
- Production HTTP smoke returned 200 for root, auth health, and public CoA
  access.

## Verification waiver and residual gaps

- On 2026-08-22, the user explicitly directed that browser tests and Playwright
  must not run. No browser or Playwright command was executed. Authenticated
  browser collision smoke is therefore waived; localized collision handling is
  covered by focused action/route contract tests, and production application
  availability is covered by HTTP smoke.
- No Supabase MCP or Supabase CLI operation was used.
- Phase 5 remains pending. No current bulk import, QR/manual accession, profile,
  or client-upsert caller selects resolver v2.
