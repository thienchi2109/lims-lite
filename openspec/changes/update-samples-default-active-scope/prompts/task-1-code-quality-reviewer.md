# Worker 1 Code-Quality Reviewer Prompt

Run this only after Task 1 has passed spec compliance review.

Use the project code-review workflow and review the Task 1 diff as a query-contract and server-filter safety review.

## Inputs To Fill Before Dispatch

- `WHAT_WAS_IMPLEMENTED`: `IMPLEMENTER_REPORT`
- `PLAN_OR_REQUIREMENTS`: Task 1 from `openspec/changes/update-samples-default-active-scope/implementation_plan.md`
- `BASE_SHA`: `BASE_SHA`
- `HEAD_SHA`: `HEAD_SHA`
- `DESCRIPTION`: `Task 1 - URL/query contract and server filtering`

## Focus Areas

- Clarity of the default active-scope semantics
- Precedence logic between `scope` and `status`
- Query correctness and avoidance of accidental over-filtering
- Regression-test quality
- Scope discipline
- Avoidance of duplicated parsing or brittle branching

## Expected Output

- Strengths
- Issues by severity
- Overall assessment
