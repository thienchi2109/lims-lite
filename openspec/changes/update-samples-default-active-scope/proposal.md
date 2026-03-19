## Why

The unified `/samples` workspace currently fetches every sample status by default. In practice, completed samples are rarely revisited from the day-to-day "Quản lý mẫu" workflow, so they add noise to the default grid and increase the amount of data sorted, counted, and paginated on every load.

The product goal is to optimize the default workspace for active operational work without removing access to completed samples when users explicitly need them.

## What Changes

- Add a default **active sample scope** for the unified `/samples` workspace that excludes samples with `status = 'completed'` when no explicit status filter is selected.
- Add an explicit **"Hiển thị tất cả"** control so users can fetch the full sample dataset on demand.
- Define URL/query semantics for a new list scope parameter so the behavior survives refresh, bookmarks, and shared links.
- Define precedence rules so an explicit `status` filter continues to work, including `status=completed`.
- Add a visible indication in the workspace when completed samples are hidden by the default active scope.
- Preserve the existing Vietnamese filter UI and existing status filter meanings; do not introduce a pseudo-status such as `not_completed`.

## Impact

- **Affected specs:** `sample-management`
- **Primary code surfaces:**
  - `src/types/lab.ts`
  - `src/components/sample-filters/index.tsx`
  - `src/components/sample-filters/use-filter-params.ts`
  - `src/components/sample-filters/ActiveFilterBadges.tsx`
  - `src/components/samples-page-client.tsx`
  - `src/lib/data/samples.ts`
- **Runtime path context:**
  - `src/lib/api-client.ts`
  - `src/app/actions/samples.ts`
  - `src/hooks/use-samples.ts`
  - targeted regression coverage under `src/components/__tests__/` and/or `src/lib/data/*.test.ts`

- **Behavior change:** Visiting `/samples` with no explicit status filter will default to the active sample scope instead of fetching all statuses.
- **Non-goals:** This change does not archive completed samples, change sample status semantics, add database schema changes, or alter role permissions.
