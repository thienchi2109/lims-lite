# Worker 2 Code-Quality Reviewer Prompt

Run this only after Task 2 has passed spec compliance review.

Use the project code-review workflow and review the Task 2 diff as an action-layer safety review.

## Inputs To Fill Before Dispatch

- `WHAT_WAS_IMPLEMENTED`: `IMPLEMENTER_REPORT`
- `PLAN_OR_REQUIREMENTS`: Task 2 from `openspec/changes/fix-stale-rejection-lifecycle/implementation_plan.md`
- `BASE_SHA`: `BASE_SHA`
- `HEAD_SHA`: `HEAD_SHA`
- `DESCRIPTION`: `Task 2 - results approval and cancel-approval backend guards`

## Focus Areas

- Mutation ordering and fail-fast behavior
- Regression-test quality
- Error handling and consistency with existing action patterns
- Scope discipline
- Readability and maintainability of the guard logic
- Avoidance of workflow bypass or accidental behavioral drift

## Expected Output

- Strengths
- Issues by severity
- Overall assessment
