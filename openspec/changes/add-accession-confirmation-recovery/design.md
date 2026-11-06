## Context

TASK-12 / #140 follows TASK-9/10/11 under the [implementation partition](../../../docs/superpowers/specs/2026-11-02-import-implementation-partition.md). The approved [template contract](../../../docs/superpowers/specs/2026-11-01-excel-template-contract-design.md) and [atomic contract](../../../docs/superpowers/specs/2026-11-01-atomic-import-provenance-contract-design.md), especially §§3–6 and 8, are decision authority.

Baseline source is main `89ee7a06a8d206f085eaa67b6af37cfdd4a6b45e`. `confirmAccession` in `src/lib/accession-preview/confirm.ts` is server-only and has no HTTP caller. It authenticates through preparation, returns authorized successful receipts first, verifies transient original bytes/attestation through existing parser/planner/hash/bindings, and calls private `confirm_accession_import` once. Transport/RPC/invalid-result uncertainty throws `ACCESSION_CONFIRMATION_OUTCOME_UNKNOWN`.

The preview route already bounds in-memory multipart admission, checks origin/session/active analyst and uses measured resource policy. Preparation already maintains fenced leases/heartbeats. Migrations 233–239 contain no standalone lock-aware status RPC. Existing worker precedent is `src/workers/approval-batches` with explicit runtime entry/configuration; its business scheduler is not an import scheduler. GitNexus is stale at `0d62612`; targeted source reads establish these boundaries without reindexing.

TASK-11 evidence records SQL 235→238→239 installed and application deployment `7e1888a`; this checkpoint does not reverify runtime. TASK-11 remains OPEN 26/28: 4.4/4.5 are INCOMPLETE until real request-bound adapter smoke and final review. A new route/source test does not close those gates.

## Goals / Non-Goals

**Goals:** authenticated owner-only confirmation; immutable source/intent verification; committed, lock-aware status without a workbook; safe outcome uncertainty; linked retry; fenced abandoned-preparation recovery and lock-safe transient purge; separately recorded source/runtime evidence.

**Non-Goals:** TASK-13 UI/client workflow; manager history; new OTP/electronic signature semantics; alternate parser/resolver/atomic writer; business row/count caps; invented timeout/poll/retry/purge budgets; automatic write replay; production operations or full TASK-7 capacity acceptance.

## Decisions

### 1. A narrow HTTP bridge reuses the real adapter

Use one Node route at `src/app/api/accession-confirmation/[batchId]/route.ts`: POST confirms and GET looks up status. Validate UUID and active analyst session before processing content or exposing state. Derive actor from session, never body. Apply the preview route's origin policy to writes and preserve existing session/security checks without adding OTP requirements. Reuse its bounded streaming multipart admission and auth through the smallest shared extraction justified by both callers; keep response/feature orchestration local. Do not introduce a general transport service.

POST obtains protected lock-aware status before reading the body. Busy processing or uncertain lookup returns that safe outcome without invoking the adapter; committed terminal states return their authorized safe outcome. Only an unlocked valid preview_ready proceeds. This preflight does not reserve the batch: the existing atomic RPC resolves races and revalidates state under its own lock. Preserve HTTP authorization before `request.body.getReader()`; the adapter's later requireRole is not a substitute.

POST accepts only `file` and `acceptableQuality`; reject duplicate/unknown fields, malformed multipart, non-file values and nonliteral attestation values. A new confirmation needs `acceptableQuality='true'` and original XLSX bytes strictly below 10,000,000 decimal bytes. Envelope/resource admission remains governed by the existing measured policy, independently of the original-file ceiling. Test the exact 9,999,999 / 10,000,000 / 10,000,001 byte boundary. No actor, normalized payload, resolved ID, client hash, deadline or received time is accepted as authority.

