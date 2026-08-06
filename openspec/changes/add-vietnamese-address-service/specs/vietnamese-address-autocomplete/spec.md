## ADDED Requirements

### Requirement: Reusable administrative-address suggestion contract
Consumers SHALL be able to request Vietnamese administrative-address
suggestions through a reusable service contract without importing LIMS code or
accessing the service database.

#### Scenario: Consumer requests suggestions
- **WHEN** a server-side consumer submits valid administrative-only query text
- **THEN** it SHALL receive bounded suggestions containing canonical unit identity, hierarchy, match metadata, and dataset version
- **AND** it SHALL NOT send free-form detail or a complete client or CCCD-scanned address

#### Scenario: Consumer upgrades independently
- **WHEN** a consumer and service deploy on different schedules
- **THEN** the consumer SHALL validate required known `/v1` fields and tolerate unknown additive fields
- **AND** removing or changing a required field SHALL require a new API major version

### Requirement: Current and historical result presentation
Autocomplete consumers SHALL distinguish current canonical results from
historical aliases and ambiguous successor mappings.

#### Scenario: Current unit matches
- **WHEN** the query matches a current commune-level unit
- **THEN** the suggestion SHALL display its current commune and province names
- **AND** SHALL not require a district selection

#### Scenario: Historical alias has one successor
- **WHEN** the query matches a historical alias with one successor
- **THEN** the suggestion SHALL identify the old name
- **AND** present the current canonical replacement

#### Scenario: Historical alias has multiple successors
- **WHEN** the query matches a split or partial-merge relation with multiple successor candidates
- **THEN** the consumer SHALL present the candidates for explicit selection
- **AND** SHALL not silently choose one

### Requirement: Structured selection with display snapshot
Selecting an administrative suggestion SHALL produce both structured identity
and a human-readable formatted address snapshot suitable for consumer-owned
persistence.

#### Scenario: User selects a current suggestion
- **WHEN** a user selects a current administrative unit and provides optional address detail
- **THEN** the consumer SHALL receive address detail, province code, commune-level code, dataset version, administrative-selection source, and formatted display text
- **AND** the originating manual or CCCD input source SHALL remain independently representable

#### Scenario: Dataset changes later
- **WHEN** the service later activates a newer dataset
- **THEN** an already persisted consumer address SHALL retain its stored display snapshot and dataset version
- **AND** SHALL not be rewritten automatically

### Requirement: Manual entry remains first-class
Autocomplete SHALL assist address entry but SHALL never make a service match
mandatory for storing an address.

#### Scenario: No suitable suggestion exists
- **WHEN** the user cannot find a suitable administrative suggestion
- **THEN** the consumer SHALL allow manual free-text entry
- **AND** structured administrative codes MAY remain null

#### Scenario: User intentionally overrides a suggestion
- **WHEN** the user edits the formatted address or chooses manual mode
- **THEN** the consumer SHALL preserve the entered address
- **AND** SHALL emit explicit manual replacement intent that clears incompatible structured selection metadata

### Requirement: Service failure does not block consumer workflows
Consumers SHALL handle timeout, connection failure, invalid response, non-2xx
response, and unavailable readiness without blocking the owning workflow.

#### Scenario: Service times out
- **WHEN** the autocomplete request exceeds the consumer timeout
- **THEN** the consumer SHALL stop waiting and preserve manual entry
- **AND** SHALL not submit a second uncontrolled request storm

#### Scenario: Service response is invalid
- **WHEN** the response fails consumer schema validation
- **THEN** suggestions SHALL be treated as unavailable
- **AND** manual entry SHALL remain usable

#### Scenario: Service recovers
- **WHEN** a later request succeeds after an earlier failure
- **THEN** suggestions MAY resume without requiring a page reload
- **AND** existing manual input SHALL not be discarded

### Requirement: Higher-priority consumer data sources are not overwritten
Autocomplete consumers SHALL preserve explicit source precedence and SHALL not
allow stale suggestion responses to overwrite newer scanned or user-edited
values.

#### Scenario: Scanner auto-fill completes
- **WHEN** a consumer successfully validates and applies a CCCD scan
- **THEN** autocomplete SHALL not delay the auto-fill
- **AND** pending autocomplete ownership SHALL be invalidated so no pending or later suggestion response can silently replace the scanned address

#### Scenario: User explicitly normalizes a scanned address
- **WHEN** the user chooses an autocomplete result after a successful scan
- **THEN** the consumer MAY replace the administrative portion with the selected canonical unit
- **AND** the change SHALL be explicit and auditable in the owning application

#### Scenario: User edits after starting a search
- **WHEN** the user changes the address after an autocomplete request was issued
- **THEN** a later response for the older input SHALL not overwrite the newer value

### Requirement: Accessible Vietnamese autocomplete interaction
The reusable address field in LIMS SHALL provide Vietnamese labels, accessible
combobox/listbox semantics, keyboard navigation, mobile-compatible selection,
bounded announced states, and clear historical-result context.

#### Scenario: Keyboard user searches and selects
- **WHEN** a keyboard user enters a query and navigates suggestions
- **THEN** the combobox SHALL expose an accessible name, expanded state, active descendant, selection, and Escape dismissal without a pointer
- **AND** focus SHALL return deterministically after selection or dismissal

#### Scenario: Mobile user enters an address
- **WHEN** the field is used in the mobile accession flow
- **THEN** text, result rows, and controls SHALL fit without overlap or horizontal clipping

#### Scenario: Historical result is displayed
- **WHEN** a suggestion matched a former name
- **THEN** Vietnamese UI SHALL clearly identify it as a historical name
- **AND** display the current unit or explicit successor choices

#### Scenario: Search state changes
- **WHEN** search starts, returns results, returns no result, or fails
- **THEN** loading, result count, no-result, and error state SHALL be announced through an appropriate live region

### Requirement: Bounded consumer-side request behavior
Consumers SHALL debounce interactive search, cancel stale requests where
supported, enforce minimum query rules, and cache immutable reference responses
by dataset version.

#### Scenario: User types rapidly
- **WHEN** multiple query values are entered before the debounce interval ends
- **THEN** only the latest eligible query SHALL be issued
- **AND** cancellation SHALL propagate through the browser, same-origin handler, and service adapter where supported

#### Scenario: Older request completes after newer request
- **WHEN** an older response arrives after a newer query has been submitted
- **THEN** the consumer SHALL not replace newer suggestions with the stale response

#### Scenario: Province list is unchanged
- **WHEN** the active dataset version has not changed
- **THEN** the consumer MAY reuse its cached province list and ETag validation

#### Scenario: Search telemetry is recorded
- **WHEN** the consumer, same-origin proxy, or service records request telemetry
- **THEN** it SHALL exclude raw administrative query text and all free-form address detail
