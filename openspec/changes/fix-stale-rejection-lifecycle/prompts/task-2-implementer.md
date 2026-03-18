# Worker 2 Implementer Prompt

You are implementing Task 2: results approval and cancel-approval backend guards for OpenSpec change `fix-stale-rejection-lifecycle`.

## Task Description

Own this write scope only:
- `src/app/actions/results.ts`
- matching tests under `src/app/actions/*.test.ts`

You are not alone in the codebase. Do not revert unrelated edits, and do not expand your write scope without asking first.

Deliver exactly this work:
1. Write a failing regression test proving `approveResults()` must reject non-`review` samples before mutating result or sample state.
2. Add a `review`-only sample-status guard in `approveResults()`.
3. When `approveResults()` transitions a sample to `completed`, clear `rejection_reason`, `rejected_at`, and `rejected_by`.
4. In `cancelApproval()`, clear the same rejection fields when moving the sample back to `in_progress` as defense-in-depth.
5. Preserve existing approval behavior for valid `review` samples.

## Context

- Current bug: managers can approve results while the sample is still `in_progress`, bypassing the analyst `submitSampleForReview()` e-signature flow.
- `cancelApproval()` already reverts the sample to `in_progress`; this task only clears stale rejection data during that rollback.
- Rejection history is preserved in `audit_logs`, not by keeping old rejection metadata on the active row.
- Do not implement discard-flow changes here. That belongs to Task 3.

## Acceptance Criteria

- Guard failure returns the existing planned error message: `Can only approve results for samples under review`.
- On guard failure, no result-status mutation occurs.
- Valid `review` approvals still work.
- Completing a sample via approval clears all three rejection fields.
- `cancelApproval()` also clears all three rejection fields.

## Before You Begin

If the existing tests do not provide a clear place to add this regression coverage, ask before introducing a new test file pattern.

## Your Job

1. Implement only the task above.
2. Run targeted tests for the changed action behavior.
3. Commit your work.
4. Self-review for correctness, scope discipline, and regression risk.
5. Report back.

## Report Format

- What you changed
- Tests added and results
- Files changed
- Self-review findings
- Open questions or risks
