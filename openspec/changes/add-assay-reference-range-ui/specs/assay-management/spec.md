## ADDED Requirements

### Requirement: Manager can maintain assay reference range text

The system SHALL allow managers to add, update, view, and clear optional reference range text on assay definitions.

#### Scenario: Manager creates assay with reference range

- **GIVEN** an authenticated manager is creating an assay definition
- **WHEN** the manager enters text in `Khoảng tham chiếu` and saves
- **THEN** the system SHALL persist the value in `assay_definitions.normal_range`
- **AND** the system SHALL show the saved reference range when the assay is viewed or edited again

#### Scenario: Manager updates assay reference range

- **GIVEN** an authenticated manager is editing an existing assay definition
- **WHEN** the manager changes the `Khoảng tham chiếu` text and saves
- **THEN** the system SHALL persist the new reference range for that assay definition
- **AND** future CoA generation for results using that assay SHALL use the updated reference range text

#### Scenario: Manager clears assay reference range

- **GIVEN** an authenticated manager is editing an assay definition with a saved reference range
- **WHEN** the manager clears the `Khoảng tham chiếu` field and saves
- **THEN** the system SHALL store `NULL` for `assay_definitions.normal_range`
- **AND** future CoA generation for results using that assay SHALL render an empty reference range cell

#### Scenario: Non-manager cannot change reference range

- **GIVEN** an authenticated user without manager role attempts to create or update assay reference range text
- **WHEN** the request reaches the server action or database policy boundary
- **THEN** the system SHALL reject the mutation using the existing manager-only authorization model

### Requirement: Reference range entry remains free-form display text

The system SHALL treat assay reference range values as optional free-form display text, preserving line breaks and not parsing clinical rules in this MVP.

#### Scenario: Manager enters multi-line reference range

- **GIVEN** an authenticated manager is editing an assay definition
- **WHEN** the manager enters a multi-line value such as sex-specific reference ranges
- **THEN** the system SHALL preserve the text content for storage and future CoA rendering

#### Scenario: UI guides reference range input format

- **GIVEN** an authenticated manager is creating or editing an assay definition
- **WHEN** the `Khoảng tham chiếu` field is empty
- **THEN** the system SHALL show Vietnamese placeholder examples for multi-line numeric ranges and qualitative values

### Requirement: Historical CoA files remain unchanged after reference range edits

The system SHALL NOT mutate existing generated CoA HTML files when an assay reference range changes.

#### Scenario: Existing CoA remains unchanged

- **GIVEN** a CoA has already been generated and stored as HTML
- **WHEN** a manager updates the reference range for an assay included in that CoA
- **THEN** the stored CoA file SHALL remain unchanged
- **AND** only newly generated or regenerated CoAs SHALL use the updated reference range
