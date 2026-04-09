## ADDED Requirements

### Requirement: Doctor role is excluded from global search
The system SHALL exclude doctors from dashboard search surfaces because doctor access is limited to the completed Samples workspace.

#### Scenario: Doctor dashboard header does not expose global search
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the `/samples` page renders its dashboard header
- **THEN** the system SHALL NOT render global search inputs, shortcuts, or search result dropdowns
- **AND** keyboard search shortcuts SHALL NOT open a search UI for the doctor

#### Scenario: Doctor search API calls are denied
- **GIVEN** an authenticated user has `role = 'doctor'`
- **WHEN** the user invokes sample search, client search, assay search, result search, audit-log search, or global search actions directly
- **THEN** the system SHALL reject the request
- **AND** the response SHALL NOT include search results, counts, snippets, or entity identifiers
