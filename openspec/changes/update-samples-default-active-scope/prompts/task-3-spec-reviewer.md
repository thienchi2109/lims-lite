# Worker 3 Spec Reviewer Prompt

You are reviewing Task 3 for spec compliance.

## What Was Requested

Task 3 owns only:
- targeted tests under `src/components/__tests__/*.test.tsx`
- targeted tests under `src/lib/data/*.test.ts`
- `src/components/samples-page-client.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- `src/lib/data/samples.ts`

Required outcomes:
1. Regression coverage must prove the default `/samples` path excludes `completed`.
2. Regression coverage must prove `scope=all` restores the full dataset.
3. Regression coverage must prove a concrete `status` filter such as `status=completed` overrides active scope.
4. Regression coverage must prove refresh/share/bookmark/reset behavior stays URL-stable.
5. The task must not redesign the toolbar or move the query contract away from the approved `scope` + `status` model.

## What Implementer Claims They Built

`IMPLEMENTER_REPORT`

## Critical Review Instructions

Do not trust the report. Read the changed tests and any supporting production refactors directly.

Verify specifically:
- the tests really cover default active scope, `scope=all`, explicit status override, and reset/share/bookmark stability
- remembered `scope` is actually preserved when a concrete `status` temporarily overrides it
- the production refactors are minimal and tied directly to the testability need
- the implementer did not quietly redesign the UX or change the core contract

## Report Format

- `✅ Spec compliant` if everything matches after code inspection
- `❌ Issues found:` with precise file references and the missing/extra behavior
