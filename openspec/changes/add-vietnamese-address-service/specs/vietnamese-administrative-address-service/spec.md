## ADDED Requirements

### Requirement: Independently owned Go and SQLite service
The system SHALL provide Vietnamese administrative-address reference data from
an independently versioned Go service implemented in a separate
`vietnamese-address-service` repository. Consumers SHALL use its versioned HTTP
contract and SHALL NOT query its SQLite schema directly.

#### Scenario: Service repository is independent from LIMS
- **WHEN** the service foundation is initialized
- **THEN** it SHALL have its own Go module, releases, OpenSpec artifacts, local Go verification, and operational documentation
- **AND** no service implementation code SHALL be placed in the `lims-lite` application runtime

#### Scenario: Future application integrates
- **WHEN** another internal application needs administrative-address data
- **THEN** it SHALL integrate through the versioned service API
- **AND** it SHALL NOT require LIMS database access or LIMS deployment

### Requirement: Immutable versioned SQLite dataset
Every approved service release SHALL contain or reference one generated SQLite
snapshot that is opened read-only at runtime. The active dataset SHALL be
identifiable and reproducible from versioned provenance.

#### Scenario: Service starts with a valid snapshot
- **WHEN** the service process starts
- **THEN** it SHALL open the packaged SQLite database read-only
- **AND** verify integrity and required dataset metadata before reporting ready

#### Scenario: Runtime attempts to mutate reference data
- **WHEN** application code or a request attempts to modify the production SQLite dataset
- **THEN** the operation SHALL fail
- **AND** the service SHALL NOT create a writable replacement file

#### Scenario: Dataset version is inspected
- **WHEN** an internal consumer requests dataset metadata
- **THEN** the service SHALL return the API representation version, service version, active dataset version, effective date, source artifact identifiers, row counts, build timestamp, checksum identifiers, and provenance reference
- **AND** it SHALL NOT expose filesystem paths, credentials, or internal stack traces

### Requirement: Authoritative and cross-checked dataset generation
The dataset builder SHALL treat official Vietnamese administrative-unit data,
history, and old-to-new conversion artifacts as authoritative and SHALL use a
pinned normalized community dataset as a secondary cross-check.

#### Scenario: Sources agree and validation passes
- **WHEN** source content changes and all structural, referential, provenance, and regression validations pass
- **THEN** the builder SHALL generate a new immutable SQLite snapshot
- **AND** retain immutable raw source artifacts, retrieval metadata, parser/toolchain versions, source and output checksums, and applicable source terms in its release evidence

#### Scenario: Required source is unavailable
- **WHEN** a required source cannot be downloaded or parsed
- **THEN** no new dataset release SHALL be prepared
- **AND** the currently deployed dataset SHALL remain active

#### Scenario: Sources materially disagree
- **WHEN** official and secondary current-unit records disagree outside an explicitly reviewed allow-list
- **THEN** the update SHALL fail closed
- **AND** no production rollout SHALL occur

#### Scenario: Administrative counts change legitimately
- **WHEN** a later authoritative release changes province or commune counts
- **THEN** validation SHALL compare against that release's manifest and relationships
- **AND** SHALL NOT reject the release solely because it differs from a permanently hard-coded historical count

#### Scenario: Material semantic drift is detected
- **WHEN** a source introduces a new schema, unexplained relationship class, code reuse, or material disagreement outside reviewed policy
- **THEN** release preparation SHALL fail closed
- **AND** a new release SHALL require a reviewed manifest or allow-list change in the service repository

### Requirement: Temporal administrative-unit and lineage model
The dataset SHALL represent current and historical administrative units,
searchable aliases, validity intervals, and many-to-many predecessor/successor
relationships.

#### Scenario: Current canonical unit is stored
- **WHEN** a current province or commune-level unit is generated
- **THEN** it SHALL have a stable unit identity and an immutable revision containing official code, level, unit kind, canonical name, validity metadata, source, and current status
- **AND** each current commune-level unit SHALL reference a current province

#### Scenario: Historical name maps unambiguously
- **WHEN** one historical unit has one current successor
- **THEN** the dataset SHALL preserve the historical alias and successor relation
- **AND** legacy resolution SHALL identify the current successor

