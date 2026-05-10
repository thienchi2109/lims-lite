## ADDED Requirements

### Requirement: Assigned test snapshots preserve assay and method interpretation
The system SHALL preserve assay and method interpretation context when an assay/method pair is assigned to a sample so result rows and CoA reports do not depend solely on mutable assay configuration.

#### Scenario: Assignment captures assay and method snapshot
- **WHEN** a user assigns a test to a sample
- **THEN** the created analysis/result row SHALL store the selected assay ID and method ID
- **AND** it SHALL store the interpretation snapshot required by analysis management, including assay display name, method display name, unit, and applicable result range.

#### Scenario: Assay management change preserves existing assigned analyses
- **WHEN** a manager changes an assay definition, method relationship, unit, or result range
- **THEN** existing assigned analyses SHALL keep their stored interpretation snapshot
- **AND** new assignments SHALL use the updated assay/method configuration.

#### Scenario: Method removal respects historical usage
- **WHEN** a manager attempts to remove a method relationship that is referenced by existing analysis/result rows
- **THEN** the system SHALL preserve historical analysis interpretation
- **AND** it SHALL block destructive removal or require a soft-disabled relationship that remains available for audit and historical display.
