# Update Samples Default Active Scope Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.
>
> **Implementation Rule:** Follow strict TDD for every behavior change. For each step: write the failing test, run it to confirm RED, write the minimal implementation, run it again to confirm GREEN, then refactor without changing behavior.

**Goal:** Make `/samples` default to an active scope that hides `completed` rows unless the user explicitly requests all samples or a concrete status.

**Architecture:** Keep the existing `/samples` contract URL-driven. Add a separate `scope=active|all` parameter, resolve missing `scope` to the implicit active default, apply the completed-row exclusion only in the server query layer, and surface the dataset mode in the visible toolbar plus active-filter row.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, TanStack Query, Supabase query builder, Zod.

---

## Current-State Review Notes

- `src/components/samples-page-client.tsx` currently treats a missing `status` as "fetch all statuses".
- `src/components/sample-filters/use-filter-params.ts` currently tracks `status`, dates, receiver, and specialty IDs, but not list scope.
- `src/lib/data/samples.ts` only applies a status predicate when `validatedParams.status` is present, so default `/samples` still includes `completed`.
- `src/components/sample-filters/ActiveFilterBadges.tsx` currently renders nothing when there are no explicit filters, so it cannot yet explain an implicit active default.
- `src/lib/api-client.ts`, `src/app/actions/samples.ts`, `src/hooks/use-samples.ts`, and `src/types/query-keys.ts` already pass `SampleListParams` through generically and should stay context-only unless a blocker appears.

## Resolved Decisions

1. Use a separate `scope` contract with `active | all`.
2. Treat missing `scope` as the implicit active default.
3. Keep `status` reserved for real domain statuses.
4. A concrete `status` filter overrides scope for the actual query result.
5. Keep `Hiển thị tất cả` in the visible toolbar, not the advanced filter popover.
6. Keep the scope control visible and URL-backed while explicit `status` is selected so the remembered scope survives URL state.
7. Show the active-scope hint in the active-filter row when active scope is actually effective.
8. Reset removes `scope` and returns the workspace to the implicit active default while preserving sort and page size.

## TDD Execution Plan

### Task 1: URL/query contract and server filtering

**Files:**
- Modify: `src/types/lab.ts`
- Modify: `src/components/samples-page-client.tsx`
- Modify: `src/lib/data/samples.ts`
- Test: `src/lib/data/samples.test.ts`
- Test: `src/components/__tests__/samples-page-client-scope.test.tsx`

**Step 1: Write the failing tests**

- In `src/lib/data/samples.test.ts`, add focused tests for:
  - missing `scope` resolves to the active default
  - `scope=all` does not exclude `completed`
  - `status=completed` overrides `scope=active`
- In `src/components/__tests__/samples-page-client-scope.test.tsx`, add a focused test that proves `SamplesPageClient` passes the parsed `scope` and `status` contract into `useSamples`.

**Step 2: Run the tests to verify RED**

Run:

```bash
npm run test:run -- src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx
```

Expected:
- FAIL because `scope` is not yet part of the typed contract
- FAIL because default `/samples` still behaves like "all statuses"

**Step 3: Write the minimal implementation**

- Add `scope: z.enum(['active', 'all']).optional()` to `SampleListParamsSchema` in `src/types/lab.ts`.
- Parse `scope` in `src/components/samples-page-client.tsx`, resolving missing or invalid values to `undefined` at the transport boundary while still treating missing scope as active behavior.
- Update `src/lib/data/samples.ts` so:
  - explicit `status` still uses `query.eq('status', validatedParams.status)`
  - otherwise, resolved active scope applies `query.neq('status', 'completed')`
  - `scope=all` leaves status unfiltered

**Step 4: Run the tests to verify GREEN**

Run:

```bash
npm run test:run -- src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx
```

Expected:
- PASS for all new Task 1 tests

**Step 5: Refactor**

- If the precedence logic is getting duplicated, extract a tiny helper adjacent to the current code.
- Keep the helper inside the owned files for this task.
- Re-run the Task 1 test command after the refactor.

**Step 6: Commit**

```bash
git add src/types/lab.ts src/components/samples-page-client.tsx src/lib/data/samples.ts src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx
git commit -m "feat: add active sample scope contract"
```

### Task 2: Samples workspace scope UX and reset behavior

**Files:**
- Modify: `src/components/sample-filters/index.tsx`
- Modify: `src/components/sample-filters/use-filter-params.ts`
- Modify: `src/components/sample-filters/ActiveFilterBadges.tsx`
- Test: `src/components/sample-filters/use-filter-params.test.tsx`
- Test: `src/components/__tests__/sample-filters-scope.test.tsx`

**Step 1: Write the failing tests**

- In `src/components/sample-filters/use-filter-params.test.tsx`, add focused tests for:
  - `scope` round-trips through URL state
  - reset removes `scope`, `status`, search, dates, receiver, and specialty IDs
  - reset preserves `sortBy`, `sortOrder`, and `pageSize`
