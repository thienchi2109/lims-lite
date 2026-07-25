## Why

Manager approval is currently optimized for one sample at a time, so approving
large sets requires repeated foreground requests and gives the manager no
durable progress or per-sample recovery view. The system needs a reliable batch
path for workloads such as 200 samples while keeping normal single-sample
approval immediate and preserving every existing authorization, quality,
signature, audit, and CoA rule.

## What Changes

- Introduce one server-only atomic PostgreSQL approval command per sample as the
  shared business-logic boundary for both single and batch approval.
- Keep single-sample approval synchronous: the existing manager action calls the
  atomic command directly and returns the final approval outcome without queue
  or polling delay.
- Add durable approval batches and per-sample items so a manager can submit a
  large selection, leave the page, and later inspect aggregate progress and
  individual outcomes.
- Add a TypeScript background worker in this repository, deployed as a separate
  process/container, that claims queued items with bounded concurrency and
  executes the same atomic per-sample command.
- Add bounded retry and idempotency so transient failures can recover without
  approving a sample twice or duplicating approval audit evidence.
- Add manager approval-queue controls with Vietnamese copy for checkbox-based
  multiple selection, `Chọn tất cả` across the full pending queue rather than
  only the loaded page, a mandatory confirmation dialog, starting a batch,
  polling progress every second, viewing per-sample failures, and retrying
  failed items only.
- Keep approval completion independent from CoA generation completion. When a
  sample becomes completed, the approval transaction records an idempotent
  approval-to-CoA outbox event without evaluating CoA source-submission
  eligibility. A separate low-concurrency TypeScript loop reuses the existing
  CoA claim, rendering, signature-revalidation, and provenance pipeline.
- Preserve existing manager OTP step-up, electronic-signature requirements,
  confidential-sample authorization, QC fail-closed checks, RLS, immutable
  submission snapshots, and audit attribution.
- Deny direct approval mutation RPC execution to normal authenticated JWTs so
  the current server-validated OTP step-up cannot be bypassed through
  PostgREST.

## Capabilities

### New Capabilities

- `batch-result-approval`: Durable background batch submission, per-sample
  atomic execution, progress reporting, retry, idempotency, worker operation,
  and separation from CoA completion.

### Modified Capabilities

- `sample-management`: Extend the manager approval queue with checkbox-based
  multi-selection, queue-wide `Chọn tất cả`, background batch submission,
  reload-safe progress, and failed-item retry while preserving the immediate
  single-sample approval path.

## Impact

- **Database:** New approval-batch, batch-item, attempt, and approval-to-CoA
  outbox relations, indexes, RLS policies, audit coverage, and narrowly granted
  RPCs. The shared per-sample approval RPC becomes the transaction boundary for
  result approval, sample completion, immutable approval evidence, and durable
  CoA handoff intent.
- **Backend:** Existing single approval is refactored to a server-only shared
  RPC after the current OTP guard. New batch submission/status/retry actions and
  a separately runnable TypeScript worker are added without introducing a Go
  service.
- **Frontend:** The manager approval queue gains Vietnamese batch controls and a
  one-second polling progress view. Existing single-sample interaction remains
  synchronous.
- **Compliance and security:** Every sample remains an independent auditable
  transaction. The worker does not persist manager JWTs; service-only execution
  revalidates the immutable requesting manager and attributes audit records to
  that manager. RLS remains the final read boundary, and direct client writes to
  batch execution state are denied.
- **Operations:** The application deployment adds one worker process/container
  with a bounded approval loop, a separately bounded CoA dispatch loop, retry
  limits, health reporting, and safe restart behavior. No production database
  operation is part of this proposal.
- **CoA:** Existing CoA business rules and TypeScript rendering/storage code are
  reused rather than reimplemented. The worker process may execute that
  existing pipeline through worker-only wrappers, but CoA source eligibility,
  claims, retries, and final status do not determine whether approval succeeds
  or an approval batch is complete.
