## 0. Cross-Phase Delivery Guardrails

- [ ] 0.1 Deliver the change as the ordered PR phases below; do not combine
  phases by default. Combine them only when the resulting contract is easier to
  review and still has one deploy-safe exit gate.
- [ ] 0.2 Before requesting review for every PR, calculate total Git additions
  plus deletions against its base branch. Aim materially below 1,500 changed
  lines, including tests, migrations, documentation, and generated files;
  roughly 1,500 is a reviewability warning rather than a hard limit.
- [ ] 0.3 Reassess scope once a PR approaches 1,000-1,200 changed lines and
  split at the nearest independent deploy-safe boundary when practical. If an
  atomic migration or tightly coupled contract is clearer and safer kept
  together beyond the warning threshold, document that rationale and add
  focused review evidence.
- [ ] 0.4 Keep each PR independently buildable, testable, deployable, and
  reversible through configuration or caller rollback. Do not expose an
  incomplete batch path to managers.
- [ ] 0.5 Rebase each phase on the merged predecessor, rerun its focused gates,
  and record the final changed-line count plus verification evidence in the PR.

## 1. Phase P0 - Approval Baseline and Contracts

**PR boundary:** Characterization tests and typed contracts only. No production
approval behavior, database schema, worker, or UI behavior changes.

- [x] 1.1 Trace and record the current `approveResults` callers, manager OTP
  boundary, `ApproveResultsSchema`, QC RPC, confidential checks, audit triggers,
  submission provenance, sample completion update, and CoA queue/generation
  handoff.
- [x] 1.2 Add characterization tests for successful single approval,
  partial-result approval, final-result sample completion, optional approval
  note, and non-blocking CoA behavior.
- [x] 1.3 Add characterization tests for unauthorized role, missing
  confidential access, non-review sample, non-entered result, cross-sample or
  missing result IDs, QC blocked, malformed QC response, and database failure.
- [x] 1.4 Define strict Zod contracts for single approval, batch submission,
  select-all response, progress, item outcomes, and retry with sanitized
  Vietnamese error mapping.
- [x] 1.5 Confirm the final extension points from
  `optimize-approval-queue-two-phase` and document how later UI phases reuse its
  pagination/query-key contract.
- [x] 1.6 Run the focused approval tests, changed-file lint, and typecheck.

**Exit gate:** Current approval behavior is locked by tests and later phases can
reuse stable typed contracts. Review-size target: about 800 changed lines.

## 2. Phase P1 - Dark Atomic Approval RPC

**PR boundary:** One forward-only migration and focused SQL tests. The existing
application continues using the old approval write sequence.

- [x] 2.1 Add failing SQL tests proving result updates, sample
  status/rejection-reset updates, approval provenance, and audit rows commit or
  roll back together for one sample.
- [x] 2.2 Add failing SQL tests for deterministic row locking, concurrent
  approval attempts, exact selected-result validation, selected results no
  longer being `entered`, later-added results remaining unapproved, and
  idempotent replay.
- [x] 2.3 Add failing SQL tests preserving manager role, current confidential
  access, `review`/`entered` states, QC fail-closed behavior, note bounds,
  immutable submission snapshots, and manager-attributed audit rows.
- [x] 2.4 Create the next-numbered migration implementing the internal atomic
  approval command plus a server-only wrapper with pinned `search_path`,
  explicit revokes from `anon` and `authenticated`, a narrow protected-server
  grant, stable outcome codes, and a `sample_completed` handoff signal.
- [x] 2.5 Extend security tests for anonymous denial, direct password-only
  manager JWT denial, internal-function denial, protected-server access, RLS
  preservation, function grants, and audit attribution.
- [x] 2.6 Commit the migration before applying it; after first application,
  treat it as immutable and use a new migration for every correction.
- [x] 2.7 Apply the committed migration only through the approved home-server
  SSH and Docker path, then run focused SQL suites and
  `SELECT * FROM run_security_tests();`.

**Exit gate:** The unused atomic RPC is deployed and fully verified without
changing user-visible behavior. Review-size target: about 1,200 changed lines;
keep an atomic migration together when splitting would reduce auditability.

