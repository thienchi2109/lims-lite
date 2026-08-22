## MODIFIED Requirements

### Requirement: Samples linked to clients with snapshot naming
The system SHALL require an active resolved client when a sample is created or
relinked while retaining historical links and a snapshot of the client name for
audit/history after later lifecycle changes.
- Columns: `client_id UUID NOT NULL REFERENCES clients(id)`, `client_name TEXT
  NOT NULL` as a snapshot from `clients.name`.
- Existing sample creation SHALL resolve or create the client through the shared
  versioned client resolver before persisting the sample.
- The versioned sample mutation contract SHALL lock and revalidate the selected
  client as active, and derive `client_name`, in the same transaction that
  inserts or relinks the sample.
- A trigger SHALL set `client_name` from the linked client on insert/update;
  manual edits to `client_name` are not required for linkage.
- Historical samples SHALL remain linked to the same client UUID when that
  client becomes inactive or is restored.

#### Scenario: Create sample for a matched active client
- **GIVEN** the shared resolver returns `matched` for an active client
- **WHEN** an authorized user creates a sample with that resolved `client_id`
- **THEN** the system SHALL auto-fill `client_name` from the client row
- **AND** persist both the foreign key and snapshot name
- **AND** maintain existing `sample_status` enum behavior

#### Scenario: Create sample with a new client
- **GIVEN** the shared resolver returns `not_found`
- **WHEN** an authorized workflow atomically creates the client and sample
- **THEN** the sample SHALL link to the newly created client UUID
- **AND** SHALL retain the same existing sample field and status behavior

#### Scenario: Reject unresolved client linkage
- **WHEN** client resolution returns `ambiguous` or `conflict`, including an
  inactive-client reason, or the request omits `client_id`
- **THEN** the system SHALL reject sample creation before insert
- **AND** SHALL NOT create a sample row or mutate a client
- **AND** SHALL return a clear Vietnamese explanation

#### Scenario: Revalidate active client during sample mutation
- **GIVEN** lookup previously returned `matched`
- **WHEN** the client becomes inactive before sample creation or relinking
- **THEN** the versioned sample mutation SHALL detect the inactive state while
  holding the required transaction lock
- **AND** SHALL reject the mutation without creating/relinking a sample or
  changing the client

#### Scenario: Preserve historical linkage after deactivation
- **GIVEN** a sample already references a client
- **WHEN** that client is deactivated or restored
- **THEN** the sample SHALL retain the same `client_id` and snapshot name
- **AND** no historical sample or result ownership SHALL be rewritten

## ADDED Requirements

### Requirement: Non-regressive accession resolver adoption
The system SHALL adopt deterministic client resolution through additive,
versioned contracts without regressing unrelated accession, scanner, sample, or
result behavior.

#### Scenario: Preserve current caller contracts during rollout
- **WHEN** resolver/RPC v2 is deployed before a caller is migrated
- **THEN** existing routes, scanner transports, request shapes, response shapes,
  authorization, and sample/result workflows SHALL remain available
- **AND** the new database objects SHALL NOT change caller behavior by presence
  alone

#### Scenario: Shadow comparison does not alter user results
- **WHEN** an existing QR/manual lookup or upsert request is evaluated in shadow
  mode
- **THEN** the system SHALL compare legacy and v2 decisions without changing the
  response returned to the user
- **AND** SHALL persist only aggregate outcome/reason differences without PII

#### Scenario: Intentional conflict behavior is localized
- **WHEN** a migrated caller submits identity data that the legacy upsert would
  have used to overwrite an existing client
- **THEN** the v2 caller SHALL return `Xung đột thông tin`
- **AND** SHALL preserve the existing client and all sample/result data
- **AND** this SHALL be treated as the intentional safety correction rather than
  a regression

#### Scenario: Caller cutover requires regression evidence
- **WHEN** a caller is selected for v2 cutover
- **THEN** focused legacy workflow tests, typecheck, relevant lint, security
  tests, shadow comparison, and browser smoke SHALL pass
- **AND** a tested switch rollback SHALL remain available until the explicit
  legacy-constraint retirement gate

#### Scenario: Retire legacy paths only after production verification
- **WHEN** all client resolution callers use v2 and production verification
  confirms parity outside intentional conflict handling
- **THEN** legacy matching/upsert and hard-delete paths MAY be retired through a
  forward-only release
- **AND** scanner transport, QR parsing, sample/result workflows, RLS, and audit
  behavior SHALL remain unchanged
- **AND** after removal of legacy name/DOB uniqueness, recovery SHALL use a new
  forward-only release rather than re-enabling the structurally incompatible
  legacy upsert path
