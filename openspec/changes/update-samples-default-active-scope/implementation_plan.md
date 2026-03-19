# Update Samples Default Active Scope Implementation Plan

The `/samples` workspace currently treats a missing `status` query param as "all statuses" in the client route parser and only applies a status predicate server-side when `status` is explicitly present. This means the default `/samples` view currently includes `completed` rows.

> [!IMPORTANT]
> This implementation plan resolves proposal ambiguities against the current codebase before any `subagent-driven-development` execution pass.

## Current-State Review Notes

- `src/components/samples-page-client.tsx` parses `status` from the URL and turns missing or `all` into `undefined`, which currently means "fetch everything".
- `src/components/sample-filters/use-filter-params.ts` only tracks explicit filters such as `status`, dates, receiver, and specialty IDs. It has no concept of list scope today.
- `src/lib/data/samples.ts` only adds `query.eq('status', ...)` when `validatedParams.status` is present. There is no default exclusion for `completed`.
- `src/components/sample-filters/ActiveFilterBadges.tsx` currently renders nothing when there are no explicit filters, so it cannot yet communicate an implicit active-scope default.
- I could not find direct automated coverage around this `/samples` filter-state flow, so this change needs explicit regression coverage rather than manual verification only.

## Resolved Execution Decisions

1. Use a separate `scope` contract with `active | all`.
   - Missing `scope` means the workspace default is `active`.
   - `scope=all` opts into the full dataset.
2. Keep `status` as the only real status filter.
   - Never introduce a pseudo-status such as `not_completed`.
   - A concrete `status` filter overrides `scope`.
3. Keep `Hiển thị tất cả` in the visible toolbar.
   - It is a top-level dataset mode, not an advanced popover filter.
   - Keep the control visible even while a concrete `status` filter is selected so the remembered `scope` survives URL state.
4. Show the active-scope hint in the active-filter row.
   - Only show the hint when active scope is actually in effect, meaning `scope` resolves to `active` and no concrete `status` filter is selected.
   - Do not add a second scope control inside the advanced filter popover.
5. Reset behavior returns to the implicit default.
   - Clear `scope`, `status`, search, dates, receiver, specialty IDs, and pagination.
   - Preserve sort and page size, following the current filter reset pattern.

## Proposed Changes

### Task 1: URL/query contract and server filtering

**Owner**
- Worker 1

**Write scope**
- `src/types/lab.ts`
- `src/components/samples-page-client.tsx`
- `src/lib/data/samples.ts`
- focused regression coverage under `src/lib/data/*.test.ts` or `src/components/__tests__/*.test.tsx` only if needed for this task

**Goal**
- Extend the sample list contract to accept `scope=active|all`
- Treat missing `scope` as the active default
- Apply `status != 'completed'` only when scope resolves to `active` and no explicit `status` filter is selected
- Preserve existing search, receiver, specialty, sorting, and pagination behavior

**Verification**
- Coverage or direct assertions prove missing `scope` behaves as active
- Coverage or direct assertions prove `scope=all` does not exclude `completed`
- Coverage or direct assertions prove `status=completed` still wins over `scope=active`

### Task 2: Samples workspace scope UX and reset behavior

**Owner**
- Worker 2

**Write scope**
- `src/components/sample-filters/index.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- focused regression coverage under `src/components/__tests__/*.test.tsx` or `src/components/sample-filters/*.test.tsx`

**Goal**
- Add `scope` to filter state and URL handlers
- Add a visible `Hiển thị tất cả` toolbar control backed by `scope=all`
- Keep the control visible while explicit status filters are active
- Add a clear active-scope hint in the active-filter row when completed samples are hidden by default
- Make reset return to the implicit active default by removing `scope`

**Verification**
- UI coverage proves the toolbar exposes `Hiển thị tất cả`
- UI coverage proves the active-scope hint appears only when active scope is effective
- URL/reset coverage proves clearing filters removes `scope` and returns to the default active behavior

### Task 3: Regression coverage and integration polish

**Owner**
- Worker 3

**Write scope**
- targeted tests under `src/components/__tests__/*.test.tsx`
- targeted tests under `src/lib/data/*.test.ts`
- `src/components/samples-page-client.tsx`
- `src/components/sample-filters/use-filter-params.ts`
- `src/components/sample-filters/ActiveFilterBadges.tsx`
- `src/lib/data/samples.ts`

**Goal**
- Add focused regression coverage for the complete user-visible contract:
  - default `/samples` excludes `completed`
  - `scope=all` restores the full dataset
  - `status=completed` overrides active scope
  - refresh/share/bookmark/reset behavior remains URL-stable
- Make only the minimal production refactors needed to keep those tests robust

**Verification**
- Targeted tests cover all four contract behaviors above
- Tests prove remembered `scope` is preserved through explicit status overrides
- No unrelated UI redesign or query-contract drift is introduced

## Context-Only Files

These files are part of the runtime path but should not change unless a task finds a concrete blocker and asks first:

- `src/lib/api-client.ts`
- `src/app/actions/samples.ts`
- `src/hooks/use-samples.ts`
- `src/types/query-keys.ts`

They already pass `SampleListParams` through generically, so they are context surfaces first, not planned write targets.
