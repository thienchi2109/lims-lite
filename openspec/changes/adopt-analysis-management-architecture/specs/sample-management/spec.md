## ADDED Requirements

### Requirement: Sample status reflects aggregate analysis lifecycle
The system SHALL derive sample review and completion eligibility from active reportable analysis lifecycles without collapsing sample status and analysis status into the same state machine.

#### Scenario: Sample remains in progress while analyses are incomplete
- **WHEN** a sample has one or more active reportable analyses in `pending`, `entered`, or `rejected` lifecycle states
- **THEN** the sample SHALL remain in an editable workflow state such as `in_progress`
- **AND** the system SHALL deny review submission until required analyses are valid and submitted.

#### Scenario: Sample enters review after all reportable analyses are submitted
- **WHEN** all active reportable analyses for a sample are submitted through the controlled workflow
- **THEN** the sample SHALL move to `review`
- **AND** manager approval views SHALL show the submitted analysis rows from the shared workbench payload.

#### Scenario: Sample completion requires approved reportable analyses
- **WHEN** a manager attempts to complete or approve a reviewed sample
- **THEN** the system SHALL verify that all active reportable analyses are approved or explicitly non-reportable
- **AND** the system SHALL deny completion when required analysis approval is missing.

### Requirement: CoA readiness uses analysis lifecycle and snapshots
The system SHALL evaluate CoA readiness from approved analysis rows and their stored interpretation snapshots.

#### Scenario: CoA generation uses approved analysis rows
- **WHEN** a sample becomes eligible for CoA generation
- **THEN** CoA generation SHALL fetch approved active reportable analyses
- **AND** it SHALL use their stored assay/method/unit/range snapshots for report rendering.

#### Scenario: CoA generation fails safely when analysis context is incomplete
- **WHEN** required approved analysis context is missing or inconsistent
- **THEN** CoA generation SHALL record a retryable failure visible to managers
- **AND** it SHALL NOT silently generate a report with partial or dynamically reinterpreted result data.
