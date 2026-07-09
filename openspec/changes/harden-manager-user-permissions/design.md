## Context

The current user-management surface is manager-owned: `/manager/users` loads users, client mutations go through `src/lib/api-client.ts`, and the server actions in `src/app/actions/users.ts` use Supabase Auth admin APIs plus `public.users` profile writes. The live `public.users` RLS state permits any authenticated manager to update another manager row because the policy only checks the caller role.

This change narrows the application boundary without introducing a new application role. Managers remain able to create new manager accounts for operational continuity, but existing manager accounts and confidential-access flags become protected governance surfaces. Superadmin/DB-admin operators can still manage `can_access_confidential` directly through trusted Supabase administration access.

## Goals / Non-Goals

**Goals:**

- Preserve manager ability to create users, including `role = manager`.
- Force app-created users to start with `can_access_confidential = false`.
- Block managers from editing or soft-deleting other existing manager accounts.
- Allow managers to edit their own permitted account fields while rejecting any self-service confidential-access change.
- Enforce the rule in both Server Actions and database-level guardrails.
- Keep all new user-facing copy in Vietnamese and all destructive actions soft-delete only.
- Add regression coverage in app tests and SQL/security tests.

**Non-Goals:**

- Add an application `superadmin` role.
- Build a Supabase GUI replacement for confidential-access administration.
- Redesign manager onboarding, password reset, or manager OTP behavior.
- Backfill or change existing manager confidential-access values.
- Introduce hard deletes for users or Auth records.

## Decisions

### Reject unauthorized confidential changes instead of silently ignoring them

Server actions will reject payloads that attempt to set or toggle `can_access_confidential` from the app. This gives operators and tests a clear audit signal when old UI code, stale clients, or manual requests attempt a forbidden change.

Alternative considered: silently coerce updates to the existing value. That reduces user-facing errors but hides attempted policy violations and makes regression testing weaker.

### Force confidential access to false on app-created users

`createUser` will ignore any submitted confidential flag and persist `can_access_confidential = false`. This applies to all app-created roles, including manager, analyst, and doctor. The only accepted way to enable or disable confidential access is a trusted DB-admin operation outside the app workflow.

Alternative considered: allow managers to set confidential access only during creation. That keeps the create form more powerful but creates a bypass around the intended superadmin-only governance model.

### Guard manager targets before profile or Auth admin mutations

`updateUser` and `deleteUser` will load the target user's current role before making any `public.users` or Supabase Auth admin mutation. If the target is a different manager, the action fails before changing either database profile fields or Auth email/password/ban state. Self-delete remains denied.

Alternative considered: rely on UI disabling alone. That is insufficient because client-action routes are request-facing and must assume attackers can call them directly.

### Add database defense-in-depth with manager-aware user guards

A forward migration will harden `public.users` so authenticated manager-originated writes cannot:

- update another existing manager row,
- soft-delete another existing manager row,
- change `can_access_confidential`,
- insert a row with `can_access_confidential = true`.

Implementation should prefer a narrowly scoped trigger/helper function for comparisons against `OLD` and `NEW` values because column-change rules are awkward to express with plain RLS policy predicates. The guard must not block trusted database roles such as `postgres` and `service_role`, preserving the requested Supabase administration workflow.

Alternative considered: only rewrite RLS policies. RLS can restrict row visibility and broad write eligibility, but comparing sensitive old/new column transitions is clearer and more testable in a trigger.

### Keep UI as a usability layer, not the authority

The UI will hide or disable edit/delete controls for other manager rows and disable confidential controls for manager self-edit/create flows. Server actions and database guards remain authoritative. New messages must be Vietnamese.

Alternative considered: remove the confidential field from all forms. That is acceptable if the implementation can do it without disturbing existing tests, but server/database rejection is still required.

## Risks / Trade-offs

- Existing manager workflows may rely on editing another manager for operational recovery -> Keep trusted DB-admin/Supabase administration as the recovery path and document the app-level restriction in copy/tests.
- Database trigger mistakes could block legitimate service-role maintenance -> Explicitly exempt trusted DB roles and add SQL smoke coverage for both blocked manager writes and allowed admin/service writes.
- Auth admin update and profile update can drift if validation happens too late -> Load and validate target role before any profile or Auth mutation.
- Existing tests may assert managers can submit `can_access_confidential` -> Update tests to reflect the new governance model and add regression cases for rejection.

## Migration Plan

1. Add failing app tests for create/update/delete boundaries.
2. Add failing SQL/security tests for `public.users` manager write restrictions.
3. Implement server-action guards and forced confidential defaults.
4. Add database migration with security-impact comments, guard function/trigger, explicit grants/revokes as needed, and `run_security_tests()` additions.
5. Update Vietnamese UI affordances after server/database rules are green.
6. Apply migration through Docker, run `SELECT * FROM run_security_tests();`, then run focused app tests, `npm run lint`, and `npm run typecheck`.

Rollback is a forward migration that restores previous manager write permissions only if the organization explicitly accepts the old risk. The safer operational rollback for urgent account changes is direct trusted DB-admin intervention, not weakening app permissions.

## Open Questions

- Should app-created doctors and analysts also always start with `can_access_confidential = false`? This design says yes for consistency with superadmin-only confidential governance.
- Should the UI remove the confidential checkbox entirely from manager user-management forms, or leave it visible but disabled with explanatory Vietnamese copy?
