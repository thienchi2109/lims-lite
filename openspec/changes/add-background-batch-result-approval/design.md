## Context

`approveResults` currently performs manager lookup, result reads,
confidentiality checks, sample-state validation, QC RPC calls, result updates,
sample completion updates, and CoA handoff through several application/database
round trips. Those writes are not one PostgreSQL transaction, so a failure
between steps can leave partial state. The same foreground action is acceptable
for one sample but is not a reliable execution model for a manager approving
up to 200 samples.

The manager approval surface also has existing constraints that cannot be
weakened:

- A valid authenticated manager session and manager email-OTP step-up are
  required.
- Confidential samples require current confidential-access authorization.
- Samples must still be under review, selected results must still be entered,
  and all selected results must belong to the same sample.
- QC status is fail-closed, including malformed or incomplete QC responses.
- Approval updates and immutable submission evidence remain auditable.
- CoA generation keeps its existing immutable source-submission, claim,
  signature-integrity, rendering, and retry behavior.

This change introduces a durable queue inside the existing repository and
PostgreSQL database. It does not introduce a Go microservice.

## Goals / Non-Goals

**Goals:**

- Process a 200-sample approval request without keeping one browser request
  open for the full workload.
- Keep normal one-sample approval synchronous and at least as fast as the
  current path.
- Put every sample approval behind one shared atomic PostgreSQL command.
- Commit or roll back each sample independently so one invalid sample does not
  block unrelated samples.
- Preserve manager intent, OTP enforcement, current authorization checks,
  immutable review provenance, RLS, and manager-attributed audit evidence.
- Provide reload-safe aggregate progress and per-sample outcomes through
  one-second polling.
- Recover safely from worker restart, transient database errors, duplicate
  requests, and duplicate claims.
- Keep CoA work outside approval latency and outside approval-batch completion
  semantics.

**Non-Goals:**

- Porting approval, signature processing, React CoA rendering, or CoA storage to
  Go.
- Changing approval eligibility, QC rules, result status semantics,
  confidential-access rules, OTP policy, or electronic-signature policy.
- Executing the whole batch in one database transaction.
- Waiting for CoA rendering before reporting a sample approval as successful.
- WebSocket or Server-Sent Events progress delivery; version 1 polls.
- Batch cancellation, reprioritization, scheduled approval, or unbounded retry.
- Refactoring the manager approval queue read path owned by
  `optimize-approval-queue-two-phase`.

## Decisions

### Decision 1: Use a dual-path API with one shared atomic approval command

Single-sample approval remains a synchronous manager mutation. It calls the
shared PostgreSQL approval command directly and returns only after that sample
has committed or rolled back. It does not create a batch, wait for a worker, or
poll.

Batch approval accepts two or more distinct samples, persists a durable batch,
and returns HTTP `202` with a `batchId`. The worker later invokes the same
per-sample command for every item. The initial performance acceptance target is
200 samples, but the selection contract is not limited to one visible page.

This keeps the common one-sample interaction responsive while eliminating
duplicated business logic. It also improves the single path by replacing
several network round trips and non-atomic writes with one database call.

Alternatives considered:

- Route every approval through the queue: simpler orchestration, but adds
  scheduling and polling latency to the normal one-sample action.
- Keep the current action for one sample and implement separate batch SQL:
  lower initial refactor cost, but creates two approval rule sets that will
  drift.

### Decision 2: Make the database command the approval transaction boundary

The command locks the sample and selected results in deterministic order. Inside
one transaction it:

1. Resolves the effective manager actor.
2. Revalidates active manager role and confidential access.
3. Verifies every selected result exists, belongs to the one requested sample,
   and appears only once.
4. Requires the sample to remain in `review` and selected results to remain
   `entered`.
5. Runs the existing QC approval check and rejects missing, malformed, or
   blocked outcomes.
6. Updates result approval fields and the optional note.
7. Recomputes whether the sample remains `review` or becomes `completed`.
8. Updates only the existing sample status and rejection-reset fields.
9. If the sample becomes `completed`, transactionally creates or reuses an
   idempotent approval-to-CoA outbox event. This write records handoff intent
   only and does not evaluate CoA source-submission or rendering eligibility.
10. Produces the existing immutable audit evidence under the manager actor and
    returns a typed outcome including the outbox event identifier.

Any failure before commit rolls back all approval writes for that sample.
Business failures use stable error codes so the UI can show Vietnamese messages
without exposing result values or confidential metadata.

### Decision 3: Snapshot manager intent when the batch is accepted

The approval UI keeps an explicit set of sample IDs selected by row checkboxes.
`Chọn tất cả` requests all currently pending, approval-visible sample IDs from
the backend across the full queue, not only the loaded page, and places that
exact snapshot into the selection. Samples that enter the queue after this
request are not silently added.

