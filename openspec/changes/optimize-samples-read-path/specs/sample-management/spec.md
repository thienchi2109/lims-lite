## ADDED Requirements

### Requirement: Selected sample core data SHALL use a shared cache-first read path

The system SHALL load the selected sample's core data in `/samples` through a shared query contract keyed by `sampleId`, so the detail panel and assigned-results panel can reuse one core payload instead of coordinating independent fetch sequences.

#### Scenario: Selecting a sample hydrates both bottom-row panels from one core contract

- **WHEN** a user selects a sample row in `/samples`
- **THEN** the system SHALL resolve the selected sample's core payload through one stable contract keyed by that `sampleId`
- **AND** both the detail panel and assigned-results panel SHALL derive their initial render from that shared core payload
- **AND** the assigned-results panel SHALL NOT wait for the detail panel component to finish mounting before its core data can start resolving

#### Scenario: Returning to a recently viewed sample reuses cache

- **WHEN** a user re-selects a sample whose core payload is still fresh in the current session
- **THEN** the system SHALL render that sample from cache immediately
- **AND** the system MAY refetch in the background to refresh stale fields
- **AND** the bottom row SHALL NOT blank both panels while cached core data is available

#### Scenario: Concurrent consumers do not duplicate the core selection fetch

- **WHEN** multiple `/samples` panels need the same selected sample core data during one interaction window
- **THEN** the system SHALL deduplicate the core read path for that `sampleId`
- **AND** the UI SHALL NOT issue redundant core selection fetches only because multiple panels render together

### Requirement: Sample switching SHALL preserve working context while the next selection loads

The system SHALL keep the previous selected sample visible until the next selected sample has enough core data to replace it, so rapid row switching does not collapse the bottom-row workspace into a full blank loading state.

#### Scenario: Switching between samples keeps previous content visible during transition

- **WHEN** a user selects sample B while sample A is still visible in the bottom row
- **THEN** the system SHALL keep sample A visible until sample B has core selection data ready to render
- **AND** the UI SHALL show a localized transition/loading state that indicates sample B is loading
- **AND** the grid selection state SHALL still move to sample B immediately

#### Scenario: First load still shows loading state when no prior selection exists

- **WHEN** a user selects a sample and there is no prior selected sample available in cache or UI state
- **THEN** the system SHALL show a loading state for the bottom row until the selected sample's core payload is ready
- **AND** the loading state SHALL be localized in Vietnamese

### Requirement: Non-critical enrichment SHALL NOT block first useful render for a selected sample

The system SHALL render core sample detail and assigned results before optional enrichment data such as QC status, CoA status, activity feed, or fallback client reads completes.

#### Scenario: Optional enrichment loads after core content

- **WHEN** a selected sample's core payload is available
- **THEN** the system SHALL render the sample detail and assigned results without waiting for optional enrichment queries to finish
- **AND** enrichment queries SHALL run independently from the first useful render of the selected sample

#### Scenario: Enrichment failure is isolated from core sample content

- **WHEN** a selected sample's core payload loads successfully but an optional enrichment query fails or is delayed
- **THEN** the system SHALL keep the core sample detail and assigned results visible
- **AND** the system SHALL show a localized loading or error state only in the affected enrichment region
- **AND** the user SHALL remain able to switch to another sample normally

#### Scenario: Embedded client data avoids a redundant blocking read

- **WHEN** the selected sample payload already contains the client information required by the detail panel
- **THEN** the system SHALL use that embedded client data for the initial detail render
- **AND** it SHALL NOT block the core detail panel on an additional client fetch before showing selected sample information
