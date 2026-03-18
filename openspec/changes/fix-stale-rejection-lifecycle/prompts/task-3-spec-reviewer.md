# Worker 3 Spec Reviewer Prompt

You are reviewing Task 3 for spec compliance.

## What Was Requested

Task 3 owns only:
- `src/app/actions/sample-approvals.ts`
- `src/components/sample-detail-panel.tsx`
- `src/components/sample-list-table.tsx`
- matching tests under `src/components/__tests__/*.test.tsx`

Required outcomes:
1. `discardSample()` must accept `in_progress`.
2. The unified manager samples workspace must expose discard for `in_progress` samples.
3. `sample-detail-panel.tsx` must show the rejection banner only for `in_progress` and `discarded`.
4. The review-page discard behavior must remain intentionally unchanged.
5. Tests must cover banner visibility by status and discard visibility for `in_progress` in the samples workspace.

## What Implementer Claims They Built

`IMPLEMENTER_REPORT`

## Critical Review Instructions

Do not trust the report. Read the changed code and tests directly.

Verify specifically:
- the backend discard-status list includes `in_progress`
- the samples-workspace row actions expose discard for `in_progress`
- the banner guard does not still show for `review` or `completed`
- the implementer did not quietly change review-page behavior
- tests actually cover the intended states instead of only mocked happy paths

## Report Format

- `✅ Spec compliant` if everything matches after code inspection
- `❌ Issues found:` with precise file references and the missing/extra behavior