The server-only submission endpoint validates the manager OTP step-up before
creating a batch. For each selected sample, it resolves exactly the results
whose current status is `entered`, matching the existing single-sample UI
behavior, and stores those result IDs with the batch note. Already approved and
other non-`entered` results are not selected.

The batch stores server-derived step-up metadata, including an opaque
authorization/session reference, verification time, and cohort, but never
stores the OTP, step-up cookie, access token, refresh token, or manager JWT.

The worker still revalidates the manager's active role and confidential access
at execution time. If the manager loses authorization or any selected result
is no longer `entered` for that sample, the item fails closed. A result added
after the snapshot is not silently approved; it remains unapproved and keeps
the sample in `review` after the selected results commit.

### Decision 4: Store durable batch, item, and attempt records

The migration adds:

- `approval_batches`: immutable request identity, `requested_by`, timestamps,
  common note, step-up metadata, request idempotency key, canonical request
  fingerprint, optional `parent_batch_id`, and terminal status.
- `approval_batch_items`: one immutable sample/result-ID snapshot per batch,
  execution status, attempt count, retry time, claim token/lease, terminal error
  code, sanitized Vietnamese-safe error parameters, and completion timestamps.
- `approval_batch_item_attempts`: append-only claim, start, success, retry, and
  terminal-failure evidence for operations and debugging.

Batch statuses are `queued`, `processing`, `completed`, and
`completed_with_failures`. Item statuses are `queued`, `processing`,
`retry_wait`, `succeeded`, and `failed`.

The database enforces unique `(batch_id, sample_id)` items and unique
`(requested_by, request_key)` submissions. A repeated key returns the existing
batch only when the canonical fingerprint of sorted sample IDs, normalized
note, and request mode matches; a different payload returns a conflict.
Progress queries aggregate item statuses using an index beginning with
`(batch_id, status)`; no race-prone client-maintained counters are
authoritative.

These records are not hard-deleted. A later retention change, if required,
must preserve audit and regulatory obligations.

### Decision 5: Claim work with leases and bounded concurrency

The TypeScript worker runs as a separate process/container from the Next.js web
process but is built from this repository. Claiming uses
`FOR UPDATE SKIP LOCKED` in short transactions, assigns an opaque claim token
and lease expiry, and never holds database locks while waiting between jobs.

Initial defaults are:

- Worker concurrency: `8`.
- Configurable upper bound: `16`.
- Claim size: no greater than available concurrency.
- Automatic attempts: `3`.
- Bounded exponential backoff with jitter.

The database connection pool is bounded with the worker concurrency. These
values are configuration, not user-facing controls, and must be tuned using a
200-sample benchmark on production-like hardware before rollout.

Initial acceptance thresholds under the same production-like test fixture are:

- Synchronous single-approval p95 SHALL NOT regress by more than 10 percent from
  the Phase P0 baseline.
- A 200-sample approval batch SHALL reach terminal approval status within 120
  seconds, excluding independent CoA rendering.
- Batch-status polling p95 SHALL remain below 250 milliseconds at 200 items.
- Approval execution SHALL produce no deadlocks, keep lock-wait p95 below 250
  milliseconds, and avoid connection-acquire waits above one second.
- Approval queue interactive-read p95 SHALL NOT regress by more than 20 percent
  while the 200-sample batch is active.

On graceful shutdown the worker stops claiming, waits for in-flight items up to
a configured drain timeout, and exits. An expired lease makes interrupted work
claimable again.

### Decision 6: Make execution idempotent at request, item, and approval levels

Submitting the same request key and canonical request fingerprint returns the
existing batch. Reusing the key with a different sample set, note, or request
mode returns a conflict. A sample appears at most once in a batch. A claim token
can complete only its claimed item and stale claim tokens cannot overwrite a
newer attempt.

The approval command records the originating batch item when applicable. A
replayed item that already committed returns the prior successful outcome
without updating results, sample state, CoA queue state, or audit evidence
again. If a selected result is no longer eligible through another valid
workflow, the item returns a terminal invalid-state or conflict outcome rather
than treating unrelated state as its own success.

Automatic retry is reserved for classified transient failures. Authorization,
QC block, invalid state, and validation failures are terminal.
The manager's `Thử lại mẫu lỗi` action requires a current authenticated,
step-up-authorized session and creates a new child batch containing only the
failed samples. The original terminal evidence remains immutable.

### Decision 7: Keep every approval mutation behind server-only execution

The existing OTP proof is a signed server cookie and is not present in the
normal Supabase JWT. Therefore `anon` and `authenticated` MUST NOT receive
`EXECUTE` on the single-approval, batch-create, batch-retry, claim, or execution
mutation RPCs. A manager with only a password-authenticated JWT must be unable
to call PostgREST directly and bypass step-up.

