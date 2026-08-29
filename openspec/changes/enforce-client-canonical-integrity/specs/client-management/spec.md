## MODIFIED Requirements

### Requirement: Client registry with constrained identity

The system SHALL store clients in a dedicated table with required identity
fields, database-maintained canonical projections, typed identity guardrails,
and auditable lifecycle behavior.

- Columns SHALL include `id` (UUID PK), `id_card_num` (TEXT NOT NULL),
  `name` (TEXT NOT NULL), `date_of_birth` (DATE NOT NULL), `gender` (TEXT NOT
  NULL with CHECK in {'Nam','Nữ','Khác'}), optional `address`,
  `health_insurance_num`, `expiry_date` (DATE), canonical identity fields,
  lifecycle fields, `created_at`, and `updated_at`.
- Canonical projections SHALL be derived from the approved versioned database
  functions and SHALL not drift from their source identity fields.
- The system SHALL enforce uniqueness only for trusted typed CCCD/CMND
  identities and approved canonical candidate invariants. It SHALL NOT enforce
  `UNIQUE (name, date_of_birth)`.
- Direct hard deletion and broad identity/lifecycle updates SHALL remain
  unavailable to authenticated callers. Explicitly allowed profile updates
  SHALL continue through the existing constrained contract.
- All lifecycle and correction mutations SHALL remain audited, and RLS SHALL
  remain the final authorization boundary.

#### Scenario: Create client from validated input

- **WHEN** an authorized resolver receives a valid new trusted identity with
  valid required profile fields and no canonical collision
- **THEN** the system SHALL create one client with database-derived canonical
  projections
- **AND** the mutation SHALL produce the required audit evidence

#### Scenario: Reject invalid gender or missing identity

- **WHEN** client creation is attempted with `gender` not in {'Nam','Nữ','Khác'}
  or any required identity field missing
- **THEN** the system SHALL reject the insert
- **AND** return a validation error without creating a row

#### Scenario: Reject conflicting trusted identity atomically

- **WHEN** a create, restore, or correction would produce a trusted typed
  CCCD/CMND collision or another enforced canonical candidate conflict
- **THEN** the database SHALL reject the mutation atomically
- **AND** the resolver SHALL return a stable fail-closed conflict outcome
- **AND** no client, sample, result, or audit history SHALL be partially
  rewritten

#### Scenario: Allow distinct clients with shared name and date of birth

- **WHEN** two valid clients have different trusted identities but the same
  normalized name and date of birth
- **THEN** the system SHALL permit both client records
- **AND** name/date-of-birth similarity alone SHALL NOT be treated as a unique
  identity or an automatic merge

#### Scenario: Preserve constrained profile updates

- **WHEN** an authenticated caller submits only an explicitly allowed profile
  update for a client it may access
- **THEN** the system SHALL allow the update subject to validation and RLS
- **AND** SHALL NOT allow the caller to change canonical identity or lifecycle
  fields through that profile contract

#### Scenario: Deny hard delete and broad identity mutation

- **WHEN** an authenticated caller attempts hard DELETE or broad direct UPDATE
  of identity or lifecycle fields
- **THEN** the database authorization boundary SHALL deny the operation
- **AND** the attempted mutation SHALL not remove or corrupt historical data

## ADDED Requirements

### Requirement: Canonical client integrity enforcement

The system SHALL expose a reviewed Gate A for canonical client integrity that
requires clean baseline evidence before enforcement and preserves the
post-Phase-6 resolver, lifecycle, RLS, grant, and audit contracts.

#### Scenario: Gate A blocks on unresolved canonical state

- **WHEN** baseline checks find unresolved typed-identity collisions,
  canonical projection drift, missing lifecycle audit coverage, or an
  authoritative legacy mutation caller
- **THEN** the enforcement migration SHALL not be applied
- **AND** the evidence SHALL identify the blocking category without exposing
  unnecessary client PII

#### Scenario: Gate A applies forward-only enforcement

- **WHEN** all approved baseline assertions pass and the committed migration is
  applied
- **THEN** the database SHALL enforce the approved typed identity and canonical
  candidate guards
- **AND** the migration SHALL use fixed `search_path`, explicit role checks,
  minimal grants, documented security impact, and immutable audit behavior
- **AND** the removed name/date-of-birth uniqueness constraint SHALL remain
  absent

#### Scenario: Concurrent canonical writes remain safe

- **WHEN** concurrent authorized callers attempt to create or restore clients
  with the same trusted identity
- **THEN** at most one canonical client SHALL succeed
- **AND** all other callers SHALL receive a stable conflict result without
  partial writes

#### Scenario: Historical sample and result truth remains unchanged

- **WHEN** Gate A enforcement is applied or a client lifecycle mutation is
  rejected
- **THEN** existing sample names, results, accession history, and audit rows
  SHALL remain unchanged
- **AND** new sample snapshots SHALL continue to derive from the linked client
  through the approved transactional path

#### Scenario: Security verification covers the enforcement boundary

- **WHEN** the Gate A verification suite runs
- **THEN** it SHALL verify RLS, grants, hard-delete denial, constrained profile
  updates, lifecycle authorization, audit evidence, resolver outcomes, and
  absence of unauthorized execution
- **AND** `run_security_tests()` SHALL pass before deployment is accepted
