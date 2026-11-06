# TASK-12 evidence and verification plan

This file separates authored source checks from executed runtime evidence. Checkpoint 0 covers artifacts; Phase 1 below records the implemented HTTP/status source and unapplied migration.

## Checkpoint 0 — 2026-11-06, accepted by root

Root independently reviewed the approved contract, proposal/design/spec/tasks and reran strict OpenSpec validation: PASS. Released Phase 1 source only, including the necessary forward-only lock-aware status RPC source. Phase 2/3 and runtime operations remain unreleased. Root baseline verification: preview route, confirmation preparation and adapter tests, 3 files / 89 tests PASS before implementation.

- Source baseline: main `89ee7a06a8d206f085eaa67b6af37cfdd4a6b45e`; inspected clean at start.
- Read TASK-12/#140, approved #112/#113 contracts, implementation partition, TASK-11 design/tasks/evidence and lead handoff `/tmp/lims-lite-task12-lead-handoff-2026-11-06.md`.
- Confirmed existing adapter is unreferenced outside tests; preview route is preparation/cancellation only. Reuse the adapter, request/session boundary, bounded transport and existing lease heartbeat; no alternate writer.
- Confirmed source migrations through 239 have preparation/confirm locking but no general lock-aware status RPC. Root accepted necessity of a new forward status RPC source; candidate 240 must be rechecked before authoring.
- GitNexus index is stale (`0d62612` versus current baseline); targeted reads supplied current facts. No graph reindexing or generated repo-file modification occurred.
- Agentmemory first query returned no TASK-12 matches; shorter recall returned unrelated historical records, so no current TASK-12 fact relies on them. Local memory pointed to earlier phase boundaries; current repo/handoff supersedes older progress snapshots.
- Runtime state is handoff-derived: SQL 235→238→239 installed, deployed app `7e1888a`, TASK-11 OPEN 26/28 with 4.4/4.5 INCOMPLETE. No live recheck occurred here.
- `rtk proxy openspec validate add-accession-confirmation-recovery --strict --no-interactive`: PASS. `openspec status --change ... --json`: all four schema artifacts done/apply-ready; implementation remains unstarted.
- `rtk proxy git diff --check`: PASS; explicit recursive artifact whitespace/local-link check: PASS after correcting three relative doc links. Six new artifact files, all below 350 lines; Git status contains only this change directory.
- Lint/typecheck/application tests are NOT RUN for this documentation-only checkpoint. Root separately reports existing preview/confirm/preparation baseline 3 files/89 tests PASS; this is regression baseline, not new RED evidence.

## Phase 1 retained runnable checks

Use existing Vitest and repository patterns, with exact filenames selected before RED. Planned files: route test beside `src/app/api/accession-confirmation/[batchId]/route.ts`, a server-only status test under `src/lib/accession-preview/`, a status migration source test and `tests/accession-confirmation-status.sql`. Leave runnable checks in the repository; do not add a testing framework.

| Scenario | Source proof | Real-runtime gate |
| --- | --- | --- |
| Anonymous/manager/nonowner/withdrawn role and confidentiality | Route/session mocks plus status adapter/source guard tests | Authenticated HTTP and SQL guards, no status existence leak |
| Strict fields, literal true, malformed/duplicate multipart and 9,999,999/10,000,000/10,000,001 source bytes | Route admission RED→GREEN; retain preview tests | Actual proxy+app boundary and no disk buffering |
| Changed source/intent/version, authority drift, attestation | Existing preparation/confirm regressions plus route delegation once | Isolated real authenticated adapter with installed SQL |
| Busy lock/missing row/DB-clock expiry | Adapter allowlist and migration structure/security checks | Two-session retained SQL lock scenario; accepted transaction crossing TTL |
| Receipt no workbook, owner/batch/count invariants | Strict response schemas and success-repeat tests | Committed receipt lookup, confidentiality/RLS |
| Abort before dispatch versus lost response/timeout after dispatch | Distinct route mocks showing zero/one adapter call, safe unknown | Before/after-commit injected disconnect and durable counts/audit |
| No workbook/full payload retention | Inspect touched source and error/log surfaces | Proxy/temp/cache/log/disk/DB inspection in authorized environment |

Commands follow the repository's working invocation: `rtk proxy npx vitest run <focused files>`, touched-file ESLint, `rtk npm run typecheck`, `rtk proxy openspec validate add-accession-confirmation-recovery --strict --no-interactive`, and tracked/new-file diff/whitespace checks. Run only focused blast radius; record failing assertion before implementation and exact passing totals after it.

The SQL fixture must be rollback-only for data, create controlled actors/batches only in an authorized isolated environment and retain a two-session lock/concurrency runbook. It must assert status does not change state/audit, processing exposes no IDs, missing rows do not become processing, current actor revocation/confidentiality is enforced, and committed receipt remains retrievable without source. Source test registration is not executed SQL proof.

## Later source and runtime evidence

Phase 2 adds status-before-retry/linked-attempt and lost-file scenarios. Phase 3 adds lease fencing, stale heartbeats, abandoned preparing, restart/outage and lock-safe purge scenarios. Each requires its own RED→GREEN and independent root review before promotion.

Actual migrations, SQL fixtures, `run_security_tests()`, SSH/Docker operations, deploy, proxy inspection, authenticated smoke, fixture creation, purges and fault injection are **NOT RUN / NOT AUTHORIZED** at checkpoint 0. No operation uses Supabase MCP or CLI. Historical migrations remain immutable.