#### Scenario: Historical unit was partially merged or split
- **WHEN** one historical unit maps to multiple successors
- **THEN** the dataset SHALL preserve every supported successor relation
- **AND** SHALL mark the resolution as ambiguous rather than selecting one successor

#### Scenario: Former district is searched
- **WHEN** a query contains a former district name
- **THEN** the district MAY contribute historical search context
- **AND** it SHALL NOT become a required parent in the current province-to-commune canonical hierarchy

#### Scenario: Official code is reused
- **WHEN** one official code identifies different legal units in non-overlapping validity intervals
- **THEN** each occurrence SHALL retain a distinct revision identity and temporal evidence
- **AND** current lookup SHALL return only the active revision while legacy resolution SHALL preserve every applicable historical match

### Requirement: Deterministic Vietnamese administrative search
The service SHALL support accent-insensitive, case-insensitive, prefix, and
bounded fuzzy search across current names, official codes, and historical
aliases with deterministic ranking.

#### Scenario: Query omits Vietnamese diacritics
- **WHEN** a consumer searches for a valid unit name without diacritics
- **THEN** matching accented canonical units SHALL be returned
- **AND** current exact or prefix matches SHALL rank before fuzzy matches

#### Scenario: Query uses d for đ
- **WHEN** the only difference between the query and a stored name is `d` versus `đ`
- **THEN** normalization SHALL allow the unit to match

#### Scenario: Query contains a bounded typo
- **WHEN** no stronger exact or prefix result exists and the query contains a small spelling error
- **THEN** an indexed bounded candidate strategy SHALL still produce eligible fuzzy candidates when the typo prevents prefix retrieval, including a typo in the first token or character
- **AND** fuzzy candidates SHALL NOT outrank exact current or historical-code matches

#### Scenario: Province scope is supplied
- **WHEN** a consumer searches with a province code filter
- **THEN** commune-level matches outside that province SHALL be excluded

#### Scenario: Historical alias matches
- **WHEN** a query matches an old official name
- **THEN** the response SHALL identify the matched alias as historical
- **AND** return the current canonical path or all supported successor candidates

#### Scenario: Multiple results have the same match strength
- **WHEN** two or more candidates remain tied after match tier and similarity
- **THEN** the service SHALL order them by the documented current-status, level, normalized canonical-path, official-code, and revision-ID tie-breakers
- **AND** the same request against the same service and dataset versions SHALL return the same order

### Requirement: Narrow versioned read-only API
The service SHALL expose a stable `/v1` read-only API for health, version
metadata, province/commune lookup, unit lookup, address search, and legacy
resolution.

#### Scenario: Consumer lists provinces
- **WHEN** an internal consumer requests `/v1/provinces`
- **THEN** the service SHALL return current provinces from one dataset version
- **AND** the response SHALL be cacheable by an ETag derived from API representation version, service version, dataset version, route, and canonical request parameters

#### Scenario: Consumer lists communes in a province
- **WHEN** an internal consumer requests communes for a valid current province code
- **THEN** the service SHALL return only current child commune-level units
- **AND** use a bounded deterministic order

#### Scenario: Search request exceeds bounds
- **WHEN** a search query, result limit, timeout, or requested response exceeds configured bounds
- **THEN** the service SHALL reject or truncate according to the documented API contract
- **AND** SHALL remain available for valid requests

#### Scenario: Service returns an error
- **WHEN** a valid request cannot be completed
- **THEN** the service SHALL return a stable structured error body and appropriate status
- **AND** SHALL NOT expose SQL, filesystem paths, source payloads, or stack traces

#### Scenario: Service adds a response field
- **WHEN** a `/v1` response adds an unknown optional field without changing required field meaning or type
- **THEN** compatible consumers SHALL continue to accept the response
- **AND** removing or changing a required field SHALL require a new API major version

### Requirement: Private network-only access without an API key
The production service SHALL rely on the approved loopback and Tailscale network
boundary and SHALL not require an application API key in the initial release.

#### Scenario: Host-native same-host application connects
- **WHEN** an approved host-native application runs on the home server
- **THEN** it MAY reach the service through loopback
- **AND** no public host route SHALL be required

