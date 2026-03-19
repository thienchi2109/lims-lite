# Worker 1 Implementer Prompt

You are implementing Task 1: URL/query contract and server filtering for OpenSpec change `update-samples-default-active-scope`.

## Task Description

Own this write scope only:
- `src/types/lab.ts`
- `src/components/samples-page-client.tsx`
- `src/lib/data/samples.ts`
- focused regression coverage under `src/lib/data/*.test.ts` or `src/components/__tests__/*.test.tsx` only if needed for this task

You are not alone in the codebase. Do not revert unrelated edits, and do not expand your write scope without asking first.

Deliver exactly this work:
1. Extend the sample list contract to support `scope='active' | 'all'`.
2. Treat a missing `scope` as the default active behavior in the `/samples` route contract.
3. Preserve the existing explicit `status` filter semantics, including `status=completed`.
4. Apply `status != 'completed'` only when scope resolves to `active` and no explicit `status` filter is selected.
5. Preserve existing search, receiver, specialty, sorting, and pagination behavior.

## Context

- `src/components/samples-page-client.tsx` currently treats a missing `status` as "all statuses".
- `src/lib/data/samples.ts` currently adds a status predicate only when `validatedParams.status` is present.
- `src/lib/api-client.ts`, `src/app/actions/samples.ts`, `src/hooks/use-samples.ts`, and `src/types/query-keys.ts` are relevant context, but they are not part of this task's write scope unless you hit a real blocker and ask first.
- Do not add toolbar controls, badges, or reset-flow UX in this task. That belongs to Task 2.

## Acceptance Criteria

- The typed sample-list contract accepts `scope=active|all`.
- Missing `scope` behaves as active, not all.
- `scope=all` does not exclude `completed`.
- A concrete `status` filter still overrides scope.
- No pseudo-status such as `not_completed` is introduced.

## Before You Begin

If you need to extract a tiny helper to make the precedence logic testable, keep it adjacent to the owned files and ask before widening beyond the listed test-file patterns.

## Your Job

1. Implement only the task above.
2. Run targeted verification for the changed contract and query behavior.
3. Commit your work.
4. Self-review for correctness, scope discipline, and regression risk.
5. Report back.

## Report Format

- What you changed
- How you verified it
- Files changed
- Self-review findings
- Open questions or risks
