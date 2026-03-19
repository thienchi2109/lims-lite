# Worker 2 Code-Quality Reviewer Prompt

Run this only after Task 2 has passed spec compliance review.

Use the project code-review workflow and review the Task 2 diff as a URL-state and filter-UX review.

## Inputs To Fill Before Dispatch

- `WHAT_WAS_IMPLEMENTED`: `IMPLEMENTER_REPORT`
- `PLAN_OR_REQUIREMENTS`: Task 2 from `openspec/changes/update-samples-default-active-scope/implementation_plan.md`
- `BASE_SHA`: `BASE_SHA`
- `HEAD_SHA`: `HEAD_SHA`
- `DESCRIPTION`: `Task 2 - samples workspace scope UX and reset behavior`

## Focus Areas

- URL-state consistency and avoidance of stale UI state
- Clarity of the visible scope control and helper messaging
- Reset behavior correctness
- Regression-test quality
- Scope discipline
- Avoidance of duplicated state derivation across toolbar and badge rows

## Expected Output

- Strengths
- Issues by severity
- Overall assessment