**P1 scope assessment (2026-07-26):** The phase contains 1,695 changed lines
(1,688 additions and 7 deletions) in one forward-only atomic/security migration,
its focused runtime/rollback and two-session concurrency suites, and this task
record. This exceeds the 1,500-line review warning but remains one deployable,
single-purpose unit; splitting the migration from its security registration or
splitting its direct SQL evidence would reduce auditability and make the
approval contract harder to review. No application, UI, worker, or
single-approval path changed.

## 3. Phase P2 - Synchronous Single-Approval Cutover

**PR boundary:** Refactor only normal one-sample approval to the atomic RPC.
Do not add batch tables, APIs, worker code, or multi-select UI.

- [x] 3.1 Replace the multi-round-trip write sequence in `approveResults` with
  one server-only atomic RPC call after the existing server-side OTP guard while
  preserving the current `ApproveResults` client contract.
- [x] 3.2 Keep one-sample `Duyệt` synchronous and prove it creates no batch or
  worker item.
- [x] 3.3 Preserve current query invalidation and approval queue refresh after a
  committed result.
- [x] 3.4 Preserve current single-path CoA behavior by invoking the existing
  queue contract and non-blocking TypeScript generation trigger only after a
  completed-sample outcome.
- [x] 3.5 Run all Phase P0 characterization tests plus atomic rollback and CoA
  handoff tests.
- [x] 3.6 Measure database calls and one-sample latency before and after
  cutover; fail the phase if it introduces queue/polling latency or regresses
  synchronous p95 latency by more than 10 percent from the Phase P0 baseline.
- [x] 3.7 Run changed-file lint, typecheck, and the relevant shared approval
  tests.

**Exit gate:** Single approval uses the atomic core with behavior parity and no
batch-path dependency. Review-size target: about 900 changed lines.

**Phase P2 evidence:** The TDD red run failed 18 adapter assertions against the
legacy table-write sequence; the first green run passed 23/23 focused adapter
tests. Final focused verification passed 20 approval/action/OTP/UI/hook files
(122/122 tests) plus the cache-query refresh regression. The home-server SQL
suites passed atomic rollback/concurrency and completed-sample CoA revalidation.
The transactionally rolled-back, alternating-order 40-iteration database
benchmark reduced the synchronous one-sample core from 8 calls to 1: legacy
p50/p95 4.165/4.822 ms versus atomic 1.554/2.134 ms, a -55.74% p95 change.
Route coverage proves an OTP-denied manager request cannot dispatch the
privileged approval handler; adapter coverage proves no queue/polling boundary
and preserves cache revalidation plus claimed/unclaimed CoA handoff behavior.
Live catalog checks found the atomic RPC and no batch tables, items, or attempts.

**Phase P2 scope reassessment:** The final diff is 2,256 changed lines (1,038
additions and 1,218 deletions). It exceeds the 1,500-line warning because the
obsolete multi-round-trip test harness is removed, unchanged cancellation
coverage is isolated, and a rollback-safe benchmark is added alongside the
atomic adapter. Splitting those tests from the caller cutover would leave either
PR without reviewable behavior-parity evidence. No migration, batch schema,
API, UI, polling, or worker surface is included; migration 192 remains
unchanged.

## 4. Phase P3 - Dark Batch Persistence Schema

**PR boundary:** Batch relations, RLS, indexes, and database creation/read
contracts only. No worker process or manager UI.

- [x] 4.1 Add failing SQL tests for `approval_batches`,
  `approval_batch_items`, and append-only `approval_batch_item_attempts`,
  including status constraints, immutable request data, canonical request
  fingerprints, idempotency-key mismatch conflicts, unique sample items, parent
  retry batches, and no hard-delete path.
- [x] 4.2 Add failing SQL tests for exact selection snapshots, all-or-nothing
  item creation, progress aggregation, and the `(batch_id, status)` index using
  representative 200-item data.
- [x] 4.3 Create the next-numbered forward-only migration for batch tables,
  indexes, comments, audit triggers, and RLS with explicit manager ownership and
  role checks.
- [x] 4.4 Add server-only mutation contracts for batch creation and child retry,
  plus owner-scoped progress and paginated outcome reads, without granting
  direct client DML or mutation RPC execution to `anon` or `authenticated`.
- [x] 4.5 Persist only server-derived step-up metadata and immutable approval
  intent; prove OTP values, cookies, access/refresh tokens, and JWTs cannot be
  stored.
- [x] 4.6 Commit before apply, use the approved home-server migration path, and
  run focused SQL plus `run_security_tests()` immediately after application.

