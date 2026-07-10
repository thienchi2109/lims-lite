## ADDED Requirements

### Requirement: User role is assigned only during account creation

The system SHALL require a manager to select a valid role when creating a new
account and SHALL NOT present an editable role control when editing an
existing account.

#### Scenario: Manager creates an account with the intended role

- **WHEN** an authenticated manager submits the create-user form
- **THEN** the system SHALL validate and persist the selected role as part of
  account creation
- **AND** the created role SHALL be available to the existing audit trail.

#### Scenario: Manager edits an existing analyst account

- **WHEN** an authenticated manager opens the edit-user form for an analyst
- **THEN** the system SHALL show the account's current role as non-editable
- **AND** the form SHALL NOT submit a `role` field in its update payload.

### Requirement: Manager accounts have an OTP destination at creation

The system SHALL require an email address when creating a manager account and
SHALL configure that email as the manager OTP destination before reporting the
account creation as successful, regardless of current OTP enforcement flags.

#### Scenario: Manager account is created with an email address

- **WHEN** an authenticated manager creates a manager account with a valid
  email address
- **THEN** the system SHALL create the Auth and profile records
- **AND** the system SHALL persist a `manager_otp_settings` record for the
  new account using that email address.

#### Scenario: Manager account lacks an email address

- **WHEN** an authenticated manager attempts to create a manager account
  without an email address
- **THEN** the system SHALL reject the request before creating Auth, profile,
  or OTP-setting records.

#### Scenario: Manager OTP destination configuration fails

- **WHEN** manager account creation cannot configure the required OTP
  destination
- **THEN** the system SHALL fail the creation request
- **AND** the system SHALL not leave an active Auth or profile account for
  that failed creation.

### Requirement: Role mutation is rejected at every update boundary

The system SHALL reject any attempt to change `users.role` after account
creation from the client-action contract, Server Action, or database trigger.

#### Scenario: Crafted application request includes a role change

- **WHEN** an authenticated manager sends an update request containing a
  `role` value
- **THEN** the request SHALL fail with a role-immutability validation error
- **AND** the system SHALL NOT update the user profile, Auth record, OTP
  destination, or audit log.

#### Scenario: Direct database update changes a role

- **WHEN** any database principal attempts to update an existing
  `public.users.role` value
- **THEN** the database trigger SHALL reject the statement
- **AND** the transaction SHALL not create an audit event or persist a partial
  profile update.

### Requirement: Role replacement preserves the original account history

The system SHALL require a new account with the intended role instead of
changing an existing account role. The old account SHALL be soft-disabled
using the existing lifecycle after operational work has been reassigned.

#### Scenario: Operator replaces an analyst account with a manager account

- **WHEN** an operator needs a person to work as a manager instead of an
  analyst
- **THEN** the operator SHALL create a separate manager account
- **AND** the original analyst account's signatures, results, samples, and
  audit history SHALL remain associated with that original account
- **AND** disabling the original account SHALL use soft delete and Auth ban
  without hard-deleting its historical data.

### Requirement: Managers can toggle analyst confidential access

The system SHALL allow a manager to enable or disable
`can_access_confidential` only for an existing analyst account through an
accessible Vietnamese toggle control. The system SHALL reject the entitlement
change for manager and doctor accounts.

#### Scenario: Manager enables confidential access for an analyst

- **WHEN** an authenticated manager turns on the confidential-access toggle
  for an analyst account and saves the edit form
- **THEN** the system SHALL persist `can_access_confidential = true`
- **AND** the immutable audit trail SHALL record the permitted profile change.

#### Scenario: Manager revokes confidential access for an analyst

- **WHEN** an authenticated manager turns off the confidential-access toggle
  for an analyst account and saves the edit form
- **THEN** the system SHALL persist `can_access_confidential = false`
- **AND** the control SHALL expose the off state in Vietnamese to assistive
  technology.

#### Scenario: Manager edits a non-analyst account

- **WHEN** an authenticated manager opens an existing manager or doctor
  account for editing
- **THEN** the form SHALL NOT show the confidential-access toggle
- **AND** a crafted confidential-access update SHALL be rejected.
