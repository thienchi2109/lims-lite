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

- Task 1: URL/query contract and server filtering
- Task 2: samples workspace scope UX and reset behavior
- Task 3: regression coverage and integration polish

## Important Note

This change did not have a checked-in `implementation_plan.md` when the prompt pack was created. The new `implementation_plan.md` in this folder resolves the proposal's open UX question against the actual `/samples` implementation and adds the missing regression-coverage strategy. Use that plan as the execution source of truth, not the proposal alone.
