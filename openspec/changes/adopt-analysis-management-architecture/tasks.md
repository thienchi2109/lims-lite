## 1. Discovery and Test Anchors

- [ ] 1.1 Inventory current `samples`, `results`, `sample_submissions`, assay/method, CoA, QC, and approval fields against the proposed analysis lifecycle.
- [ ] 1.2 Trace current write paths for result save, sample submission, approval, rejection, discard, CoA generation, and QC blocking.
- [ ] 1.3 Add failing SQL regression tests for lifecycle transitions, incomplete submission denial, unauthorized approval denial, audit records, and no-hard-delete behavior.
- [ ] 1.4 Add failing TypeScript tests for guard result typing, workbench row shaping, Vietnamese status labels, and cache invalidation expectations.

## 2. Database Contract

- [ ] 2.1 Create a forward-only migration for analysis lifecycle metadata on `results` or an analysis companion table.
- [ ] 2.2 Add template snapshot storage for assay name, method name, unit, result range, and source assay/method IDs.
- [ ] 2.3 Add lifecycle/audit triggers or immutable event records for entered, submitted, approved, rejected, voided, and superseded transitions.
- [ ] 2.4 Update RLS policies and grants with explicit role checks for new analysis lifecycle/snapshot data.
- [ ] 2.5 Document migration security impact in the migration file and preserve soft-delete/void-only semantics.

## 3. Guard and Workflow Implementation

- [ ] 3.1 Implement server-side guard result types with stable `allowed`, `code`, `messageKey`, and `facts` fields.
- [ ] 3.2 Implement guards for enter result, submit analysis/sample, approve, reject, reopen rejected, and CoA readiness.
- [ ] 3.3 Route `saveBatchResults`, `submitSampleForReview`, `approveResults`, `rejectSample`, and CoA eligibility checks through guard evaluation.
- [ ] 3.4 Ensure guard denial returns localized UI-safe reason codes while backend and RLS remain authoritative.
- [ ] 3.5 Ensure all lifecycle-changing mutations write audit records with actor, timestamp, previous state, next state, and reason where applicable.

## 4. Workbench Read Model

- [ ] 4.1 Define shared `AnalysisWorkbenchRow` TypeScript and Zod schemas.
- [ ] 4.2 Add a backend read helper or RPC that returns lifecycle, display context, guard facts, and audit summary for analysis rows.
- [ ] 4.3 Update analyst result entry reads to consume the shared workbench row contract.
- [ ] 4.4 Update manager approval/sample detail reads to consume the same row interpretation.
- [ ] 4.5 Update CoA data fetching to use approved active reportable analyses and stored snapshot context.

## 5. UI Integration

- [ ] 5.1 Add Vietnamese lifecycle/status labels and guard denial messages.
- [ ] 5.2 Update analyst result entry actions to render from guard facts instead of duplicated client-side rules.
- [ ] 5.3 Update manager approval actions, result status badges, and sample detail panels to render from the shared workbench contract.
- [ ] 5.4 Add manager-visible retryable CoA failure messaging when approved analysis context is missing or inconsistent.
- [ ] 5.5 Preserve existing page layout and route behavior unless a focused UI task requires change.

## 6. Verification and Rollout

- [ ] 6.1 Apply the migration to the Docker-backed local database.
- [ ] 6.2 Run `SELECT * FROM run_security_tests();` and verify relevant policy state after migration apply.
- [ ] 6.3 Run lifecycle SQL regression tests covering transition guards, RLS, audit records, snapshots, and CoA readiness.
- [ ] 6.4 Run focused action/hook/component tests for result save, submission, approval, rejection, workbench payload, and CoA failure handling.
- [ ] 6.5 Run `npm run typecheck` and `npm run lint`.
- [ ] 6.6 Update or cross-reference dependent OpenSpec changes (`add-assay-method-m2m`, `add-coa-generation-and-access`, `add-westgard-qc`, `optimize-approval-queue-two-phase`) with the final analysis management contract.
