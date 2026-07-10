## Context

The manager user-management form currently reuses the role selector for create
and edit. `UpdateUserSchema` and `updateUser` accept `role`, and the live
`guard_manager_user_write_boundaries()` trigger does not reject an update that
changes only `users.role`. Since middleware and RLS resolve the current role
from `public.users`, a successful promotion changes the target account's
effective permissions on its next request.

The current database already provides an immutable audit trigger for
`public.users`, soft-delete plus Auth ban for deactivation, manager-only
user-management actions, and analyst-only confidential-access updates. The
change must keep these controls while removing role mutation and making the
analyst confidential-access state easier to scan.

## Goals / Non-Goals

**Goals:**

- Make a role an account-creation-time attribute that cannot change later.
- Reject role mutation in the edit UI, typed client contract, Server Action,
  and PostgreSQL trigger so a crafted request cannot bypass the UI.
- Preserve the manager workflow to enable or disable
  `can_access_confidential` for analyst accounts after creation.
- Require a manager account's email and OTP destination to be configured as
  one account-creation outcome, independent of whether OTP enforcement flags
  are currently enabled.
- Replace the confidential-access checkbox with an accessible Vietnamese toggle
  whose current state is clear to mouse, keyboard, and assistive-technology
  users.
- Preserve RLS, soft-delete/ban behavior, immutable audit logging, electronic
  signatures, and historical result ownership.

**Non-Goals:**

- Do not create a new password-reset or account-replacement UI workflow.
- Do not automatically reassign active analyst work or transfer historical
  records to a replacement account.
- Do not change manager, analyst, doctor, or confidential-data RLS semantics.
- Do not enable, configure, or alter the currently disabled email-OTP flags.
- Do not delete users, audit records, signatures, results, or samples.

## Decisions

### Treat role as immutable after insert

The role selector remains available only in the create form. Edit payloads
will not contain `role`, and the update schema/action will reject a supplied
role rather than silently ignoring it.

The database trigger will reject `NEW.role IS DISTINCT FROM OLD.role` before
the existing trusted-role bypass. This keeps the boundary effective for
authenticated requests, `service_role`, and direct PostgreSQL updates.

**Alternative considered:** Hide the selector only. Rejected because an
existing client, crafted request, or direct database update could still
elevate an account.

### Keep confidential access mutable, but analyst-only

`can_access_confidential` is an entitlement, not a role. Managers retain the
existing authority to toggle it for an account whose current role is
`analyst`. The update schema/action and database guard continue to reject
confidential-access mutations for manager and doctor accounts.

**Alternative considered:** Make confidential access immutable with role.
Rejected because the approved operational policy requires managers to grant
and revoke analyst confidential access after account creation.

### Use one accessible switch control for confidential access

The edit form will render one labeled switch for analyst confidential access,
instead of a checkbox plus a separate clickable wrapper. The control will
provide a stable on/off state, keyboard operation, and Vietnamese accessible
name. The same form value and API payload remain unchanged.

**Alternative considered:** Retain the checkbox with new styling. Rejected
because the requested binary-access control should make its enabled state
visually distinct without changing the underlying entitlement behavior.

### Provision a manager OTP destination during account creation

Manager creation continues to require an email address. The create action
must upsert `manager_otp_settings` with that address and roll back the newly
created Auth/profile account if OTP-destination configuration fails. This
ensures accounts created while OTP flags are disabled remain ready for
step-up enforcement when the flags are enabled later.

**Alternative considered:** Configure OTP only when enforcement is enabled.
Rejected because it creates manager accounts that fail closed or use stale
destinations when OTP is enabled later.

### Make role replacement an auditable operational sequence

Changing a person's role requires a manager to provision a new account with
the intended role, reassign any active work as needed, and then use the
existing soft-delete/Auth-ban workflow for the old account. Historical links,
signatures, results, samples, and audit records remain attached to the
original account.

This change does not automate account replacement. A replacement account must
use an available unique username and Auth email; any email-identity transfer
needs a separate approved workflow.

**Alternative considered:** Provide a privileged promotion/demotion action.
Rejected because it recreates the active-session privilege-escalation path
this change removes.

## Risks / Trade-offs

- [Replacement may require a new unique Auth email] -> Document the
  operational sequence and keep email-identity transfer outside this change
  until its audit and authentication semantics are designed.
- [A database migration could block emergency direct role corrections] ->
  Require the approved replacement-account process; any exceptional data
  repair must be a reviewed migration, not an ad hoc role update.
- [Legacy clients may still send `role`] -> Reject the request explicitly and
  cover it with Server Action/client-route regression tests.
- [Manager creation partially succeeds without OTP metadata] -> Treat OTP
  destination configuration as part of the creation transaction and roll back
  the new account on failure.
- [A role mutation exception prevents an audit row] -> This is intentional:
  rejected mutations leave no state change; successful account creation and
  soft-disable operations remain audited.

## Migration Plan

1. Add a versioned SQL migration that documents the security impact and moves
   the immutable-role check ahead of trusted-role bypasses in
   `guard_manager_user_write_boundaries()`.
2. Apply the migration through Docker only, then run
   `SELECT * FROM run_security_tests();`.
3. Verify a transaction attempting `UPDATE public.users SET role = ...`
   fails and rolls back, while an analyst confidential-access update remains
   permitted for a manager.
4. Deploy the application update that removes editable role controls and
   rejects role-bearing update payloads.
5. Roll back application code only before applying the migration. After the
   migration, rollback requires a reviewed follow-up migration because
   restoring mutable roles would weaken the security boundary.

## Open Questions

- None for this scoped change. Email-identity transfer for replacement
  accounts and a dedicated password-reset workflow are explicitly deferred.