**Exit gate:** Durable batch state is deployed dark and inaccessible except
through narrow server-only mutation and owner-scoped read contracts.
Review-size target: about 1,200 changed lines.

**Phase P3 evidence (2026-07-26):** Migration 193 was committed before its
single execution, then rolled back atomically when its final
representation-sensitive catalog assertion rejected PostgreSQL-normalized
definitions. It remains immutable and was neither edited nor rerun. Migration
194 was committed and applied forward-only through the home-server SSH and
Docker path; the storage-only schema suite passed at that checkpoint, the
PostgREST schema cache was reloaded, and `run_security_tests()` passed.
Migration 195 was then committed and applied through the same path, followed by
another schema-cache reload. Current-state contract, representative 200-item
runtime, and two-session create/retry concurrency suites pass. The contract
schema suite revalidates the exact migration 194 storage catalog, and live
checks return true for the storage checker, persistence security checker, and
all creation, retry, progress, and outcome contracts. The final security runner
returns true for every registered test.

Typecheck and lint exit successfully; lint reports 88 pre-existing warnings and
no errors. Strict OpenSpec validation reports
`add-background-batch-result-approval` valid. No API, UI, worker, polling, or
Phase P4 surface is included.

**Phase P3 scope assessment:** The final diff is 7,086 changed lines (7,080
additions and 6 deletions) across eight files. The size is dominated by the
immutable 1,553-line migration 193, its required 1,597-line forward-only
recovery migration 194, the 1,541-line contract migration 195, and direct SQL
evidence. Historical migrations cannot be compressed or removed after
execution; splitting contracts from their grants, security registration, or
transactional verification would reduce auditability.

## 5. Phase P4 - Batch Request and Read APIs

**PR boundary:** Server/API and `api-client` integration only, protected by a
disabled feature flag. No worker or queue UI.

- [x] 5.1 Implement an authorization-scoped select-all endpoint that returns
  the exact set and count of currently pending approval-visible sample IDs
  across every queue page.
- [x] 5.2 Implement batch submission that validates current manager OTP
  step-up, accepts two or more distinct IDs, snapshots every result currently
  in `entered` status for each sample, persists a canonical request fingerprint,
  and creates every item or none through the server-only mutation contract.
- [x] 5.3 Implement owner-scoped status and paginated outcome reads with
  concealed unauthorized/confidential behavior.
- [x] 5.4 Implement failed-item retry as a new child batch after current manager
  and OTP validation while preserving original terminal history.
- [x] 5.5 Route all client calls through `src/lib/api-client.ts`, return HTTP
  `202` plus `batchId` for accepted submit/retry requests, and validate every
  response with the Phase P0 schemas. Return the existing batch for the same
  idempotency key and fingerprint, and a conflict for a mismatched fingerprint.
- [x] 5.6 Add API tests for OTP, role and confidential authorization, two- and
  200-sample submission, queue-wide selection across pagination, exact
  `entered` result snapshots, partial approval, later-added results, selected
  results no longer `entered`, matching and mismatched duplicate request keys,
  all-or-nothing failure, owner-scoped reads, pagination, and retry eligibility.
- [x] 5.7 Enforce the feature flag inside select-all, submit, and retry
  endpoints, and test that direct API requests are rejected while disabled.
- [x] 5.8 Run focused API tests, changed-file lint, and typecheck with the
  feature flag still disabled.

**Exit gate:** Batch requests can be created and inspected through tested APIs,
but managers cannot access the feature and no item executes. Review-size
target: about 1,100 changed lines.

**Phase P4 evidence (2026-07-26):** Added dedicated select-all, submit,
owner-detail, and retry APIs plus validated `api-client` exports. Select-all
uses the authenticated manager client, walks deterministic 100-row ranges, and
removes confidential sample IDs when current access is absent. Submit and retry
require current signed OTP metadata, then call only the migration 195
service-role contracts with the database provenance cohort
`manager_email_otp`; matching replays return the existing batch and mismatched
fingerprints return a conflict. Detail reads remain available while entry
points are disabled, authorize through both owner-scoped read RPCs, and only
then use the service role to retrieve the required `updated_at` metadata.

