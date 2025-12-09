## Why

**Current State (Actual):**
- Manager samples page (`/manager/samples`) uses TanStack Query with `SamplesPageClient` (migrated in commit d4b5223)
- Analyst samples page (`/analyst/samples`) still uses legacy server-side rendering with direct `getSamples()` calls
- Two different architectures increase maintenance burden and create feature parity gaps

**Problems:**
- Analyst page lacks TanStack Query benefits: reliable auto-refresh, caching, optimistic updates
- Duplication of sample management UI logic across two different rendering strategies
- Analyst page needs TanStack Query migration anyway (per add-tanstack-query-refresh design doc recommendation)
- Manager-only reject/ignore actions are already conditionally rendered based on status, consolidation just needs role-based permissions

## What Changes

- Create unified `/samples` workspace using TanStack Query pipeline (`useSamples`, `useSampleDetail`)
- Migrate analyst page from server-side rendering to client-side TanStack Query (as part of consolidation)
- Add role-aware permissions prop to control manager-only actions (reject/ignore for `Đã nhận`/`Đã chỉ định`)
- Keep legacy `/analyst/samples` and `/manager/samples` as thin, authenticated redirects to `/samples`, preserving query strings
- Update server actions revalidation paths to include `/samples`

## Impact

**Affected specs:** 
- sample-management (unified samples workspace, role-aware actions)
- add-tanstack-query-refresh (extends to analyst page)

**Affected code:**
- `app/(dashboard)/analyst/samples/page.tsx` - Convert to thin redirect wrapper
- `app/(dashboard)/manager/samples/page.tsx` - Convert to thin redirect wrapper  
- `app/samples/page.tsx` - NEW: Unified server component with auth/role checks
- `components/samples-page-client.tsx` - Update to handle both roles with permissions
- `components/sample-list-table.tsx` - Add role-based action gating
- `app/actions/samples.ts` - Add `/samples` to revalidation paths
- OpenSpec docs - Update to reflect unified architecture

**Migration complexity:** Medium-High
- Combines analyst page migration to TanStack Query + unification
- Requires thorough testing of both roles
- Estimated effort: 2-3 days
