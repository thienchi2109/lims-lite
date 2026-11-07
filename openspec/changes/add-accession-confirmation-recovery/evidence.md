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

## Phase 2 source release — 2026-11-06

User explicitly released Phase 2 with a new `gpt-6.1-sol/high` worker; root retains coordination, independent verification and landing. Baseline clean main `7ec1c732757a3e92473cddc97df0f68ef7e03502`; Phase 1 is pushed and accepted. Using change `add-accession-confirmation-recovery`, tasks2.1–2.4 only; Phase 3 and runtime remain unreleased.

Root reviewed the approved contract and accepted the narrow client/status-before-retry integration and browser-safe schema reuse. A read-only `gpt-6-luna/max` scout independently corroborated migration234's blocking parent `FOR SHARE`, its allowed `succeeded` parent and exclusion of `preview_ready`; insert triggers do not enforce retry eligibility. Root therefore authorized next-unused migration241 source to reuse migration240's lock-aware status inside the start transaction, retain the parent lock through child insertion, admit only unlocked preview_ready/failed/rejected/expired and preserve parent state. Historical233–240 remain unchanged. No SQL application or runtime access is authorized by this source release.

## Phase 2 worker source evidence — 2026-11-06; pending root acceptance

Clean RED, before client or migration241 implementation:

```sh
rtk proxy npx vitest run src/lib/api-client.accession-confirmation.test.ts tests/accession-preview-retry-migration.test.ts
```

**Exit1, 2 files / 41 failed**, 1.01s. All37 browser cases failed because the three confirmation/retry client exports were absent; four source checks failed because migration241 and its rollback fixture were absent. No unhandled rejection, timeout or fixture execution occurred.

GREEN uses the existing `api-client.ts` response/session conventions and existing `http-contract.ts`, with one shared strict status/receipt allowlist consumed by server and browser. Every explicit confirmation/replacement first performs a credentialed no-store status GET. Only ready plus the selected original file and literal true attestation sends one confirmation POST; missing file returns ready without reconstructing a body. Transport/DB/proxy/malformed-result uncertainty returns unknown, and another explicit action starts with a fresh GET. A success receipt requires no file. Explicit replacement uses existing preview multipart `retryOfBatchId`, admits terminal or unlocked ready status, and never starts for processing/unknown/preparing/succeeded.

Migration241 replaces only `start_accession_preview`, reusing owner/confidentiality/NOWAIT/logical-expiry status within the same transaction. The parent lock survives through the child INSERT, and disallowed status raises an admission error before any child exists. Parent state/commitment/receipt are unchanged. Its baseline binds the original234 start body hash `cadd2bd966dcc96326af313fe719f36d71a8904abdc6ef40ac6abc51533bb371` and verifies240 security; its new private security check binds the resulting start body and is registered in `run_security_tests()`. This is source validation, not executed SQL proof.

Verification:

```sh
rtk proxy npx vitest run src/lib/api-client.accession-confirmation.test.ts tests/accession-preview-retry-migration.test.ts
rtk proxy npx eslint src/lib/api-client.ts src/lib/api-client.accession-confirmation.test.ts src/lib/accession-preview/http-contract.ts src/lib/accession-preview/confirmation.ts src/lib/accession-preview/status.ts tests/accession-preview-retry-migration.test.ts
rtk npm run typecheck
rtk proxy openspec validate add-accession-confirmation-recovery --strict --no-interactive
rtk proxy git diff --check
```

