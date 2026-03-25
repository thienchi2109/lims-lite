## ADDED Requirements

### Requirement: Authorized analyst HIV workflow continuity

The system SHALL preserve analyst workflow capability for confidential HIV-related samples when the analyst has explicit confidential authorization.

#### Scenario: Authorized analyst can discover and process confidential sample work

- **GIVEN** an authenticated analyst with `can_access_confidential = true`
- **AND** the sample contains confidential assay assignments
- **WHEN** the analyst views sample queues, opens the sample, enters results, and submits the sample for review
- **THEN** the system SHALL allow the confidential-associated sample to appear in the analyst's permitted workflow
- **AND** result entry and review submission SHALL follow existing status rules
- **AND** the sample SHALL transition through normal workflow states

### Requirement: Unauthorized users cannot discover confidential-associated samples through sample workflows

The system SHALL hide confidential-associated samples from operational sample lists, work queues, and direct sample lookups when the caller lacks confidential authorization.

#### Scenario: Unauthorized user cannot find confidential sample in workspace

- **GIVEN** an authenticated analyst or manager without confidential authorization
- **AND** the sample contains confidential assay assignments
- **WHEN** the user loads a sample list, pending-work queue, or exact sample-identifier filter that would otherwise match that sample
- **THEN** the system SHALL exclude the confidential-associated sample from the response
- **AND** the UI and API SHALL NOT reveal that a confidential-associated sample was omitted

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
