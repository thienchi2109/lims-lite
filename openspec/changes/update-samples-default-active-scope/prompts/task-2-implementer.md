# Worker 2 Implementer Prompt

You are implementing Task 2: samples workspace scope UX and reset behavior for OpenSpec change `update-samples-default-active-scope`.

## Task Description

Own this write scope only:
- `src/components/sample-filters/index.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- focused regression coverage under `src/components/__tests__/*.test.tsx` or `src/components/sample-filters/*.test.tsx`

You are not alone in the codebase. Do not revert unrelated edits, and do not expand your write scope without asking first.

Deliver exactly this work:
1. Add `scope` state and URL handlers with values `active | all`, where missing `scope` means the default active behavior.
2. Add a visible `Hiển thị tất cả` control in the main samples toolbar, backed by `scope=all`.
3. Keep the control visible even while a concrete `status` filter is selected; explicit `status` still overrides scope, but the remembered `scope` must stay in URL state.
4. Add a clear active-scope indication in the active-filter row when completed samples are hidden by default.
5. Make reset clear explicit filters and remove `scope` so the workspace returns to the implicit active default while preserving sort and page size.

## Context

- `use-filter-params.ts` currently tracks `status`, dates, receiver, and specialty IDs, but not list scope.
- `ActiveFilterBadges.tsx` currently renders nothing when there are no explicit filters. This task may need it to communicate the implicit active default.
- Do not move scope into the advanced filter popover. The scope control belongs in the visible toolbar.
- Do not rewrite the server query logic in this task. That belongs to Task 1.

## Acceptance Criteria

- The toolbar visibly exposes `Hiển thị tất cả`.
- The control is URL-backed and survives refresh/share/bookmark usage.
- The active-scope hint appears only when active scope is actually effective.
- Clearing filters removes `scope` and returns the workspace to the default active behavior.
- No pseudo-status or duplicate scope control is introduced.

## Before You Begin

If the existing test surface does not give you a clean place to add coverage for the toolbar and reset behavior, ask before introducing a wider component-test pattern.

## Your Job

1. Implement only the task above.
2. Run targeted UI or hook-level verification for the changed scope UX and reset behavior.
3. Commit your work.
4. Self-review for correctness, scope discipline, and UX regression risk.
5. Report back.

## Report Format

- What you changed
- Tests added and results
- Files changed
- Self-review findings
- Open questions or risks
