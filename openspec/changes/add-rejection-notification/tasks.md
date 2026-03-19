## 1. Backend — Server Action (TDD)
- [x] 1.1 Write failing test for `getRejectedSamplesCount` (role guard, correct count, analyst-scoped, excludes soft-deleted)
- [x] 1.2 Implement `getRejectedSamplesCount` in `sample-approvals.ts` (filter: `status='in_progress' AND rejected_at IS NOT NULL AND received_by = auth.uid() AND deleted_at IS NULL`)
- [x] 1.3 Wire into `types.ts` → `route.ts` → `api-client.ts`
- [x] 1.4 Verify tests pass

## 2. Query Infrastructure (TDD)
- [x] 2.1 Add `rejectionKeys` to `query-keys.ts`
- [x] 2.2 Write failing test for `useRejectionCount` hook
- [x] 2.3 Create `use-rejection-count.ts`, export from `hooks/index.ts`
- [x] 2.4 Verify tests pass

## 2b. Cache Invalidation
- [x] 2b.1 Add `rejectionKeys.count` invalidation to `reject-sample-dialog.tsx` (alongside `approvalKeys.count`)
- [x] 2b.2 Add `rejectionKeys.count` invalidation to `assigned-tests-panel.tsx` (submit for review)
- [x] 2b.3 Add `rejectionKeys.count` invalidation to `discard-sample-dialog.tsx`
- [x] 2b.4 Write tests verifying invalidation calls in mutation flows

## 3. Shared UI — `DashboardAlertBanner` (TDD)
- [x] 3.1 Write failing tests (renders when count > 0, hidden when 0, variant colors, link href)
- [x] 3.2 Create `dashboard-alert-banner.tsx`
- [x] 3.3 Verify tests pass

## 4. Analyst Dashboard — Client Component (TDD)
- [x] 4.1 Write failing tests (rejection banner, badge on card, hides when 0)
- [x] 4.2 Create `analyst-dashboard-client.tsx`, update `analyst/page.tsx`
- [x] 4.3 Verify tests pass

## 5. Manager Dashboard — Alert Banner (TDD)
- [x] 5.1 Write failing test (renders alert banner, hides when 0)
- [x] 5.2 Update `manager-dashboard-client.tsx` with `DashboardAlertBanner`
- [x] 5.3 Verify tests pass

## 6. Verification
- [x] 6.1 `npm run typecheck` passes
- [x] 6.2 Full test suite passes (`npx vitest run`)
- [ ] 6.3 Manual: reject → analyst sees banner + badge → re-submit → clears
- [ ] 6.4 Manual: manager sees enhanced alert banner for pending approvals

Manual verification remains pending because this environment has no Docker-backed app/database runtime for end-to-end dashboard interaction.
