## 1. Backend — Server Action (TDD)
- [ ] 1.1 Write failing test for `getRejectedSamplesCount` (role guard, correct count, analyst-scoped, excludes soft-deleted)
- [ ] 1.2 Implement `getRejectedSamplesCount` in `sample-approvals.ts` (filter: `status='in_progress' AND rejected_at IS NOT NULL AND received_by = auth.uid() AND deleted_at IS NULL`)
- [ ] 1.3 Wire into `types.ts` → `route.ts` → `api-client.ts`
- [ ] 1.4 Verify tests pass

## 2. Query Infrastructure (TDD)
- [ ] 2.1 Add `rejectionKeys` to `query-keys.ts`
- [ ] 2.2 Write failing test for `useRejectionCount` hook
- [ ] 2.3 Create `use-rejection-count.ts`, export from `hooks/index.ts`
- [ ] 2.4 Verify tests pass

## 2b. Cache Invalidation
- [ ] 2b.1 Add `rejectionKeys.count` invalidation to `reject-sample-dialog.tsx` (alongside `approvalKeys.count`)
- [ ] 2b.2 Add `rejectionKeys.count` invalidation to `assigned-tests-panel.tsx` (submit for review)
- [ ] 2b.3 Add `rejectionKeys.count` invalidation to `discard-sample-dialog.tsx`
- [ ] 2b.4 Write tests verifying invalidation calls in mutation flows

## 3. Shared UI — `DashboardAlertBanner` (TDD)
- [ ] 3.1 Write failing tests (renders when count > 0, hidden when 0, variant colors, link href)
- [ ] 3.2 Create `dashboard-alert-banner.tsx`
- [ ] 3.3 Verify tests pass

## 4. Analyst Dashboard — Client Component (TDD)
- [ ] 4.1 Write failing tests (rejection banner, badge on card, hides when 0)
- [ ] 4.2 Create `analyst-dashboard-client.tsx`, update `analyst/page.tsx`
- [ ] 4.3 Verify tests pass

## 5. Manager Dashboard — Alert Banner (TDD)
- [ ] 5.1 Write failing test (renders alert banner, hides when 0)
- [ ] 5.2 Update `manager-dashboard-client.tsx` with `DashboardAlertBanner`
- [ ] 5.3 Verify tests pass

## 6. Verification
- [ ] 6.1 `npm run typecheck` passes
- [ ] 6.2 Full test suite passes (`npx vitest run`)
- [ ] 6.3 Manual: reject → analyst sees banner + badge → re-submit → clears
- [ ] 6.4 Manual: manager sees enhanced alert banner for pending approvals