- In `src/components/__tests__/sample-filters-scope.test.tsx`, add focused tests for:
  - the toolbar shows `Hiển thị tất cả`
  - the scope control stays visible while a concrete `status` filter is active
  - the active-scope hint appears only when active scope is actually effective

**Step 2: Run the tests to verify RED**

Run:

```bash
npm run test:run -- src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
```

Expected:
- FAIL because there is no scope state yet
- FAIL because the toolbar does not expose `Hiển thị tất cả`
- FAIL because the active-filter row cannot show the hidden-completed hint

**Step 3: Write the minimal implementation**

- In `src/components/sample-filters/use-filter-params.ts`:
  - add `scope` to filter state
  - add a handler for changing scope
  - update reset logic to delete `scope`
  - preserve `sortBy`, `sortOrder`, and `pageSize`
- In `src/components/sample-filters/index.tsx`:
  - add the visible `Hiển thị tất cả` control in the toolbar
  - keep it visible even while `status` is concrete
- In `src/components/sample-filters/ActiveFilterBadges.tsx`:
  - render the active-scope hint only when active scope is effective

**Step 4: Run the tests to verify GREEN**

Run:

```bash
npm run test:run -- src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
```

Expected:
- PASS for all new Task 2 tests

**Step 5: Refactor**

- Remove duplicated `scope` checks between the toolbar and badge row if a tiny shared helper improves clarity.
- Do not move scope into the advanced filter popover.
- Re-run the Task 2 test command after the refactor.

**Step 6: Commit**

```bash
git add src/components/sample-filters/index.tsx src/components/sample-filters/use-filter-params.ts src/components/sample-filters/ActiveFilterBadges.tsx src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
git commit -m "feat: add samples scope toolbar flow"
```

### Task 3: Regression coverage and integration polish

**Files:**
- Modify: `src/components/samples-page-client.tsx`
- Modify: `src/components/sample-filters/use-filter-params.ts`
- Modify: `src/components/sample-filters/ActiveFilterBadges.tsx`
- Modify: `src/lib/data/samples.ts`
- Modify: `src/lib/data/samples.test.ts`
- Modify: `src/components/__tests__/samples-page-client-scope.test.tsx`
- Modify: `src/components/sample-filters/use-filter-params.test.tsx`
- Modify: `src/components/__tests__/sample-filters-scope.test.tsx`

**Step 1: Write the failing integration-grade tests**

- Extend the existing test files from Tasks 1 and 2 to prove the full contract:
  - default `/samples` excludes `completed`
  - `scope=all` restores the full dataset
  - `status=completed` overrides active scope
  - remembered `scope` survives while `status` temporarily overrides it
  - clearing explicit `status` returns the workspace to the remembered scope
  - refresh/share/bookmark/reset behavior stays URL-stable

**Step 2: Run the tests to verify RED**

Run:

```bash
npm run test:run -- src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
```

Expected:
- At least one integration behavior still FAILS because the earlier tasks only covered local contract pieces

**Step 3: Write the minimal integration polish**

- Make only the smallest production changes needed to satisfy the new integration-grade tests.
- Keep the approved contract intact:
  - no pseudo-status
  - no hidden scope control
  - no redesign of the filter popover

**Step 4: Run the tests to verify GREEN**

Run:

```bash
npm run test:run -- src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
```

Expected:
- PASS for the full targeted suite

**Step 5: Refactor**

- Remove brittle assertions or duplicated setup in the new tests.
- Keep production refactors minimal and directly justified by the tests.
- Re-run the Task 3 test command after the refactor.

**Step 6: Commit**

```bash
git add src/components/samples-page-client.tsx src/components/sample-filters/use-filter-params.ts src/components/sample-filters/ActiveFilterBadges.tsx src/lib/data/samples.ts src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
git commit -m "test: lock active sample scope behavior"
```

## Final Verification

**Step 1: Run the full targeted test suite**

```bash
npm run test:run -- src/lib/data/samples.test.ts src/components/__tests__/samples-page-client-scope.test.tsx src/components/sample-filters/use-filter-params.test.tsx src/components/__tests__/sample-filters-scope.test.tsx
```

Expected:
- PASS

**Step 2: Run type checking**

```bash
npm run typecheck
```

Expected:
- PASS with no new type errors

**Step 3: Manual sanity pass if the app environment is available**

Verify:
- `/samples`
- `/samples?scope=all`
- `/samples?status=completed`
- `/samples?scope=all&status=completed`

Expected:
- default `/samples` hides `completed`
- `scope=all` shows the full dataset
- `status=completed` wins over active scope
- clearing `status` from `scope=all&status=completed` returns to `scope=all`
- reset returns to the implicit active default

**Step 4: Final branch landing**

```bash
git pull --rebase
bd sync
git push
git status -sb
```

Expected:
- branch is up to date with origin
- if `bd` is unavailable in the environment, document that blocker explicitly before closing the session
