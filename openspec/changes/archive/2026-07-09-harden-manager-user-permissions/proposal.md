## Why

Manager accounts currently have broad user-management authority: a manager can modify or soft-delete another existing manager and can submit changes to `can_access_confidential`. This creates an avoidable privilege-governance gap for a 21 CFR Part 11-aware LIMS, where high-risk role and confidential-access changes should be tightly controlled and auditable.

## What Changes

- Keep the manager workflow for creating new users, including creating new users with role `manager`.
- Force all app-created users to start with `can_access_confidential = false`, regardless of client payload.
- Prevent managers from editing or soft-deleting any other existing manager account.
- Allow a manager to update their own permitted account fields, but reject any app-level attempt to change their own `can_access_confidential` value.
- Keep confidential-access changes out of the application workflow; superadmin/DB-admin operators will manage that flag directly through trusted Supabase administration access.
- Add database defense-in-depth so `public.users` rejects manager-originated updates/deletes that violate these boundaries even if a route or client-action path is bypassed.
- Update Vietnamese UI states so restricted edit/delete/confidential controls are disabled or omitted with clear copy.
- Extend security regression coverage so `run_security_tests()` catches future regressions in manager-to-manager account boundaries.

## Capabilities

### New Capabilities
- `user-management-permissions`: Defines manager account-management boundaries, confidential-access governance, and database enforcement for user profile mutations.

### Modified Capabilities
- None.

## Impact

- Affected code:
  - `src/app/actions/users.ts` for create/update/delete authorization and forced confidential defaults.
  - `src/app/api/client-actions/role-guard.ts` if route-level denial should reject invalid user-management mutations before handler dispatch.
  - `src/components/user-form.tsx`, `src/components/user-form-role-access-fields.tsx`, and `src/components/user-list-table.tsx` for Vietnamese UI affordances.
  - `src/types/core.ts` only if request/response schemas need stricter app-level modeling for confidential-field submissions.
- Affected database:
  - New forward SQL migration under `supabase/migrations/`.
  - `public.users` RLS/trigger behavior for manager-originated INSERT/UPDATE/DELETE.
  - `run_security_tests()` must gain assertions for manager account-boundary and confidential-flag restrictions.
- Compliance and audit impact:
  - Preserves soft-delete behavior; no hard-delete path is introduced.
  - Narrows privileged account changes to explicit app rules and trusted DB-admin operations.
  - Rejects unauthorized confidential-access changes instead of silently accepting or ignoring them, improving auditability.
- Localization impact:
  - Any new UI error, disabled-control explanation, or toast copy must be Vietnamese.
- Dependencies:
  - No new runtime dependency expected.