- Latest focused GREEN: **2 files / 46 tests PASS** (41 browser, five SQL-source), 1.01s; lint **PASS, zero warnings**, typecheck **PASS**. Added checks distinguish failed GET before dispatch, dispatched response loss before commit followed by ready reconciliation/file loss/explicit retry, and response loss after commit followed by file-free receipt without another POST. HTTP status/outcome mismatch, foreign batch, invalid counts, unsafe fields and terminal/same-owner-linked admission are covered at their source boundaries.
- Immediate regression command: `rtk proxy npx vitest run src/lib/api-client*.test.ts 'src/app/api/accession-confirmation/[batchId]/route.test.ts' src/lib/accession-preview/status.test.ts src/lib/accession-preview/confirm.test.ts src/lib/accession-preview/confirmation.test.ts 'src/app/api/accession-preview/route.test.ts' src/lib/accession-preview/server.test.ts src/lib/accession-preview/cancellation.test.ts tests/accession-confirmation-status-migration.test.ts tests/accession-preview-retry-migration.test.ts tests/accession-confirmation-atomic-migration.test.ts tests/accession-confirmation-validation-migration.test.ts`: **16 files / 244 PASS**, 5.16s, before the final four test-only assertions; the latest focused46 includes those assertions. OpenSpec strict **PASS**.
- Historical233–240 compared byte-for-byte with HEAD: **PASS, eight files**. Core `confirm.ts` and confirmation route are untouched; `confirmation.ts` changes only its receipt-schema import/reexport. Migration241 file SHA-256: `3d72f86e0fce39ed675d28f5b40666ecbe1b2146962cc9ca99b9014540d4e02a`; resulting start body: `ea7ca3a2ec4a91f93894dcbf0ede4a1805cf7c8a18b5c1d28b7f8140326368a8`.
- `api-client.ts` already contains mixed line endings. Repeated `apply_patch` inserted CRLF into new lines and diff-check rejected them. Root authorized a reversible native-git repair: capture the exact file diff, back up the file with trap restoration, strip CR only from added patch lines, reverse/apply that patch with `git apply --whitespace=fix`. Unchanged bytes outside47 added/one removed line compare exactly with HEAD; old CRLF count319 becomes318 because the replaced import had one CRLF. No whole-file normalization. Final diff-check **PASS**.
- New/expanded files are below350 lines; no dependency, UI, polling scheduler, lifecycle framework, alternate writer, payload reconstruction or persistent source storage was added. Existing `api-client.ts` exceeds350 before this task and retains its established mutation boundary.

Retained `tests/accession-preview-retry.sql` reuses the rollback-only synthetic seed and asserts actual ready/logical-expired/terminal linked admission, parent immutability, same-owner/role denial, zero child on rejected admission and succeeded receipt precedence. Expanded `tests/accession-confirmation-status-concurrency.md` gives concrete processing/no-official-ID and retry-race assertions around the existing controlled accepted precommit pause, committed receipt reconciliation, rollback, and the opposite parent-lock direction. All are **NOT RUN**.

**Migration240/241 application, actual SQL/security fixtures, two-session concurrency/fault injection, authenticated adapter smoke, proxy/no-retention inspection, recovery/physical purge and deployment: NOT RUN.** No SSH/Docker/DB or runtime operation occurred. TASK-11 remains OPEN26/28, gates4.4/4.5 INCOMPLETE. Application/SQL code is frozen for root's independent review; root owns task acceptance, issue/backlog status, commit and push. Phase3 remains unreleased.

### Root acceptance — Phase 2 SOURCE ONLY

Root independently ran the frozen source:

```sh
rtk proxy npx vitest run src/lib/api-client*.test.ts src/lib/accession-preview src/app/api/accession-preview/route.test.ts src/app/api/accession-confirmation tests/accession-confirmation-status-migration.test.ts tests/accession-preview-retry-migration.test.ts
```

**16 files / 270 tests PASS**, exit0. Independent typecheck, touched six-file ESLint, strict OpenSpec and diff-check **PASS**. Separate Spec and Standards reviewers found no concrete blockers. Root inspected the client outcome validation and SQL lock scope, independently derived both start-function hashes and confirmed eight historical migrations233–240 plus `confirm.ts` byte-for-byte unchanged. Reconstructing the old API client after removing new functions and restoring its modified schema import matches the baseline bytes exactly.

Root accepts tasks2.1–2.4 **SOURCE ONLY**, total **16/27**. Stop before Phase3. Runtime gates above remain **NOT RUN**, including applying240 then241 and running SQL/security/concurrency evidence; no claim of authenticated end-to-end behavior. Root owns source landing and remote-ref/issue verification.

## Phase 3 source release — 2026-11-06

User released Phase 3 with a `gpt-6.1-sol/high` implementation worker and Luna read-only scouts. Baseline clean main `dbd067ecf991ffdb00c660e4d623c3bcc6facd83`. Root retains coordination, verification and landing; tasks3.1–3.5 only, no runtime release.

