## ADDED Requirements

### Requirement: Single-sample approval SHALL use the atomic approval path synchronously

The system SHALL execute normal one-sample manager approval synchronously
through the same atomic per-sample approval command used by batch processing.
The single-sample path SHALL NOT create a batch, wait for worker scheduling, or
require progress polling.

#### Scenario: Manager approves one eligible sample

- **GIVEN** the manager has a valid authenticated session and required OTP
  step-up
- **AND** the sample and selected results satisfy all existing approval rules
- **WHEN** the manager selects `Duyệt` for that sample
- **THEN** the system SHALL commit the sample approval in one database
  transaction
- **AND** the response SHALL contain the final approval outcome
- **AND** the request SHALL NOT create an approval batch item.

#### Scenario: Single-sample approval fails validation

- **WHEN** any role, confidential-access, sample-state, result-state, or QC
  check fails
- **THEN** the system SHALL roll back every approval mutation for that sample
- **AND** the synchronous response SHALL return a sanitized failure.

### Requirement: Batch submission SHALL persist an authorized immutable request

The system SHALL allow a currently authorized and OTP-step-up-verified manager
to submit two or more distinct approval-eligible samples. It SHALL resolve and
persist the requesting manager, the exact set of results currently in `entered`
status for each sample, an optional common note, a canonical request
fingerprint, and server-derived step-up metadata without storing OTP values,
cookies, access tokens, refresh tokens, or manager JWTs.

#### Scenario: Manager submits a valid batch

- **WHEN** an authorized manager submits 200 distinct visible samples with a
  new request key
- **THEN** the system SHALL create one durable batch and one item per sample
- **AND** it SHALL return HTTP `202` with the batch identifier
- **AND** the browser request SHALL NOT wait for all samples to be approved.

#### Scenario: Client repeats the same batch request

- **WHEN** the same manager submits the same request key and canonical request
  fingerprint again
- **THEN** the system SHALL return the existing batch identifier
- **AND** it SHALL NOT create duplicate batch items.

#### Scenario: Client reuses a request key for different intent

- **WHEN** the same manager submits an existing request key with a different
  canonical request fingerprint
- **THEN** the system SHALL reject the request as an idempotency conflict
- **AND** it SHALL NOT modify the existing batch or create another batch.

#### Scenario: Batch snapshots currently entered results

- **WHEN** an eligible batch request is accepted
- **THEN** each item SHALL persist every result for that sample that is
  currently in `entered` status
- **AND** it SHALL NOT include already approved, rejected, voided, or
  subsequently created results.

#### Scenario: Batch request contains an ineligible or concealed sample

- **WHEN** the submitted sample set includes a sample the manager cannot
  discover or submit for approval
- **THEN** the system SHALL reject the batch without creating a partial batch
- **AND** the response SHALL NOT disclose confidential sample metadata.

### Requirement: Each batch item SHALL execute as an independent atomic transaction

The worker SHALL process each sample through the shared approval command in its
own database transaction. A failure for one sample SHALL NOT roll back or block
successful approval of unrelated samples in the same batch.

#### Scenario: One sample fails in a mixed batch

- **GIVEN** a batch contains eligible samples and one sample that becomes stale
  before execution
- **WHEN** the worker processes the batch
- **THEN** eligible samples SHALL commit independently as successful items
- **AND** the stale sample SHALL become a failed item without approval writes
- **AND** the batch SHALL finish as `completed_with_failures`.

#### Scenario: Approval command fails after a write begins

- **WHEN** an error occurs before the per-sample approval transaction commits
- **THEN** all result, sample, provenance, and approval audit mutations from
  that attempt SHALL roll back
- **AND** no partial approval SHALL be visible.

### Requirement: Per-sample execution SHALL preserve all existing approval rules

At execution time the system SHALL revalidate the requesting manager's active
manager role, confidential access, sample status, each snapshotted result's
identity and ownership, selected result statuses, and QC approval state.
Missing, malformed, stale, unauthorized, or blocked evidence SHALL fail closed.

#### Scenario: Manager authorization is revoked while a batch is queued

- **WHEN** a requesting manager loses the manager role or required confidential
  access before an item executes
- **THEN** that item SHALL fail without approving the sample
- **AND** later items SHALL revalidate authorization independently.

#### Scenario: A selected result changes after batch submission

- **WHEN** a result in the immutable item snapshot no longer exists, no longer
  belongs to the selected sample, or is no longer in `entered` status
- **THEN** the item SHALL fail as stale
- **AND** the worker SHALL NOT approve any result for that item.

#### Scenario: A result is added after batch submission

- **WHEN** a new `entered` result is added to the sample after the immutable
  item snapshot was accepted
