## 1. RED: Regression Tests First

- [x] 1.1 Add focused app tests proving `createUser` persists `can_access_confidential = false` even when the payload sends `true`.
- [x] 1.2 Add focused app tests proving `updateUser` rejects manager attempts to update another existing manager before profile or Auth admin mutations.
- [x] 1.3 Add focused app tests proving `deleteUser` rejects manager attempts to soft-delete or ban another existing manager.
- [x] 1.4 Add focused app tests proving manager self-edit may update permitted fields but rejects `can_access_confidential` changes.
- [ ] 1.5 Add SQL/security regression tests proving authenticated manager writes cannot update/delete another manager, cannot toggle `can_access_confidential`, and cannot insert confidential-enabled users.
- [ ] 1.6 Add SQL/security regression tests proving trusted DB roles can still update `can_access_confidential` for superadmin operations.

## 2. Server-Side User Management Guards

- [x] 2.1 Refactor `src/app/actions/users.ts` to load caller and target profile context before any profile or Auth admin mutation.
- [x] 2.2 Force all app-created users to persist `can_access_confidential = false`.
- [x] 2.3 Reject `updateUser` requests that target another existing manager.
- [x] 2.4 Reject `updateUser` requests that attempt to change `can_access_confidential`, including manager self-edit.
- [x] 2.5 Reject `deleteUser` requests that target another existing manager while preserving the existing self-delete denial.
- [x] 2.6 Keep Auth admin email/password/ban calls after all authorization checks so profile/Auth state cannot drift on denied requests.

## 3. Database Defense-in-Depth

- [ ] 3.1 Add a forward SQL migration with security-impact comments for `public.users` manager write boundaries.
- [ ] 3.2 Add a narrowly scoped helper/trigger guard that blocks authenticated manager-originated forbidden INSERT/UPDATE/DELETE transitions on `public.users`.
- [ ] 3.3 Ensure the guard does not block trusted roles such as `postgres` or `service_role` for superadmin/Supabase administration operations.
- [ ] 3.4 Extend `run_security_tests()` with manager user-management boundary assertions.
- [ ] 3.5 Apply the migration through Docker and verify policy/function/trigger state with targeted SQL queries.

## 4. Vietnamese UI Alignment

- [ ] 4.1 Disable or hide edit/delete controls for rows representing another existing manager in `UserListTable`.
- [ ] 4.2 Disable, omit, or fix the confidential-access control to false in user creation and manager self-edit forms.
- [ ] 4.3 Add Vietnamese explanatory copy/toasts for restricted manager-management and confidential-access actions.
- [ ] 4.4 Add or update focused component tests for disabled/hidden manager row actions and confidential-control behavior.

## 5. Verification and Rollout

- [ ] 5.1 Run focused app tests for `createUser`, `updateUser`, `deleteUser`, and user-management UI changes.
- [ ] 5.2 Run `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"` after applying the migration.
- [ ] 5.3 Run `npm run lint`.
- [ ] 5.4 Run `npm run typecheck`.
- [ ] 5.5 Run `openspec validate harden-manager-user-permissions --strict`.
- [ ] 5.6 Document in the implementation handoff that confidential-access changes are superadmin/DB-admin operations outside the app workflow.