Two `gpt-6-luna/max` scouts independently established the existing worker build/entry convention and DB lease/guard/receipt constraints. Root accepted a separate explicitly enabled one-shot native-PG runner, existing `build:worker`, one package entry and no Compose/image/dependency changes. Source242 supplies recovery/purge, a narrowly granted native maintenance login, transaction-scoped private capability for guarded binding deletion/system attribution, and reduced post-purge non-success status. Historical233–241, durable provenance and sealed metadata remain unchanged. Measured operation budgets, scheduler/provisioning and all real SQL/security/concurrency work remain separate runtime gates.

RED evidence correction: the first reported30 runtime failures were caused by an invalid jsdom harness and are **not valid behavior RED**; the six missing SQL-source checks were valid. After fixing the harness and returning to an absent-runtime baseline, root independently ran `rtk proxy npx vitest run src/workers/accession-confirmation-maintenance/runtime.test.ts --reporter=json`: **exit1, 0 passed / 30 failed**, every failure the explicit missing-maintenance-runtime assertion, no stderr. A temporary runtime implementation/green preceded this corrected baseline rerun; that chronology is retained, not described as an original clean36 RED. Worker must revalidate GREEN after restoring implementation. No worker entrypoint or DB was executed.

## Phase 3 worker source evidence — 2026-11-06; frozen for root review

After root independently accepted corrected RED, restoring the runner produced **30/30 PASS**. A supplemental native-PG error-event regression then produced **30 PASS / 1 FAIL**: an unhandled driver event could expose a raw database error. The retained fix registers the same interruption observer for native error events; the final runtime suite is **31/31 PASS**. Initial missing-migration/fixture RED was six failed source checks; two additional source checks bind the exact guard/status replacements and capability lifetime. These structural checks are **not PostgreSQL behavior proof**.

Final focused command, **2 files / 39 tests PASS**, exit0:

```sh
rtk proxy npx vitest run src/workers/accession-confirmation-maintenance/runtime.test.ts tests/accession-import-maintenance-migration.test.ts
```

Immediate preview/confirm/status/client and existing approval-worker regressions, **23 files / 306 tests PASS**, exit0:

```sh
rtk proxy npx vitest run src/lib/api-client*.test.ts src/lib/accession-preview src/app/api/accession-preview/route.test.ts src/app/api/accession-confirmation tests/accession-confirmation-status-migration.test.ts tests/accession-preview-retry-migration.test.ts src/workers/approval-batches tests/approval-batch-worker-compose-config.test.ts
```

Final touched four-file ESLint, `rtk npm run typecheck`, `rtk npm run build:worker`, strict OpenSpec and `git diff --check`: **PASS**. New untracked source files were also checked explicitly for whitespace. All nine historical migrations233–241 remain byte-for-byte identical to `dbd067ecf991ffdb00c660e4d623c3bcc6facd83`. Existing worker/app source, compiler config, Compose/images and dependencies are unchanged; only the new package start script joins the new files. New implementation/fixture files are below350 lines.

Migration242 validates exact guard/status/start/heartbeat/finalize baselines, uses four unique source replacements, and verifies exact resulting guard/status/maintenance hashes in its registered security check. Recovery/expiry, private authorization, transient deletion and safe system audit form one transaction. The caller must be the pinned native session or PostgreSQL's access-checked `service_role`; JWT/custom flags cannot grant maintenance. An unexpected receipt/state fails closed. Existing heartbeat/finalization reject stale state/token/generation/expiry, so immutable lease generation is preserved. Eligible rows drop out after reconciliation, allowing repeated one-shot invocations to catch up after missed deadlines without a count cap. Locked accepted confirmations are skipped.

Retained runnable SQL: `tests/accession-import-maintenance.sql` uses the existing disposable synthetic rollback seed; covers abandoned/live leases, stale heartbeat/finalization, idempotence, exact metadata and actual-success receipt/mapping/business retention, effective privileges, transaction capability cleanup, lifecycle/cleanup audit failure rollback and reduced confidential terminal status. `tests/accession-import-maintenance-concurrency.md` retains separate-session lock/admission/TTL races, generation mismatch, outage/restart, backlog catch-up and native-login acceptance. **Both are NOT RUN**. SQL parsing, actual function execution, security registration/counts, PostgreSQL locks and authenticated behavior remain unverified by source tests.