- **THEN** the worker SHALL approve only the snapshotted results
- **AND** the later result SHALL remain unapproved
- **AND** the sample SHALL remain in `review` when that later result prevents
  completion.

#### Scenario: QC response is blocked or invalid

- **WHEN** any selected result is QC-blocked or the QC response is missing,
  malformed, or incomplete
- **THEN** the item SHALL fail closed
- **AND** no selected result SHALL become approved.

### Requirement: Worker claiming SHALL be concurrent, bounded, and recoverable

The worker SHALL claim eligible items using row locks with
`FOR UPDATE SKIP LOCKED`, opaque claim tokens, and expiring leases. Runtime
concurrency SHALL default to 8 and SHALL NOT be configurable above 16.

#### Scenario: Multiple worker loops claim available work

- **WHEN** concurrent worker loops request work from the same queue
- **THEN** each item SHALL be claimed by at most one active lease
- **AND** locked items SHALL not block claims for unrelated available items.

#### Scenario: Worker stops during an item

- **WHEN** a worker exits before acknowledging an in-flight item
- **THEN** the item SHALL become claimable after its lease expires
- **AND** replay SHALL not duplicate a previously committed approval.

#### Scenario: Worker shuts down normally

- **WHEN** the worker receives a termination signal
- **THEN** it SHALL stop claiming new items
- **AND** it SHALL allow in-flight work to drain for the configured bounded
  interval before exiting.

### Requirement: Retry and idempotency SHALL preserve immutable outcomes

The system SHALL prevent duplicate batches, duplicate items, duplicate
approval mutations, and stale claim completion. It SHALL automatically retry
only classified transient failures with bounded backoff and a maximum of three
attempts.

#### Scenario: Transient database failure recovers

- **WHEN** an item encounters a classified transient failure and has attempts
  remaining
- **THEN** the system SHALL persist the failed attempt
- **AND** it SHALL schedule a bounded delayed retry
- **AND** a later successful attempt SHALL produce one approval outcome.

#### Scenario: Business-rule failure occurs

- **WHEN** an item fails authorization, validation, stale-selection,
  invalid-state, or QC checks
- **THEN** it SHALL become terminally failed without automatic retry.

#### Scenario: Manager retries failed samples

- **GIVEN** a completed batch contains failed items
- **WHEN** the same currently authorized and step-up-verified manager selects
  `Thử lại mẫu lỗi`
- **THEN** the system SHALL create a child batch containing only samples from
  failed items
- **AND** the original item and attempt history SHALL remain unchanged.

### Requirement: Batch progress SHALL be durable and reload-safe

The system SHALL expose manager-authorized aggregate counts and paginated
per-sample outcomes from durable database state. The UI SHALL poll a nonterminal
batch every one second and SHALL stop polling when it reaches `completed` or
`completed_with_failures`.

#### Scenario: Manager watches an active batch

- **WHEN** the worker completes or fails items
- **THEN** the next poll SHALL return updated queued, processing, retrying,
  succeeded, and failed counts
- **AND** confirmed successful samples SHALL refresh out of the approval queue.

#### Scenario: Manager reloads the page

- **WHEN** the manager reloads or revisits the approval page while their batch
  is running
- **THEN** the UI SHALL reopen the durable progress state
- **AND** polling SHALL resume without submitting a duplicate batch.

#### Scenario: Unauthorized user requests batch status

- **WHEN** a user who did not request the batch attempts to read its status
- **THEN** RLS and the API SHALL deny or conceal the batch
- **AND** no sample outcome or count SHALL be disclosed.

### Requirement: Worker execution SHALL retain manager audit attribution

The background worker SHALL NOT store or replay a manager JWT. A service-only
execution wrapper SHALL derive the actor and approval inputs only from the
locked batch item, revalidate the manager, and establish that manager as the
transaction-local audit actor before approval writes occur.

#### Scenario: Worker approves an item

- **WHEN** the service-only wrapper commits an eligible item
- **THEN** result and sample audit records SHALL identify the requesting
  manager as the actor
- **AND** they SHALL NOT identify the worker login as the approver.

#### Scenario: Worker attempts to supply another actor or sample

- **WHEN** the worker calls the execution wrapper
- **THEN** the wrapper SHALL accept only the item identifier and active claim
  token as execution identity
- **AND** it SHALL load manager, sample, selected result set, and note from
  immutable database rows.

#### Scenario: Untrusted role calls a worker RPC

- **WHEN** `anon`, `authenticated`, or an unrelated database role attempts to
  claim or execute batch work directly
- **THEN** PostgreSQL SHALL deny execution
- **AND** direct DML against worker-owned execution state SHALL remain denied.

