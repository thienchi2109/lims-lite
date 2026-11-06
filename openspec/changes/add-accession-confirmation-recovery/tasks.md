# Accession Confirmation and Recovery Implementation Plan

**Goal:** expose the existing atomic adapter safely and make committed outcomes recoverable without retained source. **Architecture:** one authenticated Node GET/POST route, existing confirmation core, private lock-aware status RPC, later minimal fenced maintenance runner. **Stack:** existing Next.js/TypeScript/Zod/PostgreSQL/Vitest only.

Each phase is one bounded source review checkpoint. Runtime operations are separate. Phase 1 does not release Phase 2/3. See [design](design.md), [spec](specs/accession-confirmation-recovery/spec.md) and [evidence plan](evidence.md).

## 0. Artifact checkpoint — stop before application or SQL implementation

- [x] 0.1 Read TASK-12/#140, approved #112/#113 contracts, partition and TASK-11 current handoff; document known source/runtime boundary.
- [x] 0.2 Author proposal/design/spec/tasks/evidence; identify new lock-aware status SQL necessity and retain separate phase/runtime gates.
- [x] 0.3 Root independently reviews artifacts and strict validation, accepts checkpoint 0 and releases Phase 1 only.

## 1. Phase 1 — owner-only confirm bridge and lock-aware status foundation, source only

- [x] 1.1 Add meaningful failing HTTP tests for missing route, analyst owner/session guards, strict multipart/true attestation, boundary sizes and unknown-after-dispatch; run RED before implementation.
- [x] 1.2 Add failing status adapter/migration source checks plus retained rollback SQL fixture for unauthorized/nonowner/manager/withdrawn role, confidentiality, missing-versus-busy, committed receipt invariants and read-only lifecycle; record RED.
- [x] 1.3 Recheck next unused migration number; author new forward-only service-only status RPC with baseline assertions, explicit caller/actor guards, fixed search_path, NOWAIT exception isolation, DB-clock expiry and committed receipt validation. Add resulting-state assertions, security test and run_security_tests registration; do not apply SQL.
- [x] 1.4 Implement a narrow validated server-only status caller and GET /api/accession-confirmation/[batchId] with file-free owner-only response, safe processing/unknown and private no-store headers. Do not mutate state or audit on reads.
- [x] 1.5 Extract only preview admission/auth capability needed by both routes; preserve measured policy and bounded in-memory reading, exact original-byte ceiling and existing session behavior. Keep focused preview regressions GREEN.
- [x] 1.6 Implement POST status preflight before body reads: processing/unknown/terminal returns safely without dispatch; only unlocked valid preview_ready proceeds with strict multipart through existing confirmAccession core at most once. Preserve body-free succeeded receipt and original SHA-256/normalized commitment/version/attestation validation; atomic RPC resolves preflight races.
- [x] 1.7 Verify predispatch cancellation performs no atomic call; once dispatched, timeout/disconnect/invalid RPC response stays unknown and does not abort or mislabel an accepted transaction. Check safe Vietnamese responses and no file/payload logging/storage in touched source.
- [x] 1.8 Run focused confirm/status/preview/auth/SQL-source regressions, touched ESLint, typecheck, OpenSpec strict and diff checks. Record exact RED/GREEN commands/counts and retained SQL/concurrency instructions; keep actual SQL/security/runtime NOT RUN.
- [x] 1.9 Root independently reviews spec/standards/diff and verification; accept Phase 1 SOURCE ONLY, then stop. TASK-11 4.4/4.5 remain INCOMPLETE pending separately authorized authenticated smoke.

## 2. Phase 2 — durable lookup and retry semantics, separately released source

- [x] 2.1 Root releases Phase 2; add/run RED for lost response before/after commit, DB/RPC uncertainty, file loss, terminal failed/rejected/expired linking and same-owner constraints.
- [x] 2.2 Complete allowlisted durable status/receipt and unknown-before-retry integration contract through existing preview retryOfBatchId; no workbook on lookup, no terminal reset, no blind replay or server reconstruction of payload.
- [x] 2.3 Retain production-shaped rollback/concurrency scenarios proving processing while locked, committed success after response loss and no official IDs before commit; do not run them without runtime authorization.
- [x] 2.4 Run focused regression, touched lint/typecheck/OpenSpec checks and root review; record source versus NOT RUN runtime and stop before Phase 3.

## 3. Phase 3 — fenced recovery and lock-safe physical purge, separately released source

- [x] 3.1 Root releases Phase 3; inspect existing approval-worker entry/config/shutdown patterns and select the smallest import-specific runner shape without a new framework or invented timing budgets.
- [x] 3.2 Add/run RED for abandoned lease, stale heartbeat/generation, live work, worker restart/DB outage, concurrent status/confirm/purge and expiry while waiting for locks.
- [x] 3.3 Author only next-numbered forward recovery/purge migration(s), security registration and retained SQL fixtures using existing lease/finalization authority; never replay confirmation writes or alter historical SQL.
- [x] 3.4 Implement minimal maintenance entrypoint with lock/state reconciliation, safe audit and physical purge restricted to transient commitments/bindings; preserve receipt/dedup/mapping/business/audit and accepted transactions beyond TTL.
- [x] 3.5 Run focused worker/API/SQL-source regressions, lint/typecheck/OpenSpec checks and independent root review; document runtime wiring and stop with actual runtime gates NOT RUN.

## 4. Separately authorized home-server runtime and exit

- [ ] 4.1 Obtain operation-specific runtime authorization and define isolated nonproduction actor/batch/fixture lifecycle, exact source/image/SQL baseline and failure injection; no production synthetic data by implication.
- [ ] 4.2 Apply committed forward migrations only through home-server SSH/Docker; run retained rollback/lock/security fixtures and run_security_tests after every migration, recording actual results separately from registered test source.
- [ ] 4.3 Roll out API and later recovery runner with exact image/config provenance; verify proxy upload boundary and no buffering/retention on disk/temp/cache/log paths. Record blockers without relaxing contracts.
- [ ] 4.4 Execute isolated authenticated real-adapter success/failure/expiry/unknown status smoke; independently verify committed receipt/business/audit behavior before considering TASK-11 4.4/4.5 closure.
- [ ] 4.5 Verify real crash/disconnect/concurrency/restart/outage/purge behavior within authorized scope; keep full capacity/budget acceptance with TASK-7 and UI/browser acceptance with TASK-13.
- [ ] 4.6 Root reviews exact evidence, updates TASK-12/#140 and dependent handoff, and completes scope only when all applicable gates have evidence; commit/push handled by root.
