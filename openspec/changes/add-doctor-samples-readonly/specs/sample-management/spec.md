## ADDED Requirements

### Requirement: Doctor Samples workspace is completed-only and read-only
The unified `/samples` workspace SHALL support doctors with a completed-only, read-only sample review experience.

#### Scenario: Doctor sees only completed samples in Samples workspace
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the user opens `/samples`
- **THEN** the system SHALL show only non-deleted samples with `status = 'completed'`
- **AND** the system SHALL NOT show samples with `status <> 'completed'`
- **AND** URL filters or query parameters SHALL NOT expand doctor visibility beyond completed samples

#### Scenario: Doctor cannot directly open a non-completed sample
- **GIVEN** an authenticated user has `role = 'doctor'`
- **AND** a sample has `status <> 'completed'`
- **WHEN** the doctor requests the sample detail API or opens `/samples?sampleId=<id>` for that sample
- **THEN** the system SHALL deny the sample with a not-found or equivalent authorization-neutral response
- **AND** the UI SHALL NOT display sample metadata or results for that sample

#### Scenario: Doctor has no sample mutation controls
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the doctor views `/samples`
- **THEN** the system SHALL hide or disable edit, delete, discard, assignment, result entry, review submission, IQC, generate CoA, regenerate CoA, raw result table, profile, settings, and dashboard navigation actions
- **AND** backend policies and API guards SHALL reject those operations if invoked directly

#### Scenario: Doctor can inspect completed sample metadata and CoA readiness
- **GIVEN** an authenticated user has `role = 'doctor'`
- **AND** a visible sample has `status = 'completed'`
- **WHEN** the doctor selects the sample in `/samples`
- **THEN** the system SHALL show read-only sample metadata
- **AND** the system SHALL show whether a ready CoA is available
- **AND** the system SHALL NOT render the assigned-tests or raw-results workspace
