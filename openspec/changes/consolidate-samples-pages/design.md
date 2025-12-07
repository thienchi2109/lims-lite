# Design: Consolidate Samples Workspace

## Approach
- Single `/samples` page (force-dynamic) handles auth/role via Supabase server client, builds a `permissions` map (manager can reject/ignore only for `Đã nhận`/`Đã chỉ định`; approvals remain elsewhere), and passes `homeHref` + `receiverOptions` to the client shell.
- Preserve the TanStack Query pipeline added for analysts: `useSamples` and `useSampleDetail` fetch through `/api/client-actions` so server data stays behind RLS and caches stay in sync.
- Keep legacy URLs `/analyst/samples` and `/manager/samples` as authenticated redirects to `/samples`, preserving query strings so bookmarks and dashboard links still work.

## Data Flow
- Server component: get user + role; fetch receiver list once for filters/forms; derive `permissions` and `homeHref`; render the client shell.
- Client shell: parse search params, call `useSamples` for the list and `useSampleDetail` for detail; pass data + `permissions` to shared components. Query keys remain `sampleKeys` to avoid cache fragmentation.
- Actions: manager-only reject/ignore buttons respect status guards and permissions; approval actions remain on the approvals page.

## Component Updates
- `SamplesPageClient`: accept `role`/`permissions`/`homeHref`; keep TanStack Query hooks; render back link via `homeHref`.
- Shared sample components (`SampleListTable`, `SampleBottomRow`, dialogs/panels): gate actions via `permissions` and status checks rather than route-based conditionals; keep Vietnamese text.
- Revalidation: add `/samples` alongside existing manager/analyst paths in server actions.

## Risks and Mitigations
- **Drift with existing change** (`add-tanstack-query-refresh`): reuse the same hooks and client actions; avoid server-side fetch duplication.
- **Permissions regression**: centralize `permissions` map and status guard; add manual checks as manager vs analyst.
- **Link breakage**: preserve query strings in redirects; update back links per role.
