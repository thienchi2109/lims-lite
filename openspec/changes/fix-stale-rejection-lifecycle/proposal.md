## Why

Three confirmed bugs in the sample approval/rejection workflow cause:
1. **Stale rejection data** on completed/re-submitted samples — `rejection_reason`, `rejected_at`, `rejected_by` are never cleared when a sample re-enters the workflow after rejection.
2. **Missing status guard** on `approveResults()` — manager can approve results even when sample is in `in_progress` (bypassing the analyst's `submitSampleForReview` e-signature flow).
3. **Rejected samples cannot be discarded** — `discardSample()` does not accept `in_progress`, so after `rejectSample()` reverts a sample to `in_progress`, the manager cannot discard it without a round-trip through the analyst.

The UI consequence: a `completed` sample displays a "Mẫu đã bị từ chối" banner if it was ever rejected in a prior cycle. The search index (`search_vector`) also indexes stale `rejection_reason` text.

## What Changes

- **RPC `submit_sample_for_review`**: Clear `rejection_reason`, `rejected_at`, `rejected_by` in Phase 5 (migration 119)
- **`approveResults()`** (`results.ts`): Add `sample.status = 'review'` guard; clear rejection fields when setting `completed`
- **`cancelApproval()`** (`results.ts`): Clear rejection fields as defense-in-depth
- **Discard flow**: Add `'in_progress'` to `discardableStatuses` and expose discard action for `in_progress` samples in the manager samples workspace
- **UI** (`sample-detail-panel.tsx`): Only show rejection banner for `in_progress` and `discarded` statuses
- **Backfill**: One-time SQL to clear stale rejection data on `completed` and `review` samples
- **Tests**: Add targeted regression coverage for backfill, approval guard, rejection banner guard, and manager discard UI exposure

## Impact

- Affected specs: `sample-management`
- Affected code:
  - `supabase/migrations/118_analyst_esignature_submissions.sql` → new migration 119
  - `src/app/actions/results.ts` (approveResults, cancelApproval)
  - `src/app/actions/sample-approvals.ts` (discardSample)
  - `src/components/sample-list-table.tsx` (manager discard button exposure)
  - `src/components/approval-actions.tsx` (confirm review-only discard UI remains intentional)
  - `src/components/sample-detail-panel.tsx`
  - `src/app/actions/*.test.ts` and `src/components/__tests__/*.test.tsx`
  - Search index trigger in `069_add_search_to_samples.sql` (auto-cleared via data update)