Runtime wiring: compiler output includes the new directory; `start:accession-maintenance` targets its `main.js`. No scheduler or Compose service is enabled. The existing worker image contains worker output with its approval CMD unchanged; the Next standalone image does not package this runner. Before a separately authorized runtime release, require all `ACCESSION_MAINTENANCE_*` configuration: `ENABLED=true`, `POLICY_ID` referring to measured TASK-7 evidence, positive native-range `DATABASE_OPERATION_TIMEOUT_MS`, explicit database `HOST/PORT/NAME/USER` (user pinned `accession_maintenance_worker`) and protected `DATABASE_PASSWORD_FILE`; inline password is rejected. Disabled startup reads no credential and creates no connection. The source role has no password; credential provisioning and effective PUBLIC privileges require runtime verification. There is one maintenance RPC per invocation, no confirmation dispatch, polling or retry framework, and no default timing budget.

Signals and native client errors mark the outcome uncertain, drain the single operation and close the client; the entrypoint logs only allowlisted outcome/counts or a generic failure code. A client query timeout/disconnect does **not** prove a server rollback or persisted failure audit. A later invocation reconciles committed DB state and never replays business writes. Scheduler/drain/DB policy and backlog service levels remain TASK-7 measurements. No SSH, Docker, DB, worker entrypoint, fault injection, deployment, migration apply, fixture creation or physical purge was executed here. Runtime migrations240/241/242, SQL/security/concurrency/proxy/no-retention/native-login gates remain **NOT RUN**; TASK-11 stays OPEN26/28 with4.4/4.5 **INCOMPLETE**. Root owns final acceptance, issue updates, commit and push.

### Root acceptance — Phase 3 SOURCE ONLY

Root independently ran the frozen application/SQL source:

```sh
rtk proxy npx vitest run src/lib/api-client*.test.ts src/lib/accession-preview src/app/api/accession-preview/route.test.ts src/app/api/accession-confirmation src/workers/accession-confirmation-maintenance tests/accession-confirmation-status-migration.test.ts tests/accession-preview-retry-migration.test.ts tests/accession-import-maintenance-migration.test.ts
```

**18 files / 309 tests PASS**, exit0. Independent typecheck, touched four-file ESLint, worker build and strict OpenSpec **PASS**. Separate Spec and Standards reviewers found no concrete blockers. Root independently emulated all four unique source replacements and reproduced the resulting guard/status hashes; this does not prove SQL parsing or execution. Historical migrations233–241 match baseline `dbd067ecf991ffdb00c660e4d623c3bcc6facd83` byte-for-byte. Existing worker/Compose/images/compiler/dependencies are unchanged. The compiled package entry exists; it was never executed.

`apply_patch` repeatedly emitted CRLF on the two touched package script lines. Root authorized removal of exactly those two CR bytes after reproducing the limitation. Removing the new script line from the repaired file reproduces baseline package bytes exactly; root independently confirmed this and `git diff --check` PASS.

Root accepts tasks3.1–3.5 **SOURCE ONLY**, total **21/27**. Task3.2 records corrected mocked runtime/source RED and retained SQL/concurrency scenarios, not actual database races. All six runtime tasks4.1–4.6 remain unchecked. Migrations240–242 are **UNAPPLIED**; SQL/security/locks/audit atomicity/native login/proxy/no-retention/authenticated E2E remain **NOT RUN**. No deployment or runtime release is implied. TASK-11 remains OPEN26/28 with4.4/4.5 INCOMPLETE.

## Phase 4 disposable SQL preflight and recovery source — 2026-11-07

The user released Phase 4; root explicitly scoped a home-server-only disposable SQL lifecycle. Home `/opt/lims-lite` fast-forwarded cleanly to `b9bfdb74333bb037c0a9cec6cdaad29d42091f97`; all running container IDs and app image stayed unchanged. This was source synchronization, not deployment. Private home evidence is under `/tmp/lims-lite-task12-phase4-20261107/` (0700); no workbook, business rows, credentials or environment files were exported.

The previously approved schema-only `pg_dump` exception produced a 0600 dump with zero data/COPY/global-role statements. Exactly `task11_disposable_20261107_task12` was created from `template0` and transactionally restored as existing `supabase_admin`. An initial default-locale mismatch was found before migrations; the empty DB was normally dropped and recreated with production's exact UTF8/en_US.utf8 locale. All **58 public/auth/storage ordinary tables were empty**, security **36/36 PASS**. Root independently compared the complete relevant catalogs: **28 functions**, **69 columns**, **59 constraints**, **4 policies**, identical after ordering normalization. Baseline JSON, restore/security logs and container provenance remain private on the home server.

