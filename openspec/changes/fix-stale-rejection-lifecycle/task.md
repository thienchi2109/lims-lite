# Fix Sample Rejection Data Lifecycle Bugs

OpenSpec: `openspec/changes/fix-stale-rejection-lifecycle/`

## Migration 119
- [ ] Update `submit_sample_for_review` RPC Phase 5 — clear rejection fields
- [ ] Backfill: clear stale rejection data on `completed` + `review` samples
- [ ] Self-verification DO block

## Backend (TypeScript)
- [ ] `approveResults()` — add `sample.status = 'review'` guard
- [ ] `approveResults()` — clear rejection fields when setting `completed`
- [ ] `cancelApproval()` — clear rejection fields (defense-in-depth)
- [ ] `discardSample()` — add `'in_progress'` to `discardableStatuses`

## UI
- [ ] `sample-detail-panel.tsx` — guard banner to `in_progress` + `discarded` only

## Verification
- [ ] `npm run typecheck`
- [ ] Apply migration + run `run_security_tests()` (when Docker available)
- [ ] Manual test: reject → re-submit → approve → no banner
