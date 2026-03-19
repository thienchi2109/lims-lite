# Worker 3 Implementer Prompt

You are implementing Task 3: regression coverage and integration polish for OpenSpec change `update-samples-default-active-scope`.

## Task Description

Own this write scope only:
- targeted tests under `src/components/__tests__/*.test.tsx`
- targeted tests under `src/lib/data/*.test.ts`
- `src/components/samples-page-client.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- `src/lib/data/samples.ts`

You are not alone in the codebase. Do not revert unrelated edits, and do not expand your write scope without asking first.

Deliver exactly this work:
1. Add focused regression coverage for the end-to-end contract:
   - default `/samples` excludes `completed`
   - `scope=all` restores the full dataset
   - `status=completed` overrides active scope
   - refresh/share/bookmark/reset behavior remains stable through URL state
2. Add only the minimal production refactors needed to make those tests robust.
3. Verify the remembered-scope behavior when a concrete `status` filter temporarily overrides it.
4. Do not redesign the toolbar or rework the query contract beyond what the tests require.

## Context

- The current repo has little direct coverage around the `/samples` filter-state flow, which is why this task exists separately.
- Task 1 and Task 2 should already have landed the main behavior. Treat this task as integration-grade regression proof plus minimal polish, not a second feature-design pass.
- Avoid broad new test harnesses unless the existing patterns truly cannot express the required cases.

## Acceptance Criteria

- Targeted tests cover the four contract behaviors above.
- Tests prove explicit `status` overrides active scope without destroying remembered `scope`.
- The production refactors stay minimal and directly justified by the tests.
- No unrelated UI redesign or query-contract drift is introduced.

## Before You Begin

If you need a new helper or test seam outside the listed files, ask before widening scope.

## Your Job

1. Implement only the task above.
2. Run the targeted tests you add.
3. Commit your work.
4. Self-review for correctness, scope discipline, and regression-test quality.
5. Report back.

## Report Format

- What you changed
- Tests added and results
- Files changed
- Self-review findings
- Open questions or risks