Authorized succeeded repeats return the existing receipt before requiring file/attestation/configuration, as the existing adapter guarantees. GET is the canonical file-free lookup; POST can short-circuit an authorized success without consuming a source body. New confirmations use `confirmAccession` exactly once; its trusted preparation and SQL recheck remain the only authority for source SHA-256/size, canonicalization version/normalized hash, sealed snapshot/bindings, current role/owner/catalog/client authority and explicit quality attestation. Current request data cannot replace immutable preview content.

Alternative rejected: direct browser RPC or a second confirmation implementation would bypass the privileged source-verification boundary or duplicate business logic.

### 2. Phase 1 requires a private lock-aware status RPC

Root has accepted the necessity of new forward-only status SQL source. Recheck the next unused migration number immediately before authoring; 240 is the current candidate, not a reservation. Historical 233–239 remain byte-for-byte immutable. Do not apply any migration in this workspace.

Proposed `get_accession_import_status(p_actor UUID,p_batch UUID)` is service-role-only SECURITY DEFINER with fixed search_path, schema-qualified references and explicit active analyst/owner/confidentiality checks. Authorize before returning even `processing`; hide nonexistent and inaccessible batches behind one safe response. Reuse existing authorization/receipt visibility guards. Revoke PUBLIC/anon/authenticated execution; browser callers cannot submit an actor directly. Include expected-baseline assertions, resulting grants/definition assertions, a focused security test and `run_security_tests()` integration consistent with current registration.

Under an exception sub-block take the owner batch row `FOR UPDATE NOWAIT`. Catch only lock-not-available to return `processing` without receipt, entity IDs or TTL conclusion. Distinguish a genuinely missing row from lock contention; do not use a stale FOUND value after exception rollback. Keep authorization outside the failed lock sub-block and recheck protected state under the acquired lock. Use VOLATILE/read-committed query semantics and read batch/receipt in the same RPC transaction; lock acquisition followed by committed state/receipt lookup must not reuse a stale pre-lock state.

When unlocked, validate committed success receipt owner/batch/count invariants and confidentiality before returning the existing receipt. Return safe `preparing`, `preview_ready`, `rejected`, `failed` or `expired` views without official IDs. For unlocked preview_ready at `clock_timestamp() >= expires_at`, report logical expiry using DB time; do not update state, purge data or manufacture a lifecycle audit for a read. A transaction accepted before deadline may hold the lock beyond TTL and still commit: status must return processing while busy. DB/RPC/response uncertainty returns unknown/unavailable, never a fabricated failure or expiry.

Alternative rejected: an unlocked table SELECT plus application clock can report preview_ready/expired while an accepted transaction is committing, violating contract §5.

### 3. Status and retry preserve uncertainty

All responses use `Cache-Control: private, no-store` and allowlisted machine outcomes with Vietnamese messages. Successful receipts retain the existing strict schema. Denials/errors omit raw exceptions, PII, temporary refs, source bytes, complete normalized payload and another actor's winning batch/mappings. Invalid upstream responses fail closed.

Expose `processing` for a held lock and `unknown` for uncertain transport/DB results. HTTP timeout, abort or lost response cannot terminalize the batch, retract a committed success or trigger a second adapter call. Do not propagate browser/deadline cancellation into the dispatched atomic RPC or claim the transaction rolled back. Admission cancellation before dispatch creates no business action. Tests explicitly separate these points.

Phase 1 provides the lock-safe GET foundation. Phase 2 completes caller-facing retry semantics: same uncertain confirmation must use status first; success needs no file; only an unlocked preview_ready can be confirmed again with identical bytes while valid. Terminal failure/rejection/expiry uses the existing new-preview `retryOfBatchId` link and same-actor checks. Terminal batches never reset; no file means select the exact original file or start an allowed new linked attempt, never reconstruct payload from metadata. No route performs automatic replay or creates a new attempt to guess an unknown result. TASK-13 later consumes this contract.

