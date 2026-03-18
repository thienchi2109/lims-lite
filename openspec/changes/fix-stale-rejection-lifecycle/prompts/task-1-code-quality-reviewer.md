# Worker 1 Code-Quality Reviewer Prompt

Run this only after Task 1 has passed spec compliance review.

Use the project code-review workflow and review the Task 1 diff as a migration-safety review.

## Inputs To Fill Before Dispatch

- `WHAT_WAS_IMPLEMENTED`: `IMPLEMENTER_REPORT`
- `PLAN_OR_REQUIREMENTS`: Task 1 from `openspec/changes/fix-stale-rejection-lifecycle/implementation_plan.md`
- `BASE_SHA`: `BASE_SHA`
- `HEAD_SHA`: `HEAD_SHA`
- `DESCRIPTION`: `Task 1 - database migration and backfill for stale rejection lifecycle`

## Focus Areas

- Migration safety and reversibility assumptions
- Backfill correctness and status targeting
- Verification-block quality and failure behavior
- Scope discipline
- Clarity of SQL structure and comments
- Avoidance of unnecessary schema, policy, or trigger changes

## Expected Output

- Strengths
- Issues by severity
- Overall assessment