The API request schema rejects caller-supplied result snapshots, while the
single atomic migration 195 call owns exact `entered` snapshots,
all-or-nothing creation, and exclusion of later-added results. Route tests cover
request validation, same-origin submit/retry, feature-flag rejection, and
accepted `202` responses; server tests cover authorization, exact RPC arguments,
idempotency, owner reads, outcome mapping, and cross-page selection. The P3 SQL
contract tests remain the database-level proof for snapshot and atomic
creation semantics. Migrations 192-195 and their evidence remain byte-for-byte
unchanged.

TDD evidence: baseline focused coverage passed `35/35`; the initial RED run
failed eight test files for the absent P4 modules, routes, API exports, and OTP
provenance metadata. First GREEN passed `45/45`. Contract review then exposed
the cookie-cohort/database-cohort mismatch; its RED run failed `3` assertions
until `manager_email_otp` mapping was added. A pagination-metadata regression
also failed before the response validator was tightened. Review regressions
then failed `2` tests for truncated select-all traversal and unauthorized table
metadata reads; the focused server/route GREEN run passed `23/23`. Final focused
P0, batch API, manager OTP, middleware, and client-action coverage passes
`120/120` across 19 files. Changed-file ESLint, typecheck, full lint, strict
OpenSpec validation, diff check, and migration checksum checks pass; full lint
retains the existing `88` warnings and reports no errors.

No UI, worker, polling, Compose, Docker, or migration file changed. The feature
flag remains default-disabled as
`BACKGROUND_BATCH_RESULT_APPROVAL_ENABLED=FALSE`. Stop before Phase P5.

**Phase P4 scope assessment:** The final review surface is 2,023 changed lines
across 26 files: 923 production lines, 1,041 test lines, and 59 OpenSpec evidence
lines. Production code remains below the phase's approximate 1,100-line target;
the larger total is driven by the required API/OTP regression matrix.

## 6. Phase P5 - Worker Database Claim and Execution

**PR boundary:** Worker-only database role and RPCs with SQL tests. No Node
worker process, Compose service, or UI.

- [x] 6.1 Add failing concurrency tests for `FOR UPDATE SKIP LOCKED`, bounded
  claims, claim tokens, lease expiry, stale-token rejection, and interruption
  recovery.
- [x] 6.2 Add failing tests for a service-only execution wrapper that accepts
  only item ID plus claim token and derives manager, sample, selected result
  set, and note from locked immutable rows.
- [x] 6.3 Add the dedicated worker database role and narrow claim/execute grants
  with no direct table DML; deny `anon`, `authenticated`, and unrelated roles.
- [x] 6.4 Establish immutable `requested_by` as the transaction-local
  PostgREST-compatible actor, revalidate current manager/confidential access,
  and prove audit triggers record the manager rather than worker login.
- [x] 6.5 Implement append-only attempts, terminal business-error
  classification, transient-error classification, maximum three automatic
  attempts, bounded retry scheduling, and terminal batch status derivation.
- [x] 6.6 Add crash-window tests before approval, after approval commit but
  before acknowledgement, after lease replacement, and during terminal-state
  calculation.
- [x] 6.7 Commit/apply the forward-only migration through the approved path and
  run focused SQL plus `run_security_tests()`.

**Exit gate:** PostgreSQL can safely claim and execute items, but no deployed
process calls the worker RPCs. Review-size target: about 1,200 changed lines;
keep tightly coupled security grants and tests with their migration.

**Phase P5 evidence (2026-07-27):** Added the restricted login role
`approval_batch_worker` and worker-only
`claim_approval_batch_items_worker(integer, integer)` /
`execute_approval_batch_item_worker(uuid, uuid)` contracts. Claims use bounded
`FOR UPDATE SKIP LOCKED` selection, opaque claim tokens, expiring leases, and
stale-token rejection. Execution accepts only the immutable item identity and
claim token, locks the persisted batch/item snapshot, derives manager, sample,
selected result IDs, and note from those rows, and revalidates current manager
and confidential authorization before using the shared atomic approval command.
Transaction-local PostgREST-compatible actor claims preserve manager-attributed
result and sample audits; the worker role has no direct batch-table DML or
unrelated role memberships.

Attempts remain append-only. Business failures terminate immediately, transient
failures schedule a bounded retry, automatic processing exhausts after three
attempts, and batch terminal status is derived transactionally. SQL coverage
includes bounded and concurrent claims, lease replacement, stale tokens,
interruption recovery, pre-approval failure, post-approval/pre-acknowledgement
recovery, terminal-state rollback, retry exhaustion, and recovery after a real
lock timeout. The concurrency harness also asserts that it removes probe tables,
temporary role membership, fixture rows, and audit evidence after each run.