Frozen committed **240 then 241 applied once to the disposable DB only**, with actual `run_security_tests()` **36/36 PASS after each**. Migration **242 failed its final aggregate security verification**: `accession_import_maintenance_authorizations` enabled RLS with no policies. Its transaction fully rolled back: private table, maintenance function and native role absent; status/retry verifiers true; security **36/36 PASS**. No fixture or production migration ran. Historical **233–242 remain immutable**, including the failed persistent 242 attempt.

Worker and root independently reproduced the cause in separate rollback-only probes: an RLS table with no policy makes `test_all_rls_tables_have_policies()` false; adding an explicit PUBLIC deny-all policy makes it true and restores **36/36**. Both probes rolled back. Exact logs include `242_add_accession_import_maintenance.log`, `242-rollback-verification.json`, and `242-policy-root-cause-red-green.log` in the private directory.

New **243** supports verified 241 only, skips 242, and reconstructs its transaction with two corrections: explicit `DROP POLICY IF EXISTS`/`FOR ALL TO PUBLIC USING(false) WITH CHECK(false)`, and a verifier requiring that single exact policy. No role gains table access; guard/status/maintenance bodies, their hashes and all ACLs are unchanged. Existing artifacts or the cluster-global maintenance role reject the baseline. No password or membership has been provisioned.

Retained source RED: `rtk proxy npx vitest run tests/accession-import-maintenance-recovery-migration.test.ts` produced **1 failed / 1 passed**, because 243 was absent (`/tmp/task12-243-source-red.log`). After the repair, the same regression plus `tests/accession-import-maintenance-migration.test.ts` and `src/workers/accession-confirmation-maintenance/runtime.test.ts` passed **3 files / 41 tests** (`/tmp/task12-243-source-green.log`). The new check pins exact reconstructed composition and every historical 233–242 hash. These source results do not prove 243 execution; root review, committed-byte application, fixtures and runtime acceptance remain pending. All Phase 4 task boxes remain unchecked. Production apply/rollout, authenticated adapter, native login, proxy no-retention and process fault gates are **NOT RUN**.

Root accepts the 243 repair **SOURCE ONLY**: independent recovery/maintenance/retry/status source checks **4 files / 19 tests PASS**, touched-test ESLint, strict OpenSpec and diff checks PASS; separate Spec and Standards reviews found no blockers. Root verified frozen 243 SHA-256 `04a633641e54f830ee980e9af9c752f6a3e4edcce76aea4739359e67c790d6bf`. Application remains gated on these committed bytes; this acceptance supersedes the pending source-review statement above and proves no PostgreSQL behavior yet.

Committed repair `4875f6ad19a711096ea0fc799422649f2f569f8c` subsequently applied once to the named disposable DB: **36/36 security PASS**. Root independently verified status/retry/maintenance checks true and the exact PUBLIC false/false policy. Effective native privileges grant no schema/database CREATE or protected-table access; the only other callable public definers are read-only `get_user_role()` and two trigger-return OTP audit functions. The native password remains unset.

Original status and retry SQL fixtures each failed at the existing immutable-user-role guard and rolled back. Only their withdrawn-actor setup changed from an impossible role edit to account deactivation; product guards remain unchanged. A candidate delivery attempt incorrectly expanded dollar quoting and is invalid harness evidence; callback-based include expansion corrected it. Root independently streamed the final exact status, retry and unchanged maintenance fixtures over SSH/Docker/psql: all **exit 0 with ROLLBACK**, with identical before/after counts for users, clients, samples, results, audit, batches, bindings, receipts, mappings and private capabilities (users=1/audit=8; all other listed counts zero). Fixture SHA-256: status `139aa19568c75b1b10dae8010e420b7804274a1608ce51f0aaf8d44293942e23`, retry `04be3e0ee4fbfbd08eccb46034f7a429bf1788bdfd8f4db5f783b9ff9155a504`, maintenance `41b06027ec168fd6a389c3c41bbe95f571f953ee587e727cbcb42570a1c58fa9`. This proves **DISPOSABLE SQL ONLY**; real multi-session, native-login, HTTP and production gates remain pending.
