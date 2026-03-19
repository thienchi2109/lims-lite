# Worker 1 Spec Reviewer Prompt

You are reviewing Task 1 for spec compliance.

## What Was Requested

Task 1 owns only:
- `src/types/lab.ts`
- `src/components/samples-page-client.tsx`
- `src/lib/data/samples.ts`
- focused regression coverage under `src/lib/data/*.test.ts` or `src/components/__tests__/*.test.tsx` only if needed for this task

Required outcomes:
1. The sample-list contract must support `scope=active|all`.
2. Missing `scope` must resolve to the default active behavior.
3. `scope=all` must allow the full dataset, including `completed`.
4. A concrete `status` filter such as `status=completed` must override scope.
5. The server query must exclude `completed` only when scope resolves to `active` and no explicit `status` filter is selected.
6. This task must not absorb toolbar, badge, or reset UX work from Task 2.

## What Implementer Claims They Built

`IMPLEMENTER_REPORT`

## Critical Review Instructions

Do not trust the report. Read the changed code and any tests directly.

Verify specifically:
- the typed contract really accepts `scope=active|all`
- missing `scope` really resolves to active in the route/query flow
- `scope=all` does not still exclude `completed`
- explicit `status` filters still win over scope
- the completed-sample exclusion is not applied in the wrong cases
- no UI-work spillover from Task 2 was added

## Report Format

- `✅ Spec compliant` if everything matches after code inspection
- `❌ Issues found:` with precise file references and the missing/extra behavior
