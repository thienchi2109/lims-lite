## Why

After a manager rejects a sample, the analyst who accessioned it has **no proactive notification**. The analyst must manually navigate to the samples list and notice the status reverted to `in_progress`. This creates a UX gap where rejected samples can sit unattended, delaying the review-resubmit cycle.

The manager dashboard has a similar gap: the existing "Bạn có X mẫu đang chờ phê duyệt" message is plain text that is easy to overlook.

## What Changes

- **Server action `getRejectedSamplesCount()`**: Query-based count of rejected samples for the current analyst (`status='in_progress' AND rejected_at IS NOT NULL AND received_by = auth.uid() AND deleted_at IS NULL`)
- **API plumbing**: Wire through `ClientActionName` → `route.ts` → `api-client.ts`
- **TanStack Query hook `useRejectionCount()`**: Mirror `useApprovalCount()` pattern (30s stale, refetch on window focus)
- **Query keys**: Add `rejectionKeys` to centralized key factory
- **Shared `DashboardAlertBanner` component**: Reusable banner with `warning` (amber) and `error` (red/rose) variants, no dismiss button
- **Analyst dashboard**: Convert to client component, add rejection alert banner + badge count on "Danh sách mẫu" card
- **Manager dashboard**: Replace plain welcome text with prominent `DashboardAlertBanner` for pending approvals
- **Cache invalidation**: Add `rejectionKeys.count` invalidation alongside existing `approvalKeys.count` in `reject-sample-dialog.tsx`, `assigned-tests-panel.tsx` (submit for review), and `discard-sample-dialog.tsx`
- **Tests (TDD)**: Failing tests written first for each component (server action, hook, UI components)

## Design Decisions

- **No new database table**: Counts derived from existing `samples` table fields (`rejected_at`, `received_by`, `status`, `deleted_at`). This avoids migration complexity and keeps the system simple.
- **No dismiss button**: Banner stays visible until count reaches 0 (analyst re-submits or manager approves/rejects all). This ensures persistent awareness.
- **Analyst-scoped**: Only the analyst who accessioned the sample (`received_by = auth.uid()`) sees the rejection notification.

## Visual Design

See [design.md](design.md) for mockup screenshots of both dashboards (Stitch project: CDC LIMS - Dashboard Notification Mockups).

## Impact

- Affected specs: `sample-management`
- Affected code:
  - `src/app/actions/sample-approvals.ts` (new `getRejectedSamplesCount`)
  - `src/lib/client-actions/types.ts` (new action name)
  - `src/app/api/client-actions/route.ts` (new handler)
  - `src/lib/api-client.ts` (new client function)
  - `src/types/query-keys.ts` (new `rejectionKeys`)
  - `src/hooks/use-rejection-count.ts` [NEW]
  - `src/hooks/index.ts` (export)
  - `src/components/dashboard-alert-banner.tsx` [NEW]
  - `src/components/analyst-dashboard-client.tsx` [NEW]
  - `src/app/(dashboard)/analyst/page.tsx` (use client component)
  - `src/components/manager-dashboard-client.tsx` (use alert banner)
  - `src/components/reject-sample-dialog.tsx` (add `rejectionKeys.count` invalidation)
  - `src/components/assigned-tests-panel.tsx` (add `rejectionKeys.count` invalidation on submit)
  - `src/components/discard-sample-dialog.tsx` (add `rejectionKeys.count` invalidation)
  - Test files: `src/app/actions/__tests__/`, `src/hooks/__tests__/`, `src/components/__tests__/`
