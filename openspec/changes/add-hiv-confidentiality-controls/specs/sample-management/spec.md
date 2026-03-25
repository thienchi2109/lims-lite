## ADDED Requirements

### Requirement: Authorized analyst HIV workflow continuity

The system SHALL preserve analyst workflow capability for confidential HIV-related samples when the analyst has explicit confidential authorization.

#### Scenario: Authorized analyst enters and submits confidential sample results

- **GIVEN** an authenticated analyst with `can_access_confidential = true`
- **AND** the sample contains confidential assay assignments
- **WHEN** the analyst enters results and submits the sample for review
- **THEN** the system SHALL allow result entry and review submission under existing status rules
- **AND** the sample SHALL transition through normal workflow states

#### Scenario: Unauthorized analyst is blocked from confidential result operations

- **GIVEN** an authenticated analyst without confidential authorization
- **AND** the sample contains confidential assay assignments
- **WHEN** the analyst attempts to view or mutate confidential result records
- **THEN** the system SHALL block access or mutation via backend policy enforcement

### Requirement: Manager approval requires confidential authorization

The system SHALL require confidential authorization for manager approval actions involving confidential assay results.

#### Scenario: Manager without confidential authorization cannot approve confidential results

- **GIVEN** an authenticated manager without `can_access_confidential = true`
- **AND** one or more target results are linked to confidential assays
- **WHEN** the manager attempts result approval
- **THEN** the system SHALL reject the approval request
- **AND** no result approval state changes SHALL be applied

#### Scenario: Manager with confidential authorization can approve confidential results

- **GIVEN** an authenticated manager with `can_access_confidential = true`
- **AND** target results satisfy existing workflow preconditions
- **WHEN** the manager approves confidential results
- **THEN** the system SHALL process approval using existing approval flow semantics

