## ADDED Requirements

### Requirement: Server-mediated current address suggestions

LIMS SHALL request current province and commune suggestions through an
authenticated same-origin server boundary. Browser code SHALL NOT call the
address service or know its private Tailscale URL.

#### Scenario: Authorized user searches

- **WHEN** an authorized LIMS user enters a bounded administrative query
- **THEN** the LIMS server adapter SHALL call the private address service
- **AND** return only bounded current administrative suggestions

#### Scenario: Caller is unauthorized

- **WHEN** an anonymous or unauthorized caller requests suggestions
- **THEN** LIMS SHALL reject the request before contacting the address service

### Requirement: Selection uses the existing address field

Selecting a current commune and province SHALL produce a human-readable address
string for the existing client address field. The integration SHALL NOT require
new structured-address database columns.

#### Scenario: User selects a suggestion

- **WHEN** the user selects a current commune and province
- **THEN** the form SHALL update the existing address text
- **AND** save it through the existing authorized client mutation

#### Scenario: User edits selected text

- **WHEN** the user edits the formatted address after selection
- **THEN** the edited text SHALL remain user-owned
- **AND** no stale suggestion SHALL overwrite it

### Requirement: Manual entry remains available

Autocomplete SHALL be optional and SHALL not gate client creation or sample
accession.

#### Scenario: Service is unavailable

- **WHEN** the address service is disabled, unreachable, slow, or returns an
  invalid response
- **THEN** LIMS SHALL keep manual address entry available
- **AND** existing valid workflows SHALL continue

#### Scenario: No suitable result exists

- **WHEN** no suggestion matches the intended address
- **THEN** the user SHALL be able to keep or enter free text

### Requirement: Bounded and privacy-safe client behavior

LIMS SHALL debounce searches, cancel or ignore stale requests, enforce minimum
query and result limits, and send administrative query text only. It SHALL not
send client records, sample records, CCCD payloads, or complete free-form
addresses to the service.

#### Scenario: User types rapidly

- **WHEN** several searches are started in sequence
- **THEN** older requests SHALL be cancelled or ignored
- **AND** only the newest valid response MAY update suggestions

#### Scenario: Telemetry is recorded

- **WHEN** LIMS records adapter telemetry
- **THEN** it SHALL record bounded metadata such as route, status, duration, and
  result count
- **AND** omit raw query text and address values
