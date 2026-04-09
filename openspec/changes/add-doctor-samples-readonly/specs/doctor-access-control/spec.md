## ADDED Requirements

### Requirement: Doctor role is a least-privilege dashboard role
The system SHALL support a `doctor` role that is limited to completed sample review and shall not inherit analyst or manager operational permissions.

#### Scenario: Doctor is redirected to Samples after login
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the user completes login or visits `/login` while already authenticated
- **THEN** the system SHALL route the user to `/samples`
- **AND** the system SHALL NOT route the user to `/analyst` or `/manager`

#### Scenario: Doctor is blocked from non-Samples dashboard routes
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the user requests `/analyst`, `/manager`, `/profile`, or any nested route under those paths
- **THEN** the system SHALL deny or redirect the request away from that route
- **AND** the response SHALL NOT render analyst, manager, profile, or settings content

#### Scenario: Doctor cannot invoke operational client actions
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the user invokes client actions for sample mutation, result reads or writes, assignment, approvals, users, clients, assays, signatures, reports, QC, search, or CoA generation
- **THEN** the system SHALL reject the action before applying any mutation or returning broad operational data
- **AND** the rejection message SHALL be safe for display in Vietnamese UI contexts

### Requirement: Doctor access respects confidential authorization flag
The system SHALL use `users.can_access_confidential` to decide whether a doctor can see confidential/HIV-associated completed samples and CoAs.

#### Scenario: Doctor without confidential authorization cannot discover confidential completed sample
- **GIVEN** an authenticated doctor has `can_access_confidential = false`
- **AND** a completed sample is associated with a confidential assay
- **WHEN** the doctor lists samples or requests that sample directly
- **THEN** the system SHALL exclude or deny the sample with an authorization-neutral response
- **AND** the response SHALL NOT reveal that a confidential sample was hidden

#### Scenario: Doctor with confidential authorization can see confidential completed sample
- **GIVEN** an authenticated doctor has `can_access_confidential = true`
- **AND** a completed sample is associated with a confidential assay
- **WHEN** the doctor lists samples or opens that sample from `/samples`
- **THEN** the system SHALL include the sample according to the completed-only doctor rules