#### Scenario: Containerized LIMS connects
- **WHEN** the LIMS application runs in its home-server container
- **THEN** it SHALL reach the service through the host's Tailscale-only endpoint
- **AND** it SHALL NOT require a public route or address-service container

#### Scenario: Tailscale application connects
- **WHEN** an approved application runs on another tailnet machine
- **THEN** it SHALL reach a port bound only to the home server's Tailscale address
- **AND** the service SHALL NOT bind that host port on every interface

#### Scenario: Browser attempts direct access
- **WHEN** browser code attempts a cross-origin service call
- **THEN** the production service SHALL not provide permissive browser CORS
- **AND** applications SHALL proxy calls server-to-server

#### Scenario: Public publication is configured
- **WHEN** systemd environment or host configuration introduces a public host bind, Cloudflare route, or Funnel exposure
- **THEN** configuration verification SHALL fail

### Requirement: Infrequent operator-controlled dataset rollout
The service SHALL update only when an operator selects an approved tag or exact
commit. The home server SHALL pull that revision, run the documented Go checks,
build locally, restart the service, and retain the previous working revision
for rollback.

#### Scenario: Approved revision passes verification
- **WHEN** an approved tag or commit passes source, manifest, checksum, Go, build, health, integrity, metadata, and representative-search checks
- **THEN** the operator SHALL restart the service at that exact revision
- **AND** the previous working checkout and binary SHALL remain available until post-restart checks pass

#### Scenario: Pre-restart verification fails
- **WHEN** any source, checksum, test, or build check fails
- **THEN** the current service SHALL remain active
- **AND** the operator SHALL NOT restart it

#### Scenario: Post-switch verification fails
- **WHEN** the restarted service fails required post-restart checks
- **THEN** the operator SHALL restore the previous checkout and binary and restart the service

#### Scenario: Manual deployment is interrupted
- **WHEN** fetch, build, install, or restart is interrupted
- **THEN** the runbook SHALL identify the active revision and either finish the selected deployment or restore the previous revision
- **AND** no automated controller SHALL be required

#### Scenario: No update is requested
- **WHEN** administrative sources have not changed or no maintainer initiates a refresh
- **THEN** the active service SHALL continue using the current immutable dataset
- **AND** metadata SHALL expose its version and age

### Requirement: Resource-bounded observable runtime
The service SHALL run as a dedicated non-root, health-checked,
resource-bounded systemd service with privacy-safe structured logs.

#### Scenario: Service is idle
- **WHEN** the process receives no requests
- **THEN** it SHALL remain within the documented CPU, memory, process, and file-descriptor limits

#### Scenario: Home-server build runs
- **WHEN** the operator builds a selected revision while the current service remains active
- **THEN** combined build and service CPU, memory, process, file-descriptor, and disk use SHALL remain within documented home-server budgets
- **AND** the operator SHALL stop the deployment if the budget is exceeded

#### Scenario: Readiness dependency fails
- **WHEN** the process is alive but SQLite integrity or required metadata is unavailable
- **THEN** liveness MAY remain healthy
- **AND** readiness SHALL fail

#### Scenario: Request is logged
- **WHEN** the service records request telemetry
- **THEN** logs SHALL contain bounded metadata such as request ID, route, status, latency, and dataset version
- **AND** SHALL NOT contain raw search queries, credentials, LIMS data, or full upstream source payloads

### Requirement: Reference-data-only service boundary
The service SHALL store and process public administrative reference data and
service release metadata only.

#### Scenario: Consumer sends client or sample data
- **WHEN** a request contains LIMS client identity, patient, sample, result, or credential fields outside the documented query contract
- **THEN** the service SHALL reject or ignore unsupported fields
- **AND** SHALL NOT persist them

#### Scenario: Consumer searches an address
- **WHEN** a consumer submits a search request
- **THEN** it SHALL send administrative query text only
- **AND** SHALL NOT send house number, street detail, organization name, complete client address, or complete CCCD-scanned address

#### Scenario: Release checkout and repository are inspected
- **WHEN** release files are reviewed
- **THEN** they SHALL contain no SSH private key, Tunnel token, LIMS secret, API key, database password, or age identity
