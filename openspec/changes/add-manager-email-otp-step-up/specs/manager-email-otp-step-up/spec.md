## ADDED Requirements

### Requirement: Manager email OTP step-up is required after password login
The system SHALL require configured manager cohorts to complete email OTP step-up after successful password authentication before accessing manager routes or manager-only operations.

#### Scenario: Manager password login requires OTP verification
- **GIVEN** a user with role `manager` has successfully authenticated with username and password
- **AND** the user's manager cohort has email OTP enabled by environment configuration
- **AND** the current session does not have valid manager email OTP step-up state
- **WHEN** the user attempts to access `/manager` or a manager-only operation
- **THEN** the system SHALL redirect the user to the Vietnamese email OTP verification flow instead of granting access

#### Scenario: Manager OTP disabled for cohort allows password-only manager session
- **GIVEN** a user with role `manager` has successfully authenticated with username and password
- **AND** the user's manager cohort has email OTP disabled by environment configuration
- **WHEN** the user accesses manager routes or manager-only operations
- **THEN** the system SHALL NOT require email OTP step-up

#### Scenario: Non-manager login is not blocked by manager OTP
- **GIVEN** a user with role `analyst` or `doctor` has successfully authenticated
- **WHEN** the user accesses routes allowed for their role
- **THEN** the system SHALL NOT require manager email OTP step-up

### Requirement: Manager OTP enforcement is controlled by cohort flags
The system SHALL support independent `TRUE`/`FALSE` environment flags for standard managers and confidential/HIV managers.

#### Scenario: Standard manager flag applies only to standard managers
- **GIVEN** `MANAGER_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** `MANAGER_HIV_EMAIL_OTP_ENABLED` is `FALSE`
- **WHEN** a standard manager with `can_access_confidential != true` logs in
- **THEN** the system SHALL require email OTP step-up

#### Scenario: Confidential manager flag applies only to confidential managers
- **GIVEN** `MANAGER_EMAIL_OTP_ENABLED` is `FALSE`
- **AND** `MANAGER_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **WHEN** a manager with `can_access_confidential = true` logs in
- **THEN** the system SHALL require email OTP step-up

#### Scenario: Both flags enabled require OTP for both manager cohorts
- **GIVEN** `MANAGER_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** `MANAGER_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **WHEN** any user with role `manager` logs in
- **THEN** the system SHALL require email OTP step-up

#### Scenario: Both flags disabled do not require manager OTP
- **GIVEN** `MANAGER_EMAIL_OTP_ENABLED` is `FALSE`
- **AND** `MANAGER_HIV_EMAIL_OTP_ENABLED` is `FALSE`
- **WHEN** any user with role `manager` logs in
- **THEN** the system SHALL NOT require email OTP step-up

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

### Requirement: OTP email delivery uses the app-owned Resend adapter
The system SHALL send manager OTP messages through an app-owned email delivery adapter with Resend as the default production provider.

#### Scenario: Resend provider sends manager OTP email
- **GIVEN** a manager OTP challenge has been created
- **AND** the production email adapter is configured with Resend credentials and a verified sender
- **WHEN** the system sends the OTP email
- **THEN** it SHALL send the email through Resend
- **AND** it SHALL return a structured provider result for audit and error handling

#### Scenario: Provider failure does not grant step-up
- **GIVEN** a manager OTP challenge has been created
- **WHEN** the configured email provider rejects or fails the send
- **THEN** the system SHALL NOT create manager step-up state
- **AND** it SHALL audit the failed send without storing or logging the plaintext OTP
- **AND** it SHALL show a Vietnamese recovery or retry message

#### Scenario: Test adapter cannot be used in production
- **GIVEN** the app is running in a production environment
- **WHEN** email delivery configuration selects a non-sending adapter
- **THEN** the system SHALL fail closed or refuse startup/configuration validation for manager OTP delivery

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
