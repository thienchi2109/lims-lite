## Why

Changing an existing account from `analyst` to `manager` immediately elevates
the account's active session and can preserve analyst-specific confidential
access state. In a 21 CFR Part 11-aware LIMS, role assignment must be an
intentional, auditable creation-time decision rather than a mutable profile
field.

## What Changes

- **BREAKING** Make `users.role` immutable after account creation. The manager
  user-management edit workflow, client action, Server Action, and database
  boundary will reject role changes, including `analyst` to `manager`.
- Keep role selection available only when a manager creates a new account.
  Operators needing a different role will create the correctly scoped account
  and soft-disable the old account using the existing auditable lifecycle.
- Preserve manager control of `can_access_confidential` for analyst accounts
  after creation. The edit form will replace the checkbox with an accessible
  toggle that exposes its on/off state clearly in Vietnamese.
- Require every manager account to provide an email address during creation
  and configure that address as its manager OTP destination. Account creation
  must fail atomically when the OTP destination cannot be configured, even
  while the OTP enforcement flags are disabled.
- Preserve existing protections: managers cannot modify other manager
  accounts, confidential access remains analyst-only, and every permitted
  profile mutation remains recorded by the immutable `audit_logs` trail.

## Capabilities

### New Capabilities

- `immutable-user-roles`: User roles are selected only at account creation and
  cannot be changed through the application or authenticated database path;
  managers can still manage the confidential-access entitlement of analyst
  accounts through an accessible toggle.

### Modified Capabilities

- None.

## Impact

- Affected UI: `src/components/user-form.tsx`,
  `src/components/user-form-role-access-fields.tsx`, and related Vietnamese
  user-management tests.
- Affected application boundary: `UpdateUserSchema`,
  `updateUser`, `CreateUserSchema`, `createUser`, and the user client-action
  contracts. Consumers must stop sending `role` in update payloads; manager
  creation must include an OTP destination email.
- Affected database boundary: a security migration will strengthen
  `guard_manager_user_write_boundaries()` so role immutability also applies to
  PostgreSQL and `service_role` updates, while preserving unrelated RLS and
  `audit_users_trigger` behavior.
- No password-reset workflow changes are included in this change.
- Verification includes focused UI and Server Action regression tests, Docker
  database migration/security checks with `run_security_tests()`, `npm run
  typecheck`, and strict OpenSpec validation.
