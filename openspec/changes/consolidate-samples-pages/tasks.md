## 1. Discovery
- [ ] 1.1 Review existing TanStack Query flow (add-tanstack-query-refresh change, `useSamples`, `useSampleDetail`, `/api/client-actions` `getSamples`) for compatibility.
- [ ] 1.2 Confirm manager-only actions (reject/ignore limited to `Đã nhận`/`Đã chỉ định`) and that approvals remain on the dedicated page.

## 2. Routing and auth
- [ ] 2.1 Add unified `/samples` server page (force-dynamic) that authenticates, reads role, builds `permissions`/`homeHref`, fetches receiver options, and renders the client shell.
- [ ] 2.2 Add thin wrappers for `/analyst/samples` and `/manager/samples` that enforce auth/role and redirect to `/samples` preserving query strings.

## 3. Client shell and components
- [ ] 3.1 Extend `SamplesPageClient` (or successor) to accept `role`/`permissions`/`homeHref` props while retaining TanStack Query data fetching.
- [ ] 3.2 Update shared sample components to gate actions by permissions + status (manager-only reject/ignore), removing duplicate manager/analyst logic.
- [ ] 3.3 Ensure Vietnamese copy/back links remain correct for each role.

## 4. Actions and data consistency
- [ ] 4.1 Verify `getSamples`/`getSample` RLS/filters and any role branching still behave for both roles in the unified page.
- [ ] 4.2 Add `/samples` to revalidation paths alongside existing manager/analyst paths.

## 5. Validation
- [ ] 5.1 Update docs/change notes if needed.
- [ ] 5.2 Run relevant checks (lint/tests/manual as analyst+manager for list/detail/reject/ignore).
- [ ] 5.3 Run `openspec validate consolidate-samples-pages --strict`.