The Next.js approval endpoint validates the authenticated user and current OTP
step-up cookie, then invokes the single or batch mutation through a protected
server credential. The server-only wrapper receives the validated manager ID,
revalidates role and confidential access in PostgreSQL, and establishes that
manager as the transaction-local audit actor. Status reads may remain
authenticated and RLS-scoped because they do not mutate approval state.

The worker receives a dedicated database credential with only the minimum
connection and `EXECUTE` privileges required for claim and execution RPCs. It
has no direct table DML grants and no manager session material.

The service-only execution RPC accepts only an item ID and claim token. It
locks the item, reads immutable `requested_by` and approval inputs from the
database, revalidates that manager, and establishes a transaction-local
PostgREST-compatible actor claim before invoking the internal approval command.
Existing audit triggers therefore resolve `auth.uid()` to the requesting
manager, not the worker login. The worker cannot supply an arbitrary actor,
sample, result set, or note to this RPC.

Internal core and mutation wrapper functions are not executable by `anon` or
`authenticated`. The web server role and worker role receive only their
intended wrappers. Every `SECURITY DEFINER` function pins `search_path`, and
grants are explicitly revoked before narrow grants are added.

### Decision 8: Keep CoA handoff independent and TypeScript-owned

When approval completes a sample, the same database transaction creates or
reuses one `approval_coa_outbox` event keyed to that completion. The outbox row
stores only the sample, approval actor, idempotency identity, dispatch state,
claim lease, and sanitized terminal outcome; append-only
`approval_coa_outbox_attempts` rows store dispatch evidence. Neither relation
is hard-deleted. Outbox insertion MUST NOT resolve or validate a source
submission, create a `coa_reports` row, claim generation, load a signature, or
call storage. This closes the crash window for durable handoff without turning
CoA provenance into an approval eligibility rule.

The worker container adds a separate low-concurrency CoA dispatch loop. It
claims outbox rows with leases, then calls worker-only prepare, complete, and
fail wrappers through the dedicated no-DML database role. The prepare wrapper
accepts only the outbox ID and claim token, derives the sample, approval actor,
current CoA source submission, report identity, and generation claim from
locked database state, and invokes shared internal logic extracted from the
existing authenticated CoA RPCs. The complete and fail wrappers remain bound to
the report and generation claim persisted for that outbox attempt; the worker
cannot provide an arbitrary actor, sample, report, source submission, or claim.

The wrappers establish the database-derived CoA actor as the transaction-local
actor solely for the locked transition. `anon`, `authenticated`,
`service_role`, and unrelated roles receive no worker-wrapper execution grant;
the existing authenticated manual CoA RPCs keep their current grants and
behavior. Every worker wrapper pins `search_path`, has explicit revokes, and is
covered by grant, claim-ownership, actor-attribution, and stale-token tests.

The TypeScript adapter reuses the existing React renderer, signature integrity
checks, immutable source binding, storage upload, hashing, reconciliation, and
failure recording rather than reimplementing them. The synchronous approval
path may retain its current best-effort non-blocking CoA trigger during rollout;
the outbox dispatcher must safely reconcile reports that are already claimed or
ready.

If source-submission or snapshot validation fails during dispatch, the
dispatcher records a sanitized retryable or terminal outbox outcome without
rolling back the completed sample or changing approval-batch success. Once a
`coa_reports` record exists, rendering and storage failures continue through
the existing CoA failure and retry workflow. Batch progress counts an item as
successful as soon as approval commits, regardless of outbox or
`coa_reports.status`.

### Decision 9: Expose polling-friendly, authorization-scoped APIs

Client mutations remain behind `src/lib/api-client.ts`. The batch API provides:

- Select all pending: returns the complete authorization-scoped set of pending
  sample IDs and its count for an exact client selection snapshot.
- Submit: validates the current manager and step-up state, persists the batch,
  and returns HTTP `202` plus `batchId`.
- Status: returns aggregate counts, terminal state, timestamps, and paginated
  per-sample outcomes visible to the requesting manager.
- Retry failed: creates a child batch from currently failed items only and
  returns HTTP `202` plus the new `batchId`.

When the batch feature flag is disabled, select-all, submit, and retry endpoints
reject direct requests server-side. Hiding UI controls is not the security
boundary.

Rows expose checkboxes with a stable selected count. The page-level checkbox is
tri-state for the loaded page, while the explicit `Chọn tất cả` command loads
and selects every pending sample ID in the manager's authorization scope.
Managers can deselect individual samples before confirmation.

`Duyệt hàng loạt` opens a mandatory confirmation dialog showing the exact
selected count, the common approval note when present, and that processing will
continue in the background with per-sample outcomes. No batch is created until
the manager activates `Xác nhận duyệt`. Closing the dialog or selecting `Hủy`
leaves the selection intact and creates no server-side batch.