Phase 2 implements status-first browser clients through `api-client.ts` and shares the strict receipt/status allowlist in `http-contract.ts`. Linked-attempt admission also requires forward-only migration241: migration234's blocking `FOR SHARE` admitted succeeded parents and excluded ready-preview replacement. The replacement start function calls migration240's status RPC in the same transaction, retains its parent lock through child insertion and admits only unlocked preview_ready/failed/rejected/expired. It never changes the parent. This implements the approved lost-file replacement option and closes the status-to-insert race; migrations233–240 stay immutable.

### 4. Recovery and physical purge remain Phase 3

Reuse durable `lease_token`, `lease_generation`, `lease_expires_at` and existing heartbeat/finalization RPC conventions. A minimal import-specific runner follows the repository's worker entry, configuration and shutdown conventions; do not graft import work onto approval business writes or build a scheduling framework. Choose its exact invocation/deployment shape at Phase 3 after reading that worker, and leave budgets dependent on measured TASK-7 evidence.

Recovery acquires the batch lock without stealing active work, verifies generation/lease expiry and committed outcome, then terminalizes only an abandoned preparing request with safe audit. Stale heartbeats cannot resurrect it. Crash/disconnect during confirm requires lock/receipt reconciliation; recovery never replays `confirm_accession_import` or guesses failure from elapsed HTTP time.

Physical purge separately acquires eligible batch locks and removes only contract-approved transient commitment/binding material after hard logical expiry, recording safe lifecycle cleanup. It skips locked accepted transactions and preserves terminal metadata, receipt, dedup claim, mapping, business entities and audit. Fresh authenticated DB state is authority; failed workers/DB outage retry maintenance safely without replaying business writes. Preserve retained old fingerprint keys until no live commitments need them; runtime key rotation is outside this checkpoint.

### 5. Safe source checkpoints and evidence lanes

Checkpoint 0 authors proposal/design/spec/tasks/evidence only, then root reviews. Phase 1 implements the confirm bridge, status foundation and necessary forward-only status SQL source with RED→GREEN checks; stop for root review. Phase 2 and Phase 3 are separately released source checkpoints. Runtime is a separately authorized session and cannot be silently bundled with source work.

An isolated authenticated smoke requires an explicitly approved nonproduction batch/actor lifecycle, request-bound analyst cookies/session, installed exact SQL/grants, reachable compiled adapter, key/policy configuration and controlled success/failure/expiry/unknown scenarios. Success writes business records; timeout may leave a committed receipt. Approve fixture creation/lifecycle before running it, inspect counts/audit/receipt afterward and never use production synthetic data by implication. Record the running image/source revision. SQL service-role smoke and mocked route success are insufficient for TASK-11 4.4/4.5.

## Risks / Trade-offs

- Status needs SQL before a fully correct deployed route exists → ship/review SQL source separately and gate runtime on explicit migration/security authorization.
- Middleware/proxy/runtime may buffer content to disk → verify the real path in the runtime phase; report a concrete blocker if no-retention cannot hold.
- A request can disconnect after commit → preserve unknown and reconcile via locked status; never infer rollback from HTTP behavior.
- Shared preview auth/reader extraction can regress existing preview → retain current preview tests and focused auth/admission regressions.
- Source fixtures cannot prove concurrent locking, worker restart or DB outage → retain explicit NOT RUN runtime gates and TASK-7 acceptance.

## Migration Plan

Author only next-numbered forward migrations with baseline/security/result checks; add rollback-only SQL fixtures and concurrency instructions. Runtime release installs committed SQL via authorized home-server SSH/Docker and runs focused SQL plus `run_security_tests()` after each migration before exposing routes/runner. Rollback disables the new caller/runner using existing operations conventions; database corrections are forward-only. Never edit/reapply historical SQL or delete durable success provenance.

## Open Questions

No product decision blocks Phase 1 source. Root must accept checkpoint 0 before code, review the exact status SQL lock/authorization contract and release only Phase 1. Runtime fixture lifecycle, exact runner deployment and measured budgets remain later explicit gates; their absence does not justify a fabricated default or current runtime claim.
