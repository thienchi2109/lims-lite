## 1. Database Migration (119_clear_rejection_on_resubmit.sql)
- [ ] 1.1 Write smoke test: completed sample with stale rejection_reason should not exist after backfill
- [ ] 1.2 Update `submit_sample_for_review` RPC Phase 5 to clear `rejection_reason`, `rejected_at`, `rejected_by`
- [ ] 1.3 Write backfill SQL to clear stale rejection data on `completed` and `review` samples
- [ ] 1.4 Add self-verification DO block

## 2. Backend Guards (TypeScript)
- [ ] 2.1 Add `sample.status = 'review'` guard in `approveResults()` (`results.ts`)
- [ ] 2.2 Clear rejection fields in `approveResults()` when setting status to `completed`
- [ ] 2.3 Clear rejection fields in `cancelApproval()` (`results.ts`) — defense-in-depth
- [ ] 2.4 Add `'in_progress'` to `discardableStatuses` in `discardSample()` (`sample-approvals.ts`)

## 3. UI Fix
- [ ] 3.1 Guard rejection banner in `sample-detail-panel.tsx` to only show for `in_progress` and `discarded`

## 4. Verification
- [ ] 4.1 `npm run typecheck` passes
- [ ] 4.2 Apply migration to Docker Postgres (when available)
- [ ] 4.3 Run `run_security_tests()` (when available)
- [ ] 4.4 Manual test: reject → re-submit → approve → verify no banner
