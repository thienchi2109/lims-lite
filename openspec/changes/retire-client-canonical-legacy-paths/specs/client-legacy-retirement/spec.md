## ADDED Requirements

### Requirement: Client legacy retirement is observation-gated

The system SHALL retain Gate A's canonical resolver and security contracts while
legacy client paths remain present only until a separately reviewed observation
gate proves that retirement is safe.

#### Scenario: Observation window cannot start from database apply alone

- **WHEN** migration 231 is applied but the running application revision is
  older than the Gate A revision or cannot be identified
- **THEN** the observation window SHALL be marked not started
- **AND** no compatibility entry point, legacy RPC, grant, or telemetry object
  SHALL be removed

#### Scenario: Observation evidence is reviewable and PII-free

- **WHEN** the proposed observation window ends
- **THEN** the evidence SHALL record UTC start/end timestamps, deployed
  application revision or image identity, feature flags, migration hashes,
  shadow-event aggregates, static caller search, and runtime activity
- **AND** the evidence SHALL contain no client name, phone, date of birth,
  government identity, UUID, request payload, token, or raw database error
- **AND** zero telemetry SHALL be treated as inconclusive when the deployed
  application is stale or there is no representative client/accession activity

### Requirement: Retired callers use the canonical v2 contract

After Gate B approval, creation-capable and lookup-only application callers SHALL
use the reviewed v2 resolver contracts through server-only boundaries and
`src/lib/api-client.ts`.

#### Scenario: Compatibility caller is replaced before deletion

- **WHEN** a form, selector, route action, or server handler currently reaches a
  compatibility adapter
- **THEN** a failing regression test SHALL first prove the intended direct v2
  behavior
- **AND** the caller SHALL be migrated without changing authorized outcomes,
  Vietnamese messages, sample linkage, or audit behavior
- **AND** the compatibility entry point SHALL remain until static and runtime
  evidence proves it is no longer reachable

#### Scenario: Legacy mutation remains fail-closed

- **WHEN** a request attempts to use the disabled raw name/date-of-birth upsert
  path
- **THEN** the request SHALL fail closed or be routed to the v2 contract
- **AND** it SHALL not perform a direct `public.clients` upsert
- **AND** no client, sample, result, or success audit row SHALL be created

### Requirement: Database legacy contracts retire forward-only

Database retirement SHALL change only reviewed, proven-unused functions or
grants and SHALL preserve RLS, auditability, fixed `search_path`, v2 resolver
contracts, and historical data.

#### Scenario: Candidate RPC has no retained dependency

- **WHEN** an obsolete client RPC or grant is selected for retirement
- **THEN** live catalog dependencies, ACLs, signatures, and PostgREST exposure
  SHALL be checked in the approved Docker PostgreSQL environment
- **AND** the new migration SHALL assert the expected baseline before revoking
  or dropping the object
- **AND** migration 230 and migration 231 SHALL remain byte-for-byte unchanged

#### Scenario: Historical truth survives retirement

- **WHEN** an approved application or database retirement is applied
- **THEN** client UUIDs, sample links, sample snapshots, results, lifecycle
  state, and audit rows SHALL remain unchanged
- **AND** no hard delete, merge, relink, or historical rewrite SHALL occur

### Requirement: Gate B verification covers security and recovery

Gate B SHALL be accepted only after focused regressions and the immediate
client/accession blast-radius checks pass.

#### Scenario: Retirement release is verified

- **WHEN** the approved Gate B implementation is ready to land
- **THEN** focused tests, SQL security tests, `run_security_tests()`, typecheck,
  lint, React Doctor, strict OpenSpec, health checks, and browser smoke SHALL
  pass
- **AND** the post-retirement evidence SHALL document the forward-only recovery
  boundary
- **AND** authenticated profile updates and manager-audited lifecycle actions
  SHALL retain their existing authorization and audit behavior
