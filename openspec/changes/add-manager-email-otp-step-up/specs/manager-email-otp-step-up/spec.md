## ADDED Requirements

### Requirement: Manager email OTP step-up is required after password login
The system SHALL require users with role `manager` to complete email OTP step-up after successful password authentication before accessing manager routes or manager-only operations.

#### Scenario: Manager password login requires OTP verification
- **GIVEN** a user with role `manager` has successfully authenticated with username and password
- **AND** the current session does not have valid manager email OTP step-up state
- **WHEN** the user attempts to access `/manager` or a manager-only operation
- **THEN** the system SHALL redirect the user to the Vietnamese email OTP verification flow instead of granting access

#### Scenario: Non-manager login is not blocked by manager OTP
- **GIVEN** a user with role `analyst` or `doctor` has successfully authenticated
- **WHEN** the user accesses routes allowed for their role
- **THEN** the system SHALL NOT require manager email OTP step-up

### Requirement: Manager OTP destination email is admin-managed
The system SHALL allow personal email addresses for manager OTP delivery in the MVP, but the destination email MUST be configured and changed only through an admin-controlled workflow.

#### Scenario: Admin configures manager OTP email
- **GIVEN** an admin is managing a user with role `manager`
- **WHEN** the admin sets or updates the manager OTP destination email
- **THEN** the system SHALL validate and store the destination
- **AND** audit the change without exposing sensitive values beyond allowed masked display

#### Scenario: Manager cannot self-change OTP email
- **GIVEN** an authenticated manager is editing their own profile
- **WHEN** the manager attempts to change the OTP destination email
- **THEN** the system SHALL deny the change and instruct the manager to contact an administrator

#### Scenario: Manager sees only masked OTP destination
- **GIVEN** a manager is on the OTP verification screen
- **WHEN** the system displays the destination email
- **THEN** the system SHALL show only a masked email representation

### Requirement: OTP challenges are short-lived, single-use, and protected
The system SHALL store OTP challenges only as server-side hashes, enforce short expiration, and prevent replay or brute-force verification.

#### Scenario: OTP challenge is generated securely
- **WHEN** the system creates an email OTP challenge for a manager
- **THEN** it SHALL generate a random numeric code
- **AND** store only a hash of the code
- **AND** set an expiration of no more than five minutes
- **AND** send the plaintext code only through the configured email delivery channel

#### Scenario: OTP can be used only once
- **GIVEN** a manager has successfully verified an OTP challenge
- **WHEN** the same OTP challenge is submitted again
- **THEN** the system SHALL reject the request

#### Scenario: OTP verification locks after repeated failures
- **GIVEN** a manager has an active OTP challenge
- **WHEN** the manager submits incorrect OTP values more than the allowed attempt limit
- **THEN** the system SHALL lock or invalidate the challenge
- **AND** require a new challenge after the configured cooldown or admin recovery path

#### Scenario: Resend is rate-limited
- **GIVEN** a manager has requested an OTP email
- **WHEN** the manager requests another OTP before the resend cooldown has elapsed
- **THEN** the system SHALL reject the resend request with a Vietnamese cooldown message

### Requirement: Successful OTP verification creates manager step-up state
The system SHALL create server-verifiable manager step-up state only after a valid OTP verification and SHALL tie that state to the authenticated manager session.

#### Scenario: Valid OTP grants manager access
- **GIVEN** a manager has an active OTP challenge
- **WHEN** the manager submits the correct OTP before expiration
- **THEN** the system SHALL mark the challenge as used
- **AND** establish manager step-up state for the current session
- **AND** allow access to manager routes and manager-only operations

#### Scenario: Expired OTP does not grant access
- **GIVEN** a manager has an expired OTP challenge
- **WHEN** the manager submits the OTP
- **THEN** the system SHALL reject the OTP
- **AND** SHALL NOT create manager step-up state

#### Scenario: Step-up state is cleared when OTP email changes
- **GIVEN** a manager has valid manager step-up state
- **WHEN** an admin changes that manager's OTP destination email
- **THEN** the system SHALL invalidate existing manager step-up state for that manager

### Requirement: Manager OTP lifecycle is audited
The system SHALL audit manager OTP lifecycle events without storing or logging plaintext OTP codes.

#### Scenario: OTP send is audited
- **WHEN** the system sends or attempts to send a manager OTP email
- **THEN** the system SHALL write an audit record for the event
- **AND** the audit record SHALL NOT contain the plaintext OTP

#### Scenario: OTP verification result is audited
- **WHEN** a manager OTP verification succeeds, fails, expires, or locks
- **THEN** the system SHALL write an audit record with the event type and actor context
- **AND** the audit record SHALL NOT contain the plaintext OTP