The UI polls the active batch every one second, stops polling at a terminal
state, refetches on focus/reload, and can reopen the manager's recent batches.
Submitting a batch does not optimistically mark samples approved. Successful
items are removed or refreshed from the approval queue as confirmed progress
arrives.

RLS limits manager reads to their own batch rows and to samples they remain
authorized to discover. Unauthorized or confidentially concealed items use
non-disclosing errors.

### Decision 10: Separate approval observability from regulated audit evidence

Structured operational logs include batch ID, item ID, attempt number, outcome
code, duration, worker instance, and queue depth. They exclude patient/client
identity, sample codes, result values, notes, OTP data, signatures, tokens, and
raw database errors.

Audit tables remain the source of truth for who approved each result and when.
Worker logs are diagnostic only and cannot substitute for immutable database
audit evidence.

Worker health distinguishes process liveness from database readiness. Alerts
cover stale leases, growing queue age, repeated terminal failures, and worker
unavailability.

The authoritative queue-age observation is database-derived after each claim
and before claimed executions begin. Eligibility exactly matches the claim
contract: queued first attempts, due retry waits below attempt three, and
expired processing leases below attempt three. PostgreSQL returns only its
observation timestamp and the nonnegative seconds since the earliest eligible
item `created_at`; no eligible item returns zero. If the observation fails, the
worker still executes every lease it already claimed, marks readiness
unhealthy, and exports `NaN` so an unknown value cannot be mistaken for an
empty queue.

## Risks / Trade-offs

- **Higher database write concurrency can increase lock contention** →
  deterministically lock one sample at a time, cap concurrency at 16, use short
  transactions, and tune from measured 200-sample tests.
- **A manager can lose authorization after submitting a batch** → revalidate
  role and confidential access for every item and fail remaining work closed.
- **Selected result eligibility can change while waiting** → store the exact
  current `entered` result IDs and fail the item if any selected result is no
  longer `entered`; later-added results are not approved and keep the sample in
  `review`.
- **A worker can stop after committing but before acknowledging success** →
  persist item provenance in the approval transaction and treat replay as
  idempotent success.
- **CoA generation may lag or fail after approval** → transactionally persist
  an approval-to-CoA outbox event that performs no provenance check, consume it
  through narrowly granted worker wrappers, and keep outbox/report status
  independent from approval and batch retry.
- **One-second polling adds read traffic** → query indexed aggregates, paginate
  item details, poll only nonterminal batches, and stop promptly at completion.
- **A transaction-local actor mechanism could be abused by a broad worker
  credential** → use a dedicated no-DML login, derive the actor only from the
  locked batch row, and regression-test grants plus audit attribution.
- **The manager approval queue has a separate active optimization proposal** →
  keep this change limited to selection/mutation/progress components and
  integrate with the final queue-query contract rather than duplicating it.

## Migration Plan

1. Add failing SQL tests for current approval invariants, atomic rollback,
   concurrency, idempotency, server-only grants, audit actor attribution, and
   selected-result state changes.
2. Apply a forward-only migration for batch tables, indexes, RLS, audit
   triggers, the shared approval command, and narrow wrapper RPCs. Run
   `run_security_tests()` immediately after application.
3. Refactor only the existing single-sample endpoint to call the server-only
   atomic wrapper after its OTP guard. Keep the UI unchanged and verify
   behavior/performance before enabling batch APIs.
4. Add batch API contracts and UI behind a disabled feature flag. Verify the
   server rejects direct mutation requests while disabled and that duplicate
   submission with the same fingerprint resumes the same durable batch.
5. Add the worker build, dedicated credential, health check, claiming,
   execution, retry, and graceful-shutdown behavior. Deploy it dark before
   exposing batch submission.
6. Add the transactional approval-to-CoA outbox and worker-only prepare,
   complete, and fail wrappers. Prove missing or mismatched CoA source
   submissions cannot roll back approval.
7. Add the low-concurrency TypeScript CoA dispatch loop and adapter around the
   existing renderer, then run crash-window, worker-grant, provenance, claim,
   completion, failure, and restart tests.
8. Run deterministic concurrency tests and benchmark 1, 20, 100, and 200
   samples with concurrency `1`, `4`, `8`, and `16` against the stated pass
   thresholds.
9. Enable batch approval for managers after single approval, security tests,
   worker recovery, polling, and CoA handoff evidence pass.

Rollback disables batch submission and stops the worker while leaving durable
records intact. Single approval continues through the shared atomic command.
Schema or security fixes use new forward-only migrations; applied migrations
are never edited or removed.

## Open Questions

No blocking product questions remain. The initial worker concurrency defaults
to `8`, with a hard configuration cap of `16`; rollout measurements determine
whether production should stay at `8` or increase. The acceptance benchmark is
200 samples, while queue-wide selection may contain more and remains protected
by bounded worker concurrency.
