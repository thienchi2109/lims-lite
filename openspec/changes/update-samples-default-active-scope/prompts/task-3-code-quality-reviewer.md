# Worker 3 Code-Quality Reviewer Prompt

Run this only after Task 3 has passed spec compliance review.

Use the project code-review workflow and review the Task 3 diff as a regression-test and integration-polish review.

## Inputs To Fill Before Dispatch

- `WHAT_WAS_IMPLEMENTED`: `IMPLEMENTER_REPORT`
- `PLAN_OR_REQUIREMENTS`: Task 3 from `openspec/changes/update-samples-default-active-scope/implementation_plan.md`
- `BASE_SHA`: `BASE_SHA`
- `HEAD_SHA`: `HEAD_SHA`
- `DESCRIPTION`: `Task 3 - regression coverage and integration polish for default active scope`

## Focus Areas

- Test signal versus brittleness
- Whether the coverage actually proves the required URL-state contract
- Minimality of any supporting production refactors
- Scope discipline
- Readability and maintainability of the added test seams
- Avoidance of over-mocking or duplicated assertions

## Expected Output

- Strengths
- Issues by severity
- Overall assessment
