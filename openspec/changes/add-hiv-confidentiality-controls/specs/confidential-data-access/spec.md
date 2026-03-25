## ADDED Requirements

### Requirement: Confidential assay access authorization

The system SHALL classify sensitive assays as confidential and enforce that only explicitly authorized users can access associated result data.

#### Scenario: Unauthorized user cannot view confidential HIV results

- **GIVEN** an authenticated user without confidential authorization
- **AND** a sample has at least one result for an assay marked `is_confidential = true`
- **WHEN** the user queries result data for that sample
- **THEN** the system SHALL exclude confidential result rows from the response
- **AND** the system SHALL enforce this restriction at row-level security layer

#### Scenario: Authorized user can view confidential HIV results

- **GIVEN** an authenticated user with `can_access_confidential = true`
- **AND** a sample has results for an assay marked `is_confidential = true`
- **WHEN** the user queries result data for that sample
- **THEN** the system SHALL return confidential result rows according to existing workflow permissions

#### Scenario: Confidential write operation requires authorization

- **GIVEN** an authenticated analyst user without confidential authorization
- **WHEN** the user attempts to insert or update a result linked to a confidential assay
- **THEN** the system SHALL reject the operation via RLS
- **AND** no confidential result mutation SHALL be persisted

### Requirement: Confidential sample detail redaction

The system SHALL protect sensitive client fields in sample detail responses when the sample context includes confidential assays and the caller lacks confidential authorization.

#### Scenario: Unauthorized user receives redacted client fields

- **GIVEN** an authenticated user without confidential authorization
- **AND** the requested sample is associated with at least one confidential assay
- **WHEN** the sample detail API is requested
- **THEN** the system SHALL return a payload with sensitive client fields redacted or omitted
- **AND** non-sensitive operational fields required for workflow continuity SHALL remain available

#### Scenario: Authorized user receives full client fields

- **GIVEN** an authenticated user with confidential authorization
- **WHEN** the sample detail API is requested for a confidential-associated sample
- **THEN** the system SHALL return full client detail fields according to existing permitted schema

### Requirement: Confidential access auditability

The system SHALL provide verifiable evidence for confidential access controls and usage paths.

#### Scenario: Security verification includes confidential controls

- **GIVEN** confidentiality controls are deployed
- **WHEN** the security verification suite is executed
- **THEN** the suite SHALL validate presence of confidentiality schema, helper function, and policy predicates
- **AND** include at least one unauthorized-negative and authorized-positive access check

#### Scenario: Confidential exports are auditable

- **GIVEN** a user performs an anonymized epidemiology/research export
- **WHEN** the export completes or fails
- **THEN** the system SHALL log actor, timestamp, scope, and outcome in an audit trail

