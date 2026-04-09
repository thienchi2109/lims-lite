## ADDED Requirements

### Requirement: Doctor can preview ready CoA for authorized completed samples
The system SHALL allow doctors to preview ready CoA documents only for completed samples they are authorized to see.

#### Scenario: Doctor previews ready CoA for completed sample
- **GIVEN** an authenticated user has `role = 'doctor'`
- **AND** the requested sample has `status = 'completed'`
- **AND** the latest CoA report for that sample has `status = 'ready'`
- **WHEN** the doctor opens the CoA preview from `/samples`
- **THEN** the system SHALL render the CoA preview through the staff CoA view route
- **AND** the current Samples context SHALL remain available behind the preview

#### Scenario: Doctor cannot preview CoA for non-completed sample
- **GIVEN** an authenticated user has `role = 'doctor'`
- **AND** the requested sample has `status <> 'completed'`
- **WHEN** the doctor requests the staff CoA view route for that sample
- **THEN** the system SHALL reject the request
- **AND** the system SHALL NOT stream the CoA document or reveal operational sample data

#### Scenario: Doctor cannot generate or regenerate CoA
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the doctor invokes CoA generation or regeneration through UI, client action, or direct request
- **THEN** the system SHALL deny the operation
- **AND** no CoA report metadata or storage object SHALL be inserted, updated, deleted, or overwritten

#### Scenario: Doctor CoA preview respects confidential authorization
- **GIVEN** an authenticated doctor does not have confidential authorization
- **AND** the requested completed sample is associated with a confidential assay
- **WHEN** the doctor requests the staff CoA view route
- **THEN** the system SHALL return an authorization-neutral failure
- **AND** the system SHALL NOT disclose whether a confidential CoA exists
