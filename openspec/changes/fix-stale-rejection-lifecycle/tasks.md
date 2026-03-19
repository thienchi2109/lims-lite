## 1. Database Migration (119_clear_rejection_on_resubmit.sql)
- [x] 1.1 Write failing regression coverage for stale rejection metadata on both `completed` and `review` samples
- [x] 1.2 Update `submit_sample_for_review` RPC Phase 5 to clear `rejection_reason`, `rejected_at`, `rejected_by`
- [x] 1.3 Write backfill SQL to clear stale rejection data on `completed` and `review` samples
- [x] 1.4 Add self-verification DO block

## 2. Backend Guards (TypeScript)
- [x] 2.1 Write failing regression test: `approveResults()` must reject non-`review` samples before mutating results
- [x] 2.2 Add `sample.status = 'review'` guard in `approveResults()` (`results.ts`)
- [x] 2.3 Clear rejection fields in `approveResults()` when setting status to `completed`
- [x] 2.4 Clear rejection fields in `cancelApproval()` (`results.ts`) — defense-in-depth
- [x] 2.5 Add `'in_progress'` to `discardableStatuses` in `discardSample()` (`sample-approvals.ts`)

## 3. UI Fix
- [x] 3.1 Write failing component tests for rejection banner visibility by status
- [x] 3.2 Guard rejection banner in `sample-detail-panel.tsx` to only show for `in_progress` and `discarded`
- [x] 3.3 Write failing manager samples workspace test for discard action on `in_progress` samples
- [x] 3.4 Expose discard action for `in_progress` samples in the manager samples workspace without changing review-page behavior

## 4. Verification
- [x] 4.1 `npm run typecheck` passes
- [x] 4.2 Apply migration to Docker Postgres (when available)
- [x] 4.3 Run `run_security_tests()` (when available)
- [x] 4.4 Manual test: reject → re-submit → approve → verify no banner on completed sample
- [x] 4.5 Manual test: stale `review` sample after backfill shows no rejection banner until a new rejection occurs
- [x] 4.6 Manual test: reject → discard from `in_progress` in manager samples workspace succeeds
