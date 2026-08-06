## ADDED Requirements

### Requirement: Independently owned Go and SQLite service
The system SHALL provide Vietnamese administrative-address reference data from
an independently versioned Go service implemented in a separate
`vietnamese-address-service` repository. Consumers SHALL use its versioned HTTP
contract and SHALL NOT query its SQLite schema directly.

#### Scenario: Service repository is independent from LIMS
- **WHEN** the service foundation is initialized
- **THEN** it SHALL have its own Go module, CI, Docker image, releases, OpenSpec artifacts, and operational documentation
- **AND** no service implementation code SHALL be placed in the `lims-lite` application container

#### Scenario: Future application integrates
- **WHEN** another internal application needs administrative-address data
- **THEN** it SHALL integrate through the versioned service API
- **AND** it SHALL NOT require LIMS database access or LIMS deployment

### Requirement: Immutable versioned SQLite dataset
Every published service image SHALL contain one generated SQLite snapshot that
is opened read-only at runtime. The active dataset SHALL be identifiable and
reproducible from versioned provenance.

#### Scenario: Container starts with a valid snapshot
- **WHEN** the service process starts
- **THEN** it SHALL open the packaged SQLite database read-only
- **AND** verify integrity and required dataset metadata before reporting ready

#### Scenario: Runtime attempts to mutate reference data
- **WHEN** application code or a request attempts to modify the production SQLite dataset
- **THEN** the operation SHALL fail
- **AND** the service SHALL NOT create a writable database volume or replacement file

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
- **THEN** no new dataset image SHALL be published
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
- **THEN** automatic publication SHALL fail closed
- **AND** publication SHALL require a reviewed manifest or allow-list change in the service repository

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
The production service SHALL rely on the approved Docker and Tailscale network
boundary and SHALL not require an application API key in the initial release.

#### Scenario: Same-host application connects
- **WHEN** an approved application runs on the home server
- **THEN** it SHALL reach the service through the approved external private Docker network
- **AND** no public host route SHALL be required

#### Scenario: Tailscale application connects
- **WHEN** an approved application runs on another tailnet machine
- **THEN** it SHALL reach a port bound only to the home server's Tailscale address
- **AND** the service SHALL NOT bind that host port on every interface

#### Scenario: Browser attempts direct access
- **WHEN** browser code attempts a cross-origin service call
- **THEN** the production service SHALL not provide permissive browser CORS
- **AND** applications SHALL proxy calls server-to-server

#### Scenario: Public publication is configured
- **WHEN** Compose or deployment configuration introduces a public host bind, Cloudflare route, or Funnel exposure
- **THEN** configuration verification SHALL fail

### Requirement: Automatic fail-closed dataset rollout
The service repository SHALL automatically check for source changes, publish
validated immutable images, and support pull-based automatic deployment and
rollback on the home server.

#### Scenario: New image passes candidate verification
- **WHEN** a new image passes trusted repository, digest, publisher identity, signature, provenance, manifest, dark health, integrity, metadata, representative search, and combined resource checks
- **THEN** the controller SHALL record the intended transition and recreate the stable service at the verified digest
- **AND** the previous known-good digest SHALL remain available for rollback

#### Scenario: Candidate verification fails
- **WHEN** any pre-switch candidate check fails
- **THEN** the current service SHALL remain active
- **AND** the isolated candidate SHALL receive no consumer traffic

#### Scenario: Post-switch verification fails
- **WHEN** the recreated stable service fails required post-switch checks
- **THEN** deployment SHALL automatically restore the previous known-good digest

#### Scenario: Deployment controller is interrupted
- **WHEN** the controller restarts during or after a digest transition
- **THEN** it SHALL reconcile protected desired, active, previous, and last-transition state against the actual stable container digest
- **AND** SHALL converge to either the verified candidate or previous known-good digest without guessing

#### Scenario: Automated update fails without alerting
- **WHEN** source, build, publication, or deployment automation fails
- **THEN** the failure SHALL be retained in workflow or deployment logs
- **AND** no external notification channel is required

### Requirement: Resource-bounded observable runtime
The service SHALL run as a non-root, health-checked, resource-bounded container
with a read-only filesystem and privacy-safe structured logs.

#### Scenario: Service is idle
- **WHEN** the container receives no requests
- **THEN** it SHALL remain within the documented CPU, memory, process, and file-descriptor limits

#### Scenario: Candidate and active containers overlap
- **WHEN** a dark candidate runs concurrently with the active service
- **THEN** their combined CPU, memory, process, file-descriptor, and disk use SHALL remain within documented home-server budgets
- **AND** candidate verification SHALL fail before switching if the combined budget is exceeded

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

#### Scenario: Image and repository are inspected
- **WHEN** release artifacts are scanned
- **THEN** they SHALL contain no SSH private key, Tunnel token, LIMS secret, API key, database password, or age identity
