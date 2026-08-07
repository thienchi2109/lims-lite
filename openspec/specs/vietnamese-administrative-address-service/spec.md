# vietnamese-administrative-address-service Specification

## Purpose
TBD - created by archiving change add-vietnamese-address-service. Update Purpose after archive.
## Requirements
### Requirement: Independent immutable reference service

The system SHALL provide current Vietnamese province and commune reference data
from a separate Go service backed by one generated SQLite snapshot. The runtime
SHALL open SQLite read-only and SHALL NOT store LIMS, client, sample, CCCD,
credential, or complete free-form address data.

#### Scenario: Service starts

- **WHEN** the configured snapshot is present, read-only, compatible, and passes
  SQLite integrity checks
- **THEN** the process SHALL become ready
- **AND** report bounded dataset metadata

#### Scenario: Snapshot is invalid

- **WHEN** the snapshot is missing, writable, corrupt, or incompatible
- **THEN** readiness SHALL fail closed
- **AND** errors SHALL omit filesystem paths, SQL, source contents, and stack
  traces

### Requirement: Pinned reproducible current dataset

The builder SHALL use one pinned
`thanglequoc/vietnamese-provinces-database` simplified JSON artifact and its MIT
license. The service repository SHALL retain the source commit, artifact path,
checksum, expected province and commune counts, parser/toolchain version, and
generated snapshot checksum.

#### Scenario: Dataset is generated

- **WHEN** the retained artifact passes checksum, schema, code, parent, kind,
  normalized-name, count, provenance, and size validation
- **THEN** the builder SHALL generate an immutable service-owned SQLite
  snapshot
- **AND** identical retained inputs SHALL produce byte-identical output

#### Scenario: Source drifts

- **WHEN** the source schema, codes, names, normalized fields, parent ownership,
  unit kinds, counts, or checksum differ from the reviewed manifest
- **THEN** generation SHALL fail closed
- **AND** accepting the change SHALL require a reviewed manifest update

### Requirement: Minimal bounded read-only API

The service SHALL expose liveness, readiness, dataset metadata, province list,
commune list by province, and current-name search. Responses SHALL have stable
JSON shapes, deterministic ordering, bounded sizes, and redacted errors.

#### Scenario: Consumer lists provinces

- **WHEN** an internal consumer requests `GET /v1/provinces`
- **THEN** the service SHALL return current provinces in deterministic code
  order

#### Scenario: Consumer lists communes

- **WHEN** an internal consumer requests communes for a current province code
- **THEN** the service SHALL return only current child communes in deterministic
  code order

#### Scenario: Consumer searches current names

- **WHEN** a bounded query contains a current province or commune name
- **THEN** the service SHALL return bounded current matches using documented
  case, whitespace, diacritic, and `đ`/`d` normalization
- **AND** rank exact and prefix matches before bounded edit-distance typo
  matches using stable deterministic ordering

#### Scenario: Request exceeds bounds

- **WHEN** a request violates method, query length, result limit, timeout,
  concurrency, or response-size limits
- **THEN** the service SHALL reject it before unbounded work
- **AND** return a stable redacted error

### Requirement: Private Tailscale-only access

The service SHALL run as a host-native home-server process and listen only on a
configured private Tailscale-reachable address and port. It SHALL NOT be exposed
through public Internet routing, Cloudflare Tunnel or Funnel, browser CORS, or
client-side environment variables.

#### Scenario: LIMS calls the service

- **WHEN** authenticated LIMS server-side code performs an address lookup
- **THEN** it MAY call the configured private Tailscale service URL
- **AND** the browser SHALL receive only the bounded same-origin LIMS response

#### Scenario: Browser attempts direct access

- **WHEN** a browser or public route attempts to reach the service
- **THEN** no supported direct integration path SHALL exist

### Requirement: Privacy-bounded requests and logs

The service SHALL accept administrative lookup text and administrative codes
only. It SHALL not accept client records, sample records, CCCD payloads, or
complete free-form addresses. Logs SHALL contain request ID, normalized route,
status, duration, and bounded dataset metadata only.

#### Scenario: Request is logged

- **WHEN** a request completes
- **THEN** logs SHALL omit raw queries, query strings, bodies, headers, remote
  addresses, complete addresses, client data, sample data, and credentials

#### Scenario: Unsupported personal data is sent

- **WHEN** a request includes unsupported PII-bearing fields
- **THEN** the service SHALL reject the request
- **AND** SHALL not log the rejected values

### Requirement: Manual operation and rollback

Dataset refresh, verification, deployment, and rollback SHALL be
operator-initiated. The service SHALL have no hosted CI/CD, automated dependency
updates, scheduled refresh, automated publication, or deployment controller.

#### Scenario: New revision is deployed

- **WHEN** an exact service revision and snapshot pass local verification
- **THEN** an operator MAY install them on the home server and restart the
  service
- **AND** SHALL verify health and representative API responses

#### Scenario: New revision fails

- **WHEN** startup, health, or representative lookup verification fails
- **THEN** the operator SHALL restore the previous working revision and
  snapshot
