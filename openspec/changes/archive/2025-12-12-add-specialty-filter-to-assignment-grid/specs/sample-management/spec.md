## ADDED Requirements
### Requirement: Analyst can filter assays by specialty during assignment

The system SHALL allow analysts to quickly filter available assay definitions by “Nhóm xét nghiệm” when assigning tests in the accession workflow.

#### Scenario: Analyst filters tests by specialty

- **GIVEN** an authenticated analyst is on `/analyst/accession` and viewing the Test Assignment Grid  
- **WHEN** the analyst selects a specific specialty from the “Nhóm xét nghiệm” filter  
- **THEN** the grid SHALL request assays filtered server-side by that specialty  
- **AND** only assays linked to the selected specialty SHALL be displayed  
- **AND** the specialty badge SHALL be shown per assay row  
- **AND** any tests already selected SHALL remain selected even if they are not visible under the filter.

#### Scenario: Analyst clears the specialty filter

- **GIVEN** the “Nhóm xét nghiệm” filter is set to a specific specialty  
- **WHEN** the analyst selects “Tất cả nhóm xét nghiệm”  
- **THEN** the grid SHALL display assays from all specialties (including assays with no specialty).