TDD evidence: the initial worker contract and concurrency suites failed because
the P5 role and RPCs were absent. Migration 196 provided the first GREEN worker
contracts. A claim conflict then reproduced against the live database;
migration 197 executed once but failed its self-verification and rolled back
atomically. It remains immutable. Migration 198 recovered the ambiguous
`ON CONFLICT` paths, and migration 199 removed shared batch-row status blocking
from otherwise independent claims. A final cleanup regression failed on 17
residual fixture audit rows before the test cleanup moved its last audit delete
after all audited fixture deletes; the GREEN concurrency run passes `2/2` and
the post-test residue audit is entirely true.

Migration history is forward-only and byte-for-byte immutable:

- 192: `b89f2d210560f2c5f6b913b7f3516aa282d26e78f5019953d84d837b69d5e801`
- 193: `15b72d9fa64cd27d6a40bfbbccfc08db462820dfef70dec0cb988ef2161da634`
- 194: `4e0cf98887e68cb4dea05f3cc65c72f9322f344990791a867cf3630d11c77aa2`
- 195: `f0d4860406579773ec9854ba2c2d2c735d65a1a5ca620541d6810ae189e1dedf`
- 196: `f5184364d13cc698928a7607b0aa211f45a3b9e2ef4ce8d13eba35f686be2b47`
- 197: `3bae836e38497b273475e00f90e32fb0b653662cb49d4568b2ee6c002a7d6f57`
- 198: `7aa7998b9ad815e641838646812818c071013b186f38a2c1bf3de1bfb1a8b70b`
- 199: `73248e7c5891e8ea9c59c08474ccf4835a2a6fc0c3b85dbd8ff59e3106126f4f`

Fresh verification passes the worker contract matrix `16/16`, worker
concurrency `2/2`, atomic approval and atomic concurrency suites, P3 contract,
runtime, and concurrency suites, and CoA completion revalidation. The historical
`approval-batch-storage-schema` migration-194 checkpoint is intentionally
excluded because it asserts that later contracts are absent. Security tests pass
`33/33`; focused application regressions pass `151/151` across 22 files;
typecheck passes; full lint reports `0` errors with the existing `88` warnings;
and strict OpenSpec validation passes.

No Node worker, Compose service, UI, polling, feature enablement, or application
deployment was added. Stop before Phase P6.

**Phase P5 scope assessment:** The final review surface is 3,013 additions and
7 deletions across seven files: 1,664 immutable forward-only migration lines,
1,277 SQL-test lines, and 72 OpenSpec evidence/checklist lines. It exceeds the
approximate target because migrations 196-199 were applied or attempted and
cannot be edited or squashed, while their security and concurrency tests remain
tightly coupled. No Phase P6 implementation is included.
The SQL test files intentionally exceed the general size target because their
shared transaction-scoped fixtures and crash-window sequence must stay atomic.

## 7. Phase P6 - Dark TypeScript Worker Runtime

**PR boundary:** Worker runtime, tests, and disabled Compose service only. No
manager-facing UI and no feature enablement.

- [ ] 7.1 Add a focused worker module, direct PostgreSQL adapter, separate
  build/run script, and strict configuration without importing web request or
  session code.
- [ ] 7.2 Implement a bounded connection pool and claim loop with default
  concurrency `8`, hard maximum `16`, claim size no greater than available
  capacity, cancellable backoff, and operation deadlines.
- [ ] 7.3 Ensure the process stores no manager JWT or OTP material and invokes
  only narrow claim/execute/progress RPCs.
- [ ] 7.4 Implement graceful shutdown that stops new claims and drains in-flight
  work within a configured timeout.
- [ ] 7.5 Add liveness/readiness, queue-age and stale-lease metrics, plus
  privacy-safe structured logs containing only opaque IDs, attempts, durations,
  and outcome codes.
- [ ] 7.6 Add tests for idle polling, mixed outcomes, retry exhaustion,
  database outage/recovery, two worker loops, restart recovery, and graceful
  shutdown.
- [ ] 7.7 Add a disabled-by-default Compose worker service using a protected
  dedicated database credential, bounded resources, health check, restart
  policy, and no published host port.
