# Worker 3 Implementer Prompt

You are implementing Task 3: discard flow exposure and rejection-banner guard for OpenSpec change `fix-stale-rejection-lifecycle`.

## Task Description

Own this write scope only:
- `src/app/actions/sample-approvals.ts`
- `src/components/sample-detail-panel.tsx`
- `src/components/sample-list-table.tsx`
- matching tests under `src/components/__tests__/*.test.tsx`

You are not alone in the codebase. Do not revert unrelated edits, and do not expand your write scope without asking first.

Deliver exactly this work:
1. Add `in_progress` to backend discardable statuses in `discardSample()`.
2. Write failing component coverage for rejection-banner visibility by status.
3. Guard the banner in `sample-detail-panel.tsx` so it only renders for `in_progress` and `discarded`.
4. Write failing manager samples workspace coverage for the discard action on `in_progress` samples.
5. Expose the discard action for `in_progress` samples in the unified manager samples workspace.
6. Preserve review-page discard behavior as-is; do not broaden or redesign the review-page action surface.

## Context

- This task intentionally owns the backend discard-status change even though `tasks.md` labels it `2.5`; the implementation plan keeps discard backend and discard UI in one workstream.
- Root bug: after rejection, a sample returns to `in_progress`, but the manager currently cannot discard it from the main samples workspace.
- Secondary bug: stale rejection metadata should not show a rejection banner on `review` or `completed` samples.
- `approval-actions.tsx` is relevant context for preserving the review-page behavior, but do not change it unless you discover a real blocker and ask first.

## Acceptance Criteria

- `discardSample()` accepts `in_progress`.
- The manager samples workspace exposes discard for `in_progress` without breaking existing permission checks.
- `sample-detail-panel.tsx` only shows the rejection banner for `in_progress` and `discarded`.
- Component tests cover visible and hidden banner cases.
- Workspace tests cover discard visibility on `in_progress`.

## Before You Begin

If the current tests live outside `src/components/__tests__`, ask before widening the test-file scope.

## Your Job

1. Implement only the task above.
2. Run targeted component tests for banner and discard visibility.
3. Commit your work.
4. Self-review for correctness, scope discipline, and UI regression risk.
5. Report back.

## Report Format

- What you changed
- Tests added and results
- Files changed
- Self-review findings
- Open questions or risks
