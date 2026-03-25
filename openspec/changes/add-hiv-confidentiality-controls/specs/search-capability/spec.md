## ADDED Requirements

### Requirement: Confidentiality-aware search results

The search capability SHALL enforce confidential-data authorization so unauthorized users cannot discover or confirm confidential-associated HIV records through search surfaces.

#### Scenario: Unauthorized user gets zero confidential-only matches in search

- **GIVEN** an authenticated user without confidential authorization
- **WHEN** the user executes result, sample, client, or global search queries
- **AND** the only matching records are linked to confidential assays
- **THEN** the system SHALL return zero confidential-associated matches
- **AND** no confidential identifiers, counts, snippets, or error details SHALL confirm hidden records exist

#### Scenario: Authorized user can search confidential HIV results

- **GIVEN** an authenticated user with confidential authorization
- **WHEN** the user executes result search or global search queries
- **THEN** the system SHALL include confidential matches permitted by role and RLS
- **AND** ranking and filtering behavior SHALL remain consistent with existing search semantics

### Requirement: Confidential-safe client search in restricted contexts

Search responses that intersect both visible and confidential-associated records SHALL preserve normal search behavior for permitted matches without leaking hidden confidential context.

#### Scenario: Unauthorized user sees only permitted mixed-context matches

- **GIVEN** an authenticated user without confidential authorization
- **WHEN** client, sample, or global search intersects both non-confidential and confidential-associated records
- **THEN** the system SHALL return only the permitted non-confidential matches
- **AND** ranking, counts, and descriptive snippets SHALL NOT reveal that additional confidential-associated records were hidden
