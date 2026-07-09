## ADDED Requirements

### Requirement: Manager user management shows analyst signature readiness
The system SHALL show electronic signature readiness for every active user role that can own signatures, including analysts and managers, while avoiding a signature requirement indicator for doctors.

#### Scenario: Analyst with active signature appears ready
- **WHEN** a manager views `/manager/users` and an analyst row has at least one active signature
- **THEN** the row SHALL indicate in Vietnamese that the analyst has an electronic signature

#### Scenario: Analyst without active signature appears incomplete
- **WHEN** a manager views `/manager/users` and an analyst row has no active signature
- **THEN** the row SHALL indicate in Vietnamese that the analyst is missing an electronic signature

#### Scenario: Doctor row has no signature requirement
- **WHEN** a manager views `/manager/users` and the row belongs to a doctor
- **THEN** the row SHALL not imply that an electronic signature is required for that doctor

### Requirement: Manager create-analyst flow explains self-service signature upload
The system SHALL not collect an analyst signature file from the manager during analyst account creation. It SHALL explain that the analyst must log in and upload their own electronic signature before signature-gated work.

#### Scenario: Manager selects analyst role during creation
- **WHEN** a manager opens the create-user dialog and selects the analyst role
- **THEN** the form SHALL show Vietnamese guidance that the analyst uploads their own signature from the profile area after login

#### Scenario: Manager creates analyst account
- **WHEN** a manager submits a valid create-user form for an analyst
- **THEN** the create-user payload SHALL not include a signature file or target-user signature upload request

### Requirement: Analyst without signature receives actionable guidance
The system SHALL guide analysts without an active signature to upload their own signature before attempting work that requires an electronic signature.

#### Scenario: Analyst opens profile without active signature
- **WHEN** an analyst without an active signature opens the profile page
- **THEN** the page SHALL show Vietnamese guidance that uploading an electronic signature is required before submitting samples for review

#### Scenario: Analyst attempts submit without active signature
- **WHEN** an analyst attempts to submit a sample for review without an active signature
- **THEN** the user-facing error or warning SHALL tell the analyst to upload the signature from the profile area

### Requirement: Signature ownership boundary remains self-owned
The system SHALL preserve the current-user-only electronic signature ownership boundary for analyst onboarding.

#### Scenario: Signature upload stores current authenticated owner
- **WHEN** a manager creates an analyst account
- **THEN** the system SHALL NOT upload or activate a signature for the analyst from the manager session

#### Scenario: Analyst uploads own signature
- **WHEN** the analyst logs in and uploads a valid signature file
- **THEN** the signature SHALL be stored as that analyst's active signature under the existing upload path and RLS/storage ownership rules
