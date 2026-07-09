## ADDED Requirements

### Requirement: Analyst HIV step-up state follows session lifecycle
The system SHALL bind analyst HIV email OTP step-up state to the authenticated session and clear or reject it when that session is no longer valid.

#### Scenario: Session expiry clears analyst HIV step-up state
- **GIVEN** an analyst HIV user has completed OTP step-up
- **AND** the authenticated session exceeds the configured session timebox
- **WHEN** the user requests a protected route
- **THEN** the system SHALL clear authentication and step-up state and redirect the user to login with the existing session-expired behavior

#### Scenario: Logout clears analyst HIV step-up state
- **GIVEN** an analyst HIV user has completed OTP step-up
- **WHEN** the user logs out
- **THEN** the system SHALL clear the analyst HIV step-up cookie or equivalent server-verifiable step-up state

#### Scenario: Password-only analyst HIV session cannot access protected analyst HIV surfaces
- **GIVEN** `ANALYST_HIV_EMAIL_OTP_ENABLED` is `TRUE`
- **AND** an analyst with `can_access_confidential = true` has a password-authenticated session but no valid OTP step-up state
- **WHEN** the user requests protected analyst routes or actions that require the current authenticated analyst session
- **THEN** the system SHALL redirect the user to OTP verification or reject the action until OTP step-up succeeds

#### Scenario: Analyst HIV step-up state is invalidated when OTP email changes
- **GIVEN** an analyst HIV user has completed OTP step-up
- **WHEN** the user's OTP destination email metadata changes
- **THEN** the system SHALL reject existing step-up state and require a new OTP verification for the current or next session
