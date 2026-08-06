## ADDED Requirements

### Requirement: CCCD scanning remains the primary accession data-entry path
When a supported scanner is available, the analyst accession workflow SHALL
preserve CCCD scanning as the preferred path for creating or selecting a
client. Address autocomplete SHALL remain secondary to successful scanner
auto-fill.

#### Scenario: Supported scanner is available
- **WHEN** the analyst begins client entry and a supported QR or Web Serial scanner is available
- **THEN** the workflow SHALL continue to offer the established scan action before manual address completion
- **AND** enabling autocomplete SHALL not hide or demote the scan action or remove the analyst's explicit manual-entry choice

#### Scenario: Valid CCCD scan succeeds
- **WHEN** the scanner produces a valid supported CCCD payload
- **THEN** the existing parser SHALL assign a new scan generation and immediately apply a scan-owned client draft including address
- **AND** duplicate lookup SHALL start afterward without waiting for or contacting the address service

#### Scenario: Current duplicate lookup finds an existing client
- **WHEN** duplicate lookup for the current scan generation finds an existing client before newer state takes ownership
- **THEN** the workflow MAY replace the provisional draft with that existing client
- **AND** SHALL preserve the existing duplicate-selection behavior

#### Scenario: Duplicate lookup becomes stale
- **WHEN** duplicate lookup completes after a newer scan, form reset, explicit client selection, dialog lifecycle change, or user edit takes ownership
- **THEN** the stale lookup SHALL NOT select a client or replace the newer form state

#### Scenario: Scanned address is accepted unchanged
- **WHEN** the analyst accepts the address supplied by a successful scan
- **THEN** the workflow SHALL allow client creation and accession without a successful autocomplete request
- **AND** the scanned address SHALL not be silently replaced

#### Scenario: Analyst normalizes a scanned address
- **WHEN** the analyst explicitly chooses to edit or normalize the scanned address
- **THEN** autocomplete MAY receive administrative-only query text and provide suggestions
- **AND** only an explicit selection SHALL replace the relevant administrative text while preserving the original scanned address as provenance

#### Scenario: Scanner is unavailable or scan fails
- **WHEN** no supported scanner is available or the scan cannot produce a valid client payload
- **THEN** the workflow SHALL allow autocomplete-assisted entry
- **AND** manual free-text entry SHALL remain available

### Requirement: Analyst can use Vietnamese address autocomplete during client entry
The analyst sample-accession flow SHALL offer the shared Vietnamese
administrative-address autocomplete when creating or editing the selected
client, while preserving the existing client-selection and authorization flow.

#### Scenario: Analyst manually creates a client
- **WHEN** an analyst opens the client form during accession and enters an address query
- **THEN** the form SHALL offer current and historical administrative suggestions through the shared consumer contract
- **AND** all visible labels and status text SHALL be Vietnamese

#### Scenario: CCCD scan supplies an address
- **WHEN** a valid CCCD QR scan supplies free-text address data
- **THEN** the address SHALL prefill the client form immediately as it does today
- **AND** the analyst MAY keep it, edit it, or use autocomplete to normalize its administrative portion

#### Scenario: Existing client is edited
- **WHEN** an authorized user edits an existing client from the accession flow
- **THEN** the current human-readable address and any structured metadata SHALL initialize the address field
- **AND** saving SHALL continue through the existing audited client mutation boundary

### Requirement: LIMS persists structured address provenance without invalidating existing clients
LIMS SHALL retain the formatted `clients.address` value and SHALL support
nullable address detail, structured administrative metadata, original input
source, administrative-selection source, and original scanned text when
normalization changes the formatted value.

#### Scenario: Autocomplete selection is saved
- **WHEN** an authorized LIMS mutation saves a selected administrative suggestion
- **THEN** it SHALL persist address detail, formatted address, province code, commune-level code, dataset version, input source, administrative-selection source, and required original scanned text atomically
- **AND** the existing client audit trigger SHALL record the mutation

#### Scenario: Manual address is saved
- **WHEN** a client address is entered manually without a suggestion
- **THEN** the formatted free-text address SHALL remain valid
- **AND** incompatible structured codes and dataset provenance SHALL be null

#### Scenario: Non-address fields are updated
- **WHEN** an authorized mutation uses `preserve` intent while changing fields unrelated to address
- **THEN** all existing address text and structured provenance SHALL remain unchanged

#### Scenario: Existing address is replaced manually
- **WHEN** an authorized mutation explicitly replaces the address using manual or CCCD intent
- **THEN** incompatible administrative codes, dataset version, and selection source SHALL be cleared atomically
- **AND** CCCD intent SHALL remain distinguishable from manual input