- [ ] 7.8 Run worker tests, changed-file lint, typecheck, secret scans, and a
  dark deployment health/restart drill.

**Exit gate:** The worker is production-shaped and deployable dark, while batch
submission remains unavailable to managers. Review-size target: about 1,200
changed lines.

## 8. Phase P7 - Durable Approval-to-CoA Outbox

**PR boundary:** Database outbox and worker-only CoA transition contracts with
SQL tests. Do not add the TypeScript CoA dispatcher or approval UI.

- [ ] 8.1 Add failing SQL tests proving sample completion and one idempotent
  `approval_coa_outbox` event commit or roll back in the same approval
  transaction.
- [ ] 8.2 Prove outbox insertion performs no source-submission, snapshot,
  signature, rendering, storage, or `coa_reports` eligibility check; missing or
  mismatched CoA provenance must not roll back approval.
- [ ] 8.3 Create the next-numbered forward-only migration for the no-hard-delete
  outbox, append-only outbox attempts, idempotency key, dispatch states, claim
  token/lease, indexes, comments, audit coverage, and the atomic approval
  integration.
- [ ] 8.4 Add worker-only outbox claim plus CoA prepare, complete, and fail
  wrappers. Accept only outbox identity, active claim token, and required
  rendering outputs; derive actor, sample, source submission, report, and
  generation claim from locked database state.
- [ ] 8.5 Extract shared internal CoA transition logic without changing the
  existing authenticated manual RPC contracts. Explicitly revoke worker
  wrappers from `PUBLIC`, `anon`, `authenticated`, `service_role`, and unrelated
  roles, then grant only the dedicated worker role.
- [ ] 8.6 Add SQL tests for stale outbox claims, arbitrary actor/report/source
  injection, generation-claim ownership, existing ready/claimed reports,
  manager attribution, provenance failures, retry classification, and approval
  independence.
- [ ] 8.7 Commit/apply the forward-only migration through the approved path and
  run focused SQL plus `run_security_tests()`.

**Exit gate:** PostgreSQL durably records CoA handoff intent and exposes
implementable worker-only transitions without making CoA eligibility part of
approval. No runtime consumes the outbox yet. Review-size target: about 1,200
changed lines; keep tightly coupled grants and security tests with the
migration.

## 9. Phase P8 - CoA Dispatcher Runtime

**PR boundary:** TypeScript CoA outbox consumption and integration tests only.
Do not add approval UI.

- [ ] 9.1 Add a separate low-concurrency CoA dispatch loop to the worker
  runtime so approval concurrency cannot saturate React rendering, storage, or
  signature dependencies.
- [ ] 9.2 Add a worker-client adapter that uses only the P7 outbox and CoA
  wrappers, never stores or replays a manager JWT, and reuses the existing React
  renderer, signature validation, immutable source binding, upload, hashing,
  reconciliation, and failure recording.
- [ ] 9.3 Preserve the synchronous path's current best-effort non-blocking CoA
  trigger during rollout and prove dispatcher reconciliation is idempotent when
  a report is already claimed, ready, failed, or restored.
- [ ] 9.4 Keep batch/item success independent from outbox and
  `coa_reports.status`; retain existing CoA retry behavior after a report exists
  and durable outbox retry for pre-report dispatch failures.
- [ ] 9.5 Add crash-window, lease-expiry, restart, transient-failure,
  provenance-failure, complete/fail, and graceful-drain integration tests.
- [ ] 9.6 Verify logs contain no manager JWT, OTP, signature content, approval
  note, sample code, patient/client identity, or result values.
- [ ] 9.7 Run focused CoA and worker integration tests, lint, and typecheck.

**Exit gate:** The dark worker can consume durable CoA handoffs through narrow
database contracts without changing approval success semantics. Review-size
target: about 900 changed lines.

## 10. Phase P9 - Multi-Select and Confirmation UI

**PR boundary:** Selection and confirmation UI behind the disabled batch feature
flag. No progress dashboard or retry UI.

- [ ] 10.1 Add row checkboxes, stable selected-count state, and a tri-state
  loaded-page checkbox while preserving selection across queue pagination.
- [ ] 10.2 Add `Chọn tất cả` to load and select the exact backend-returned
  snapshot from the manager's full pending authorization scope, not only loaded
  rows.
- [ ] 10.3 Support individual deselection after `Chọn tất cả` and ensure samples
  entering the queue later are not silently selected.
