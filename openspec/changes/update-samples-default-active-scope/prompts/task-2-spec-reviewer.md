# Worker 2 Spec Reviewer Prompt

You are reviewing Task 2 for spec compliance.

## What Was Requested

Task 2 owns only:
- `src/components/sample-filters/index.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- focused regression coverage under `src/components/__tests__/*.test.tsx` or `src/components/sample-filters/*.test.tsx`

Required outcomes:
1. Filter state and URL handlers must support `scope=active|all`, with missing `scope` treated as active.
2. The main samples toolbar must expose `Hiển thị tất cả`.
3. Explicit `status` filters must still override scope while remembered `scope` remains URL-stable.
4. The workspace must clearly indicate when completed samples are hidden by default.
5. Reset must remove explicit filters and `scope`, returning the workspace to the implicit active default.
6. This task must not move scope into the advanced filter popover or rewrite Task 1 server-query behavior.

## What Implementer Claims They Built

`IMPLEMENTER_REPORT`

## Critical Review Instructions

Do not trust the report. Read the changed UI, state, and tests directly.

Verify specifically:
- `scope` really exists in the URL/filter-state flow
- the toolbar really exposes `Hiển thị tất cả`
- the control stays visible while a concrete `status` filter is active
- the active-scope hint appears only when active scope is actually in effect
- reset removes `scope` and returns to the default active behavior
- the implementer did not smuggle scope into the popover or rewrite query behavior from Task 1

## Report Format

- `✅ Spec compliant` if everything matches after code inspection
- `❌ Issues found:` with precise file references and the missing/extra behavior
