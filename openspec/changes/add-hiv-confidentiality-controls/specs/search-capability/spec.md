## ADDED Requirements

### Requirement: Confidentiality-aware search results

The search capability SHALL enforce confidential-data authorization so unauthorized users cannot discover or retrieve HIV-confidential records through search surfaces.

#### Scenario: Unauthorized user cannot discover confidential HIV results in search

- **GIVEN** an authenticated user without confidential authorization
- **WHEN** the user executes result search or global search queries
- **AND** matching records include confidential-assay result data
- **THEN** the system SHALL exclude confidential matches from search output
- **AND** no confidential identifiers or values SHALL be returned

#### Scenario: Authorized user can search confidential HIV results

- **GIVEN** an authenticated user with confidential authorization
- **WHEN** the user executes result search or global search queries
- **THEN** the system SHALL include confidential matches permitted by role and RLS
- **AND** ranking and filtering behavior SHALL remain consistent with existing search semantics

### Requirement: Confidential-safe client search in restricted contexts

Search responses that may reveal sensitive client identity linked to confidential assays SHALL apply confidentiality safeguards.

#### Scenario: Unauthorized user receives confidentiality-safe client search output

- **GIVEN** an authenticated user without confidential authorization
- **WHEN** client or global search intersects confidential-sample context
- **THEN** the system SHALL return only confidentiality-safe output (redacted or excluded as configured)
- **AND** avoid leaking confidential status through descriptive snippets

