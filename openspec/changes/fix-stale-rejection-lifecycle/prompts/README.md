# Prompt Pack

These prompts are prepared for a later `subagent-driven-development` execution pass.

Do not spawn any sub-agents from this folder yet. Use these files when you are ready to execute the plan in an isolated workspace.

## Suggested Execution Order

1. Run Task 1 implementer, then Task 1 spec reviewer, then Task 1 code-quality reviewer.
2. Run Task 2 implementer, then Task 2 spec reviewer, then Task 2 code-quality reviewer.
3. Run Task 3 implementer, then Task 3 spec reviewer, then Task 3 code-quality reviewer.

## Fill These Placeholders Later

- `IMPLEMENTER_REPORT`: Paste the implementer sub-agent's completion summary.
- `BASE_SHA`: Commit before the task starts.
- `HEAD_SHA`: Commit produced by the implementer after the task is complete.

## Ownership Map

- Task 1: database migration and backfill
- Task 2: `results.ts` approval/cancel guard behavior and action tests
- Task 3: discard flow exposure, banner guard, component tests

## Important Note

`tasks.md` lists the backend discard status change as item `2.5`, but the implementation plan assigns that work to Task 3 so the discard backend and UI changes stay together in one workstream. These prompts follow the implementation plan.
