# Worker 3 Code-Quality Reviewer Prompt

Run this only after Task 3 has passed spec compliance review.

Use the project code-review workflow and review the Task 3 diff as a UI-and-action regression review.

## Inputs To Fill Before Dispatch

- `WHAT_WAS_IMPLEMENTED`: `IMPLEMENTER_REPORT`
- `PLAN_OR_REQUIREMENTS`: Task 3 from `openspec/changes/fix-stale-rejection-lifecycle/implementation_plan.md`
- `BASE_SHA`: `BASE_SHA`
- `HEAD_SHA`: `HEAD_SHA`
- `DESCRIPTION`: `Task 3 - discard flow exposure and rejection-banner guard`

## Focus Areas

- Status-gating correctness across backend and UI
- Permission handling in row actions
- Test quality for visible versus hidden UI states
- Scope discipline
- Avoidance of duplicated or brittle status checks where a small cleanup would help
- Avoidance of unintended review-page behavior drift

## Expected Output

- Strengths
- Issues by severity
- Overall assessment
