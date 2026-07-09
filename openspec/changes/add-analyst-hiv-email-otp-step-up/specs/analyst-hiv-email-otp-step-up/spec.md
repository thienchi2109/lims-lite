## ADDED Requirements

### Requirement: Analyst HIV email OTP step-up is required after password login
The system SHALL require email OTP step-up after successful password authentication for users with `role = analyst` and `can_access_confidential = true` when `ANALYST_HIV_EMAIL_OTP_ENABLED` is `TRUE`.

#### Scenario: Analyst HIV password login requires OTP verification
- **GIVEN** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** an analyst has `can_access_confidential = true`
- **AND** the analyst has an admin-configured OTP destination email
- **WHEN** the analyst successfully authenticates with username/email and password
- **THEN** the system SHALL redirect the analyst to email OTP verification before showing the analyst dashboard

#### Scenario: Analyst HIV OTP disabled allows password-only analyst session
- **GIVEN** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `FALSE`
- **AND** an analyst has `can_access_confidential = true`
- **WHEN** the analyst successfully authenticates with username/email and password
- **THEN** the system SHALL allow the existing analyst login flow without OTP step-up

#### Scenario: Standard analyst is not blocked by analyst HIV OTP
- **GIVEN** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** an analyst has `can_access_confidential != true`
- **WHEN** the analyst successfully authenticates with username/email and password
- **THEN** the system SHALL allow the existing analyst login flow without OTP step-up

#### Scenario: Analyst HIV without OTP destination fails closed
- **GIVEN** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** an analyst has `can_access_confidential = true`
- **AND** the analyst does not have an admin-configured OTP destination email
- **WHEN** the analyst successfully authenticates with username/email and password
- **THEN** the system SHALL deny access to the analyst dashboard and show Vietnamese guidance to contact an administrator

### Requirement: Analyst HIV OTP uses the existing challenge security controls
The system SHALL protect analyst HIV OTP challenges with the same security controls used by manager OTP challenges: server-side hashed codes, short expiration, one-time use, resend cooldown, attempt limits, lockout behavior, and no plaintext OTP logging.

#### Scenario: Analyst HIV OTP challenge is generated securely
- **WHEN** an analyst HIV OTP challenge is created
- **THEN** the system SHALL store only a hashed OTP code with expiration, resend, attempt, and lockout metadata

#### Scenario: Analyst HIV OTP verification creates step-up state
- **GIVEN** an analyst HIV user has a valid active OTP challenge
- **WHEN** the user submits the correct unexpired OTP code
- **THEN** the system SHALL create server-verifiable step-up state for the current session and permit access to the normal analyst UI

#### Scenario: Invalid analyst HIV OTP does not grant access
- **GIVEN** an analyst HIV user has an OTP challenge
- **WHEN** the user submits an invalid, expired, reused, or locked OTP code
- **THEN** the system SHALL NOT create step-up state and SHALL keep the user out of protected analyst-HIV access

### Requirement: Analyst HIV OTP enforcement is controlled by a dedicated cohort flag
The system SHALL control analyst HIV OTP enforcement only through `ANALYST_HIV_EMAIL_OTP_ENABLED`, independent of manager OTP flags.

#### Scenario: Analyst HIV flag does not affect managers
- **GIVEN** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** both manager OTP flags are `FALSE`
- **WHEN** a manager logs in
- **THEN** the system SHALL NOT require manager OTP because of the analyst flag

#### Scenario: Manager HIV flag does not affect analysts
- **GIVEN** `MANAGER_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `FALSE`
- **WHEN** an analyst with `can_access_confidential = true` logs in
- **THEN** the system SHALL NOT require analyst OTP because of the manager flag

### Requirement: Analyst HIV OTP lifecycle is auditable
The system SHALL audit analyst HIV OTP lifecycle events and admin OTP email changes without storing or logging plaintext OTP codes.

#### Scenario: Analyst HIV OTP delivery and verification are audited
- **WHEN** the system sends, verifies, rejects, locks, or expires an analyst HIV OTP challenge
- **THEN** the system SHALL record an audit event that identifies the user, event type, timestamp, and outcome without including the plaintext OTP code

#### Scenario: Analyst HIV OTP destination changes are audited
- **WHEN** an administrator creates or updates an analyst HIV OTP destination email
- **THEN** the system SHALL record an audit event for the change without exposing unnecessary full email details in user-facing UI
