## Context

The current unified samples workspace parses filters from the URL and sends them through `useSamples` into `fetchSamples`, which only applies a status predicate when `status` is explicitly present. As a result, the default `/samples` experience always fetches all statuses, including `completed` rows that are rarely used in the active operational workflow.

The system already has a clear domain status model (`received`, `assigned`, `in_progress`, `review`, `completed`, `discarded`) and a Vietnamese filter UI. The design needs to improve the default query behavior without corrupting that domain model or surprising users who explicitly filter by status.

Current implementation notes that affect this design:
- `SamplesPageClient` currently treats a missing `status` as "fetch all statuses".
- `use-filter-params.ts` currently has no concept of list scope.
- `ActiveFilterBadges.tsx` currently renders nothing when there are no explicit filters, so it cannot yet explain an implicit default scope.
- I could not find direct automated coverage around this `/samples` filter-state flow, so verification needs to include focused regression coverage, not only manual checks.

## Goals / Non-Goals

- **Goals:**
  - Optimize the default `/samples` query toward active work by excluding `completed` rows unless the user opts in.
  - Preserve explicit access to all samples through a visible UI control.
  - Preserve the existing status filter semantics, including direct filtering to `completed`.
  - Keep URL-driven state so refresh/bookmark/share behavior remains stable.

- **Non-Goals:**
  - Add archival tables, background jobs, or schema changes.
  - Change RLS, role permissions, or the meaning of sample statuses.
  - Redesign the entire samples filter UI.

## Decisions

### Decision 1: Introduce a separate list scope parameter

Use a new query/list parameter `scope` with values:
- `active`: default behavior, excludes `completed` when no explicit status is selected
- `all`: fetches all statuses

This keeps `status` reserved for actual domain states and avoids introducing a fake status such as `not_completed`.

### Decision 2: Default to active scope when `scope` is absent

The canonical default for `/samples` is the active scope. The URL does not need to persist `scope=active` unless the implementation chooses to do so internally, but the product behavior SHALL treat a missing `scope` as active.

### Decision 3: Explicit `status` filters override scope

If the user selects a concrete status, that explicit status wins over the default scope. This preserves existing mental models and allows `status=completed` to work even if the workspace default is active.

Examples:
- `/samples` => active scope
- `/samples?scope=all` => all samples
- `/samples?status=review` => review only
- `/samples?status=completed` => completed only
- `/samples?scope=active&status=completed` => completed only

### Decision 4: Place the fallback control in the main toolbar

The `Hiển thị tất cả` control should live in the visible samples toolbar rather than inside the advanced filter popover. This is a top-level fetch mode, not a secondary filter.

### Decision 8: Narrow the search bar to accommodate the scope toggle

The current toolbar in `sample-filters/index.tsx` uses a flex row where the search container is `flex-1` (absorbs all remaining space) and the right-side controls (`FilterPopover`, Sort, PageSize`) are `shrink-0`. This means the search bar stretches edge-to-edge minus the fixed controls, leaving no room for an additional button.

To fit the `Hiển thị tất cả` toggle in the toolbar (Decision 4), cap the search container with a `max-w` utility (e.g. `max-w-sm` ≈ 384 px, or `max-w-md` ≈ 448 px). The freed space allows the scope toggle to sit naturally between the search bar and the `Bộ lọc` button. The search field remains responsive via `flex-1` on narrower viewports but stops growing past the cap on wider screens.

### Decision 5: Keep the scope control visible while explicit status is selected

When the user selects a concrete status, that explicit status should still win over scope for the actual query result. However, the top-level scope control should remain visible and URL-backed so the remembered dataset mode survives refresh/share/bookmark behavior and becomes active again once the explicit status filter is cleared.

This avoids hiding important state while still keeping the precedence rules simple:
- `scope=all&status=completed` still shows only completed rows
- clearing `status` from that URL returns the workspace to `scope=all`

### Decision 6: Reset filters returns to the active default

Resetting filters should remove search and secondary filters, clear explicit status filters, reset pagination, and return the workspace to its default active scope.

### Decision 7: Show the active-scope hint in the active-filter row

The workspace should communicate the default active scope through the active-filter row rather than helper text buried elsewhere. The hint should appear only when active scope is actually effective, meaning `scope` resolves to `active` and no concrete `status` filter is selected.

## Risks / Trade-offs

- Default `/samples` behavior changes, so some users may initially notice that completed samples are no longer in the default grid.
  - Mitigation: use a visible `Hiển thị tất cả` control and a small status badge/message indicating that completed samples are hidden by default.

- The interaction between `scope` and `status` can become confusing if both are simultaneously editable.
  - Mitigation: explicit status selection overrides scope, but the scope control remains visible and URL-backed so the remembered scope is not hidden from the user.

- Query performance gains depend on the actual proportion of completed rows and existing indexes.
  - Mitigation: keep this proposal scoped to behavior and UX first; implementation can validate observed gains with production-like data later.

## Migration Plan

1. Extend the sample list parameter schema to accept the new `scope` value.
2. Update samples filter state and toolbar UI to expose `Hiển thị tất cả`.
3. Apply the active-scope default in `fetchSamples` only when `status` is not explicitly selected.
4. Add focused regression coverage for URL behavior, query precedence, and default reset behavior.

## Resolved Implementation Choices

- Keep the scope control visible while a concrete `status` filter is active; explicit `status` still overrides the query result.
- Show the active-scope hint in the active-filter row instead of inline helper text near the toolbar control.
