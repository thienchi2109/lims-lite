## ADDED Requirements

### Requirement: Manager step-up state follows session lifecycle
The system SHALL treat manager email OTP step-up state as part of the authenticated session lifecycle and SHALL never allow it to outlive the underlying authenticated session.

#### Scenario: Session expiry clears manager step-up state
- **GIVEN** a manager has valid email OTP step-up state
- **AND** the underlying authenticated session reaches the configured hard session timebox
- **WHEN** the system expires the session
- **THEN** the system SHALL clear the manager step-up state
- **AND** redirect the user to `/login?reason=session_expired`

#### Scenario: Logout clears manager step-up state
- **GIVEN** a manager has valid email OTP step-up state
- **WHEN** the manager logs out
- **THEN** the system SHALL clear both the Supabase authentication session and the manager step-up state

#### Scenario: Password-only manager session cannot call manager actions
- **GIVEN** a user with role `manager` has a valid password-authenticated session
- **AND** the session does not have valid manager email OTP step-up state
- **WHEN** the user calls a manager-only Server Action or `/api/client-actions` operation
- **THEN** the system SHALL deny the operation and require email OTP step-up
