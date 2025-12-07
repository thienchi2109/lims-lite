## Why
- Analyst and manager sample pages are duplicated even though behaviors differ only slightly (manager-only reject/ignore for early statuses). Duplication risks drift and already caused a manager-only fetch bug.
- We recently moved the analyst page to TanStack Query; keeping two implementations increases maintenance and inconsistencies across filters/actions.
- A single role-aware workspace reduces code paths while preserving compliance and existing approval flow.

## What Changes
- Add a unified `/samples` workspace that uses the existing TanStack Query pipeline (`useSamples`, `useSampleDetail`, `/api/client-actions` `getSamples`) with role-aware props and permissions for actions.
- Keep legacy `/analyst/samples` and `/manager/samples` as thin, authenticated redirects to `/samples`, preserving query strings for bookmarks/navigation.
- Move manager-only actions (reject/ignore for `Đã nhận`/`Đã chỉ định`) behind explicit permissions in shared components; keep approvals on the dedicated approvals page.
- Update revalidation/paths and documentation to reflect the single workspace while maintaining RLS-safe server actions.

## Impact
- Affected specs: sample-management (samples workspace, role-aware actions)
- Affected code: `app/(dashboard)/(analyst|manager)/samples`, `app/samples/page.tsx`, `components/samples-*`, `hooks/use-samples|use-sample-detail`, `app/actions/samples`, `/api/client-actions`, revalidation paths, OpenSpec docs