### Requirement: Approval mutations SHALL require server-validated OTP and server-only execution

The system SHALL deny direct approval mutation execution to `anon`,
`authenticated`, and unrelated database roles. The Next.js server SHALL
validate the current authenticated manager and OTP step-up cookie before using
a protected server credential to invoke single-approval, batch-create, or
batch-retry mutations.

#### Scenario: Password-only manager JWT calls an approval mutation

- **GIVEN** a manager has a valid password-authenticated Supabase JWT but no
  valid OTP step-up cookie
- **WHEN** that JWT calls an approval mutation RPC through PostgREST
- **THEN** PostgreSQL SHALL deny execution
- **AND** no approval or batch mutation SHALL occur.

#### Scenario: Server endpoint receives no valid OTP proof

- **WHEN** a single-approval, batch-create, or batch-retry endpoint receives a
  request without current valid OTP step-up
- **THEN** the endpoint SHALL reject the request before invoking the server-only
  mutation
- **AND** it SHALL NOT create approval, batch, or retry state.

### Requirement: Batch entry points SHALL be disabled server-side by configuration

The server SHALL enforce the batch feature flag for queue-wide selection,
batch submission, and failed-item retry. Hiding UI controls SHALL NOT be the
feature boundary.

#### Scenario: A client calls a disabled batch endpoint directly

- **GIVEN** the batch approval feature flag is disabled
- **WHEN** a client directly requests select-all, batch submission, or
  failed-item retry
- **THEN** the server SHALL reject the request
- **AND** it SHALL create no batch or retry state and disclose no additional
  sample identifiers.

### Requirement: Approval completion SHALL remain independent from CoA completion

When an approval transaction completes a sample, that same transaction SHALL
create or reuse one idempotent approval-to-CoA outbox event. Creating the event
SHALL NOT validate CoA source-submission eligibility or create or claim a
`coa_reports` record. Approval item success SHALL NOT wait for outbox dispatch,
React rendering, signature retrieval, storage upload, document hashing, or
final `coa_reports` completion.

#### Scenario: Sample completion and CoA handoff intent commit atomically

- **WHEN** an approval transaction changes a sample to `completed`
- **THEN** the sample completion and one idempotent approval-to-CoA outbox event
  SHALL commit together
- **AND** a rollback before commit SHALL leave neither the completion nor a new
  CoA handoff visible.

#### Scenario: CoA provenance is unavailable after approval

- **GIVEN** approval has committed with a durable outbox event
- **WHEN** dispatch cannot resolve a valid source submission or the reviewed
  snapshot does not match current CoA requirements
- **THEN** the dispatcher SHALL record a sanitized retryable or terminal outbox
  outcome
- **AND** the sample approval and batch item SHALL remain successful
- **AND** no invalid `coa_reports` record SHALL be created.

#### Scenario: Approval succeeds and CoA rendering continues

- **WHEN** a batch item commits approval and the sample becomes `completed`
- **THEN** a separate low-concurrency TypeScript CoA dispatcher SHALL be able to
  claim the durable outbox event through worker-only database wrappers
- **AND** the item SHALL be counted as approval success without waiting for
  final CoA rendering.

#### Scenario: Worker prepares and completes CoA without a manager JWT

- **WHEN** the CoA dispatcher processes a claimed outbox event
- **THEN** worker-only prepare, complete, and fail wrappers SHALL derive the
  actor, sample, source submission, report, and generation claim from locked
  database state
- **AND** the worker SHALL NOT be able to supply an arbitrary actor, report,
  source submission, or generation claim
- **AND** `anon`, `authenticated`, `service_role`, and unrelated roles SHALL be
  denied execution of those wrappers.

#### Scenario: CoA generation later fails

- **WHEN** CoA generation records a failed report after approval succeeded
- **THEN** the approval batch and item SHALL remain successful
- **AND** the failure SHALL remain visible and retryable through the existing
  CoA workflow.

### Requirement: Batch operations SHALL expose privacy-safe observability

The worker SHALL expose liveness, database readiness, queue age, claim/retry
counts, and sanitized structured outcomes without logging patient/client
identity, sample codes, result values, approval notes, OTP data, signatures,
tokens, or raw confidential errors.

#### Scenario: Worker records an item attempt

- **WHEN** an item attempt starts or ends
- **THEN** operational telemetry SHALL include opaque batch/item identity,
  attempt number, duration, and outcome code
- **AND** regulated content and credentials SHALL be absent.

#### Scenario: Worker database dependency is unavailable

- **WHEN** the process is alive but cannot reach PostgreSQL
- **THEN** liveness MAY remain healthy
- **AND** readiness SHALL report unhealthy
- **AND** no item SHALL be reported as successfully approved.