#### Scenario: Address payload is ambiguous
- **WHEN** formatted address text changes without preserve intent or a complete validated replacement
- **THEN** the server SHALL reject the payload or clear incompatible metadata according to the documented mutation contract
- **AND** stale codes SHALL NOT remain attached to the changed text

#### Scenario: Existing client predates structured metadata
- **WHEN** an existing client has an address but null structured fields
- **THEN** the client SHALL remain readable and editable
- **AND** no automatic backfill or forced conversion SHALL occur

#### Scenario: Address mutation is unauthorized
- **WHEN** a caller lacks the existing permission to update the client
- **THEN** the mutation SHALL be denied by the existing server authorization and RLS controls
- **AND** autocomplete availability SHALL not grant additional mutation rights

### Requirement: Address service availability does not gate accession
Client creation, authorized client editing, and sample accession SHALL remain
usable when the Vietnamese address service is unavailable.

#### Scenario: Address search fails before client creation
- **WHEN** the service times out, is unreachable, is not ready, or returns an invalid payload
- **THEN** the client form SHALL allow manual address entry
- **AND** the analyst SHALL still be able to create the client when all existing required fields are valid

#### Scenario: Service fails after a suggestion was selected
- **WHEN** a valid suggestion is already present and a later service request fails
- **THEN** the selected address data SHALL remain in the form
- **AND** sample accession SHALL not require another successful service call

#### Scenario: Service is disabled by configuration
- **WHEN** rollout mode is `off` or the authenticated principal is outside the `allowlist`
- **THEN** the client form SHALL use the existing manual address behavior
- **AND** no service request SHALL be made

### Requirement: LIMS uses a server-side service adapter
LIMS client components SHALL access address suggestions through the existing
client-action and `api-client` boundary. They SHALL not call the service's
Docker or Tailscale endpoint directly. Every address action SHALL authenticate
and authorize the current LIMS principal before any upstream call.

#### Scenario: Client component searches addresses
- **WHEN** the address field requests suggestions
- **THEN** it SHALL call a typed `api-client` wrapper
- **AND** the server-side action SHALL enforce role authorization, rollout mode, rate bounds, timeout, response validation, cancellation, and bounded administrative-only query parameters

#### Scenario: Caller is anonymous or unauthorized
- **WHEN** an unauthenticated caller or a role without client-entry permission requests address data
- **THEN** LIMS SHALL deny the request
- **AND** SHALL make zero calls to the address service

#### Scenario: Address query is prepared
- **WHEN** LIMS constructs an address-service request
- **THEN** it SHALL exclude house number, street detail, organization name, complete client address, and complete CCCD-scanned address
- **AND** raw query text SHALL NOT be written to LIMS or service telemetry

#### Scenario: Browser inspects application configuration
- **WHEN** client-side bundles and public environment variables are inspected
- **THEN** they SHALL not contain the service's private Docker hostname or Tailscale endpoint

### Requirement: Structured address migration preserves audit and RLS controls
The LIMS schema change SHALL use one new forward-only migration and SHALL
preserve client RLS, grants, audit logging, and existing data.

#### Scenario: Migration is applied
- **WHEN** the migration PR has merged, `/opt/lims-lite` is at the verified merged SHA, and the committed migration is executed through the approved home-server Docker PostgreSQL path
- **THEN** existing clients SHALL remain valid
- **AND** new structured fields SHALL be nullable and the migration identifier plus checksum SHALL be recorded

#### Scenario: Security verification runs
- **WHEN** the migration has been applied
- **THEN** `run_security_tests()` SHALL pass
- **AND** role-specific client read and mutation behavior SHALL remain unchanged except for the new nullable fields

#### Scenario: A migration correction is needed
- **WHEN** the migration has executed against any persistent database
- **THEN** it SHALL remain byte-for-byte immutable
- **AND** any correction SHALL use the next forward-only migration

#### Scenario: Existing deletion behavior is inspected
- **WHEN** the structured-address migration is reviewed or applied
- **THEN** it SHALL NOT add, widen, or rename client DELETE behavior as soft-delete behavior
- **AND** any client-deletion compliance correction SHALL require a separate approved change

### Requirement: Sample address snapshot semantics remain unchanged
This change SHALL not alter the existing rule by which sample, result, or CoA
surfaces resolve the client address.

#### Scenario: Client address changes after accession
- **WHEN** an authorized user changes the client address after a sample was received
- **THEN** existing downstream behavior SHALL remain unchanged by this capability
- **AND** accession-time address snapshotting SHALL require a separate approved change