- [ ] 10.4 Keep normal one-sample `Duyệt` on the synchronous path and enable
  `Duyệt hàng loạt` only for two or more selected samples.
- [ ] 10.5 Add a mandatory Vietnamese confirmation dialog showing selected
  count, background-processing notice, common note when present, `Hủy`, and
  `Xác nhận duyệt`.
- [ ] 10.6 Ensure cancel/close creates no batch and preserves selection; final
  confirmation performs OTP validation and submits exactly one batch.
- [ ] 10.7 Add desktop/mobile tests for individual selection, tri-state state,
  cross-page persistence, select all, deselection, exact snapshot behavior,
  confirmation, cancellation, and synchronous single approval.
- [ ] 10.8 Run focused component tests, React Doctor, changed-file lint, and
  typecheck with the feature flag disabled.

**Exit gate:** Managers can exercise the complete selection/confirmation UX in
tests, but production users cannot submit batches yet. Review-size target:
about 1,200 changed lines.

## 11. Phase P10 - Progress, Outcomes, and Failed-Item Retry UI

**PR boundary:** Polling and result presentation behind the same disabled
feature flag. Do not change worker or approval business logic.

- [ ] 11.1 Add the Vietnamese progress surface with total, waiting, processing,
  retrying, succeeded, and failed counts plus paginated sanitized outcomes.
- [ ] 11.2 Poll nonterminal batches every one second, stop on terminal status,
  resume on focus/reload, and restore the manager's latest active/recent batch
  from server state.
- [ ] 11.3 Refresh confirmed successful samples out of approval queue caches
  without blanking the list or marking unconfirmed items approved.
- [ ] 11.4 Add `Thử lại mẫu lỗi` to create and follow a child batch containing
  failed samples only.
- [ ] 11.5 Add desktop/mobile tests for accepted state, polling cadence,
  successful and mixed completion, paginated outcomes, retry, reload recovery,
  inaccessible batches, and Vietnamese copy.
- [ ] 11.6 Run focused API/component tests, React Doctor, changed-file lint, and
  typecheck with the feature flag disabled.

**Exit gate:** The end-to-end UI is complete behind the flag and no production
manager behavior changes. Review-size target: about 1,000 changed lines.

## 12. Phase P11 - Performance and Controlled Rollout

**PR boundary:** Benchmark-driven configuration, rollout documentation, and only
small, reviewable corrections. Any larger defect returns to a new focused PR.

- [ ] 12.1 Benchmark batches of 1, 20, 100, and 200 samples at concurrency 1, 4,
  8, and 16 on production-like home-server hardware; record throughput,
  p50/p95 item latency, lock waits, connection usage, queue age, error rate, and
  synchronous one-sample latency.
- [ ] 12.2 Select production concurrency from evidence, keep it at or below 16,
  and require a 200-sample batch to reach terminal approval state within 120
  seconds, excluding independent CoA rendering.
- [ ] 12.3 Require status polling p95 below 250 milliseconds, lock-wait p95
  below 250 milliseconds, no connection-acquire waits above one second, and no
  deadlocks during the 200-sample benchmark.
- [ ] 12.4 Require synchronous single-approval p95 regression at or below 10
  percent and approval-queue interactive-read p95 regression at or below 20
  percent from the Phase P0 baseline while a 200-sample batch is active.
- [ ] 12.5 Verify liveness, readiness, graceful restart, stale-lease recovery,
  protected secrets, no published worker port, and privacy-safe logs while the
  worker remains dark.
- [ ] 12.6 Enable the feature for controlled managers and execute successful,
  mixed-failure, authorization-revocation, select-all, confirmation,
  reload/retry, crash-recovery, and CoA-failure drills.
- [ ] 12.7 Record rollback evidence proving the UI flag can be disabled and the
  worker stopped while synchronous single approval remains operational.
- [ ] 12.8 Run all focused SQL/app/worker/CoA suites,
  `run_security_tests()`, lint, typecheck, React Doctor, and
  `openspec validate add-background-batch-result-approval --strict`.
- [ ] 12.9 File follow-up issues for cancellation, push progress, larger-scale
  tuning, or any other intentionally deferred scope.

**Exit gate:** Batch approval is enabled, observed, reversible, and verified for
the 200-sample target. Review-size target: about 500 changed lines.
