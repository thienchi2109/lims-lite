# Worker 2 Spec Reviewer Prompt

You are reviewing Task 2 for spec compliance.

## What Was Requested

Task 2 owns only:
- `src/app/actions/results.ts`
- matching tests under `src/app/actions/*.test.ts`

Required outcomes:
1. `approveResults()` must reject non-`review` samples before mutating results.
2. The rejection path must return: `Can only approve results for samples under review`.
3. `approveResults()` must still work for valid `review` samples.
4. When approval transitions the sample to `completed`, it must clear `rejection_reason`, `rejected_at`, and `rejected_by`.
5. `cancelApproval()` must clear the same rejection fields when it moves the sample back to `in_progress`.
6. This task must not absorb discard-flow or UI work from Task 3.

## What Implementer Claims They Built

`IMPLEMENTER_REPORT`

## Critical Review Instructions

Do not trust the report. Read the changed action code and tests directly.

Verify specifically:
- the sample-status guard happens before result mutation
- the error text matches the requested behavior
- tests prove no mutation on the rejected path
- completion logic clears all three rejection fields
- cancel-approval logic clears all three rejection fields
- no extra workflow bypass was added

## Report Format

- `✅ Spec compliant` if everything matches after code inspection
- `❌ Issues found:` with precise file references and the missing/extra behavior
