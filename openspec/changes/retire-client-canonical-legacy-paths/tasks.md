## 1. Observation Evidence Before Implementation

- [ ] 1.1 Review and approve the proposed seven-day UTC observation window and
  representative-activity threshold.
- [ ] 1.2 Deploy a healthy application revision at or after `b9e0247` through
  the home-server operational process and record the exact start timestamp.
- [ ] 1.3 Query PII-free shadow aggregates, aggregate client/sample/audit
  activity, live function dependencies, ACLs, and PostgREST exposure through
  SSH plus Docker/psql only.
- [ ] 1.4 Repeat static code search for compatibility actions, cutover flags,
  shadow RPC calls, direct client writes, and legacy RPC names.
- [ ] 1.5 Commit reviewed observation evidence and classify every candidate as
  `retire`, `retain`, or `investigate`; stop if the window is stale,
  unrepresentative, or inconclusive.

## 2. TDD Application Retirement

- [ ] 2.1 Add failing route/API-client tests proving direct v2 lookup and
  resolve-or-create behavior for every selected caller.
- [ ] 2.2 Add failing tests proving disabled raw upsert remains fail-closed and
  no direct `public.clients` upsert can succeed.
- [ ] 2.3 Add failing compatibility and localization regressions for matched,
  not-found, ambiguous, conflict, inactive, and restricted outcomes.
- [ ] 2.4 Replace approved form, selector, and route callers with direct v2
  server-only/API-client contracts while preserving workflow behavior.
- [ ] 2.5 Remove only approved compatibility dispatch, cutover flags, and
  shadow adapter code after the red tests turn green.

## 3. TDD Database Retirement

- [ ] 3.1 Add a failing migration-shape test for the selected RPC/grant
  retirement, including immutable 230/231 checks and expected live baseline.
- [ ] 3.2 Add rollback-only SQL coverage for retained v2 RPCs, denied direct
  writes, RLS, audit behavior, and unchanged client/sample/result history.
- [ ] 3.3 Verify the actual next migration number at implementation time and
  author one smallest forward-only migration with documented security impact.
- [ ] 3.4 Apply only the committed migration through home-server SSH and
  `sudo -n docker exec ... psql`; do not edit or reapply 230/231.
- [ ] 3.5 Run `run_security_tests()` and verify function signatures, ACLs,
  policies, grants, fixed `search_path`, and PostgREST schema visibility.

## 4. Verification And Closeout

- [ ] 4.1 Run focused client/accession Vitest and SQL suites plus immediate
  sample/result/audit blast-radius regressions.
- [ ] 4.2 Run typecheck, lint, React Doctor, strict OpenSpec validation, health
  checks, and authenticated browser smoke.
- [ ] 4.3 Record post-retirement PII-free evidence and the forward-only recovery
  boundary.
- [ ] 4.4 Commit with a conventional commit, push successfully, and verify the
  local branch is synchronized with its remote.
