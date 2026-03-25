## ADDED Requirements

### Requirement: Assay confidentiality classification

The system SHALL allow managers to classify assay definitions as confidential so downstream access controls can enforce sensitive-data restrictions.

#### Scenario: Manager marks assay as confidential

- **GIVEN** an authenticated manager user
- **WHEN** the manager creates or updates an assay definition and enables confidential classification
- **THEN** the system SHALL persist `is_confidential = true` for that assay definition
- **AND** subsequent result access decisions SHALL evaluate this confidential flag

#### Scenario: Non-manager cannot alter confidential classification

- **GIVEN** an authenticated user without manager role
- **WHEN** the user attempts to create or update assay confidentiality classification
- **THEN** the system SHALL reject the operation through existing authorization controls