TASK-11 4.4/4.5 remain **INCOMPLETE** until the separately authorized real request-bound adapter smoke, exact image/source mapping and root review. TASK-7 capacity/timing/poll/retry/purge budgets and TASK-13 UI acceptance remain separate. Source mocks, registered SQL checks and application health cannot promote those gates.

## Phase 1 — worker source evidence, 2026-11-06; pending root review

Implemented GET/POST `/api/accession-confirmation/[batchId]`, strict server-only status response validation, shared existing preview/session/multipart admission and private migration240 status RPC source. POST authenticates and obtains protected status before source reads; processing/unknown/terminal returns do not redispatch. A fresh valid preview passes only exact source bytes and true attestation into the unchanged `confirmAccession` core once. Status and succeeded repeats require no workbook or confirmation-only policy/key configuration. All responses are private/no-store; errors are safe Vietnamese strings or allowlisted state/reason metadata.

The status RPC authorizes the service caller plus active owner analyst/confidentiality before exposing even processing, isolates `FOR UPDATE NOWAIT` inside its exception block, explicitly denies absent rows and checks protected committed state after locking. Unlocked expiry uses DB clock without lifecycle mutation. Success returns only validated owner/batch/count receipt fields. No status read writes audit or batch state. Migration240 registers its security test with `run_security_tests()`; that registration is source, not executed SQL evidence. The rollback-only SQL fixture reuses the existing TASK-11 synthetic seed; the new two-session runbook explicitly requires committed isolated setup for real busy-lock proof.

### RED observations

```sh
rtk proxy npx vitest run 'src/app/api/accession-confirmation/[batchId]/route.test.ts' src/lib/accession-preview/status.test.ts tests/accession-confirmation-status-migration.test.ts
```

Clean initial RED: **exit1, 3 files / 55 tests failed**, 763ms. Expected reasons: route/status module absent, migration existence false, and migration/SQL fixture ENOENT. An earlier run had two missing-module synchronization rejections; tests now import before waiting and the clean rerun had **no unhandled rejection or timeout**. No implementation existed at clean RED.

Self-review added an elapsed-preflight regression:

```sh
rtk proxy npx vitest run 'src/app/api/accession-confirmation/[batchId]/route.test.ts' -t 'counts preflight elapsed'
```

Observed **exit1, one failed / 32 skipped**, assertion **expected200 to be408**. The HTTP deadline had restarted after preflight. The fix uses request start plus existing measured timeout and checks it before source reading. No timing budget was invented.

### GREEN and scoped gates

```sh
rtk proxy npx vitest run 'src/app/api/accession-confirmation/[batchId]/route.test.ts' src/lib/accession-preview/status.test.ts tests/accession-confirmation-status-migration.test.ts src/app/api/accession-preview/route.test.ts src/lib/accession-preview/confirm.test.ts src/lib/accession-preview/confirmation.test.ts
rtk proxy npx eslint 'src/app/api/accession-confirmation/[batchId]/route.ts' 'src/app/api/accession-confirmation/[batchId]/route.test.ts' src/app/api/accession-preview/route.ts src/lib/accession-preview/http.ts src/lib/accession-preview/status.ts src/lib/accession-preview/status.test.ts tests/accession-confirmation-status-migration.test.ts
rtk npm run typecheck
rtk proxy openspec validate add-accession-confirmation-recovery --strict --no-interactive
rtk proxy git diff --check
```

- Focused Vitest: **exit0, 6 files / 146 tests PASS** (57 new plus unchanged baseline89). Actual byte boundary tests cover 9,999,999 / 10,000,000 / 10,000,001; auth/OTP/owner preflight protects body reads; before-dispatch cancellation and after-dispatch disconnect/deadline are separate; adapter receives no cancellation signal and is never retried.
- Touched ESLint and typecheck: **PASS**, rerun after the final code change. OpenSpec strict and diff-check: **PASS**; explicit new-file whitespace/local-link checks recorded at handoff.
- `confirm.ts` and `confirmation.ts`: byte-for-byte equal to HEAD. Historical migrations233–239: SHA-256 comparison **PASS** against preimplementation captured hashes. No historical SQL was edited.
- Migration240 SHA-256: `e7cfb095980be3648d667f6ccf49deb368a2acabb886a508aeb99bb88046276a`. Its baseline expects migration239 `confirm_accession_import` body SHA-256 `16451f917b161ed8cb3efe4a463f4ebc56de9239e1a9d725122a29ca0fee4122`; root independently corroborated this extraction.
- Source self-review checked no alternate writer, per-row loop, automatic retry, file/full-payload logging, filesystem write, business caps, new dependency or UI. Shared helper extraction has two real callers; existing preview regression stays GREEN.
- Root independently verified frozen code: expanded accession-preview libraries plus preview/confirm routes and SQL-source checks **10 files / 208 tests PASS**; typecheck, touched seven-file ESLint, strict OpenSpec and diff-check **PASS**. Root independently compared historical233–239 and core confirmation files byte-for-byte with baseline. Independent Standards and Spec reviewers found no concrete blockers; these source results do not close runtime gates.

Root accepts Phase 1 **SOURCE ONLY**, tasks1.1–1.9 complete; total OpenSpec progress **12/27**. Phase2/3 and runtime remain unreleased. **Migration240 application, actual SQL fixtures/security execution, authenticated adapter smoke, concurrency/fault injection, proxy/no-retention inspection, recovery/physical purge and deployment: NOT RUN.** No SSH, Docker, database, fixture creation or purge operation occurred. TASK-11 remains OPEN26/28 with4.4/4.5 INCOMPLETE. Root owns source commit/push and remote-ref verification.
