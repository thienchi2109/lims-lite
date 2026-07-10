## 1. RED: Lock the intended boundaries with regression tests

- [x] 1.1 Add Server Action/client-action tests proving an update payload with `role` is rejected before profile, Auth, OTP, or audit side effects.
- [x] 1.2 Add user-form tests proving the create flow retains role selection while the edit flow exposes the current role as non-editable and omits `role` from the update payload.
- [x] 1.3 Replace the confidentiality-control test fixture and assertions with an accessible toggle test that covers Vietnamese label, on/off state, keyboard interaction, and submitted `can_access_confidential` value.
- [x] 1.4 Add create-user regression tests proving a manager email is required, its OTP destination uses that email even with OTP flags disabled, and OTP configuration failure leaves no active account.
- [x] 1.5 Add database regression coverage proving role updates fail for direct SQL while an authenticated manager can still toggle an analyst's confidential access and cannot change it for manager or doctor accounts.

## 2. Remove role mutation from application updates

- [x] 2.1 Narrow `UpdateUserSchema`, `UpdateUser` types, `updateUserClient`, and the client-action route contract so update payloads reject a supplied `role`.
- [x] 2.2 Remove role writes from `updateUser` and retain the existing manager, target-manager, and analyst-only confidential-access authorization checks.
- [x] 2.3 Update the edit-user form to render the current role read-only, retain the role selector only for account creation, and keep password behavior unchanged.
- [x] 2.4 Replace the analyst confidential-access checkbox with one accessible Vietnamese toggle while preserving the existing `can_access_confidential` request and error behavior.
- [x] 2.5 Preserve the manager create-user contract: require email, configure `manager_otp_settings` from that email, and roll back the new account when configuration fails.

## 3. Enforce role immutability in PostgreSQL

- [x] 3.1 Inspect the live Docker definition of `guard_manager_user_write_boundaries()`, its policies, grants, audit trigger, and relevant security-test helpers before authoring the migration.
- [x] 3.2 Add a versioned migration that documents its security impact and rejects `NEW.role IS DISTINCT FROM OLD.role` before any trusted-role bypass, while preserving `SECURITY DEFINER`, fixed `search_path`, RLS, and audit behavior.
- [x] 3.3 Apply the migration through `docker exec ... lims-postgres psql`, run `SELECT * FROM run_security_tests();`, and verify transactional SQL attempts to promote or demote an existing account fail without a persisted audit event.
- [x] 3.4 Verify the existing soft-delete plus Auth-ban workflow remains the only account-retirement path and does not delete user history, signatures, samples, results, or audit records.

## 4. Verify and document the supported replacement process

- [x] 4.1 Run focused Server Action, client-action, user-form, and database regression tests for immutable roles and analyst confidential-access toggling.
- [x] 4.2 Run `npm run lint` and `npm run typecheck`.
- [x] 4.3 Run `openspec validate make-user-roles-immutable --strict`.
- [x] 4.4 Document the operational replacement sequence: create a uniquely identified account with the correct role, reassign active work, then soft-disable and ban the old account; do not transfer historical ownership or signatures.
