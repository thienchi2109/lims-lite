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
  functions and SHALL not drift from their source identity fields:
  `normalized_name`, `normalized_phone`,
  `government_identity_value`, `government_identity_type`, and
  `government_identity_trusted`.
- The existing
  `clients_unique_trusted_government_identity` unique index SHALL remain
  defined on `(government_identity_type, government_identity_value)` with the
  predicate `government_identity_trusted AND government_identity_value IS NOT
  NULL`, covering active and inactive rows.
- `idx_clients_normalized_phone` and `idx_clients_normalized_name_dob` SHALL
  remain non-unique active-row indexes. A normalized phone or
  normalized-name/date-of-birth match SHALL be a resolver conflict signal, not
  proof of identity. Phone placeholders such as `0000000000`, invalid values,
  and blank values SHALL normalize to `NULL`.
- The system SHALL NOT enforce `UNIQUE (name, date_of_birth)` and SHALL NOT
  make normalized phone unique.
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
- **AND** the creation path SHALL use `resolve_or_create_client_v2` rather than
  a direct table upsert
- **AND** the mutation SHALL produce the required audit evidence

#### Scenario: Reject invalid gender or missing identity

- **WHEN** client creation is attempted with `gender` not in {'Nam','Nữ','Khác'}
  or any required identity field missing
- **THEN** the system SHALL reject the insert
- **AND** return a validation error without creating a row

#### Scenario: Reject conflicting trusted identity atomically

- **WHEN** a create, restore, or correction would produce a trusted typed
  CCCD/CMND collision, or an unadjudicated normalized phone or
  normalized-name/date-of-birth candidate conflict
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
- **AND** authenticated UPDATE SHALL remain allowed only for `gender`, `phone`,
  `address`, `health_insurance_num`, and `expiry_date`

#### Scenario: Deny hard delete and broad identity mutation

- **WHEN** an authenticated caller attempts hard DELETE or broad direct UPDATE
  of identity or lifecycle fields
- **THEN** the database authorization boundary SHALL deny the operation
- **AND** the attempted mutation SHALL not remove or corrupt historical data

## ADDED Requirements

### Requirement: Canonical client integrity enforcement

The system SHALL expose a reviewed Gate A for canonical client integrity that
requires clean baseline evidence before enforcement and preserves the
post-Phase-6 resolver, lifecycle, RLS, grant, and audit contracts. The existing
trusted typed identity unique index is validated and preserved by this gate; it
is not recreated as new behavior.

#### Scenario: Gate A blocks on unresolved canonical state

- **WHEN** baseline checks find unresolved typed-identity collisions,
  canonical projection drift, missing lifecycle audit coverage, a changed
  migration-230 catalog contract, or a successful direct legacy mutation caller
- **THEN** the enforcement migration SHALL not be applied
- **AND** the evidence SHALL identify the blocking category without exposing
  unnecessary client PII

#### Scenario: Preflight evidence is required before migration

- **WHEN** Gate A is evaluated
- **THEN** `tests/client-canonical-integrity-preflight.sql` SHALL run with
  `ON_ERROR_STOP` against the approved Docker PostgreSQL database
- **AND** the command SHALL return non-zero for any blocking collision,
  projection, catalog, ACL, RLS, RPC, or audit mismatch
- **AND** static route tests and runtime telemetry SHALL separately prove
  caller adoption, with their result recorded alongside the SQL output
- **AND** reviewed non-PII output SHALL be recorded in
  `gate-a-preflight-evidence.md` with commit SHA, database timestamp, aggregate
  counts, and pass/fail result
- **AND** the enforcement migration SHALL not be attempted without that
  evidence artifact

#### Scenario: Legacy compatibility entry point is resolver-backed

- **WHEN** `upsertClient` is dispatched through
  `src/app/api/client-actions/route.ts`
- **THEN** the compatibility entry point SHALL delegate to
  `resolve_or_create_client_v2` or return a stable fail-closed Vietnamese error
- **AND** no successful request SHALL execute a direct
  `public.clients` upsert with `onConflict: 'name,date_of_birth'`
- **AND** physical removal of the compatibility entry point SHALL remain outside
  Gate A

#### Scenario: Gate A applies forward-only enforcement

- **WHEN** all approved baseline assertions pass and the committed next-numbered
  migration is applied
- **THEN** the database SHALL preserve the existing
  `clients_unique_trusted_government_identity` index and enforce canonical
  projection consistency plus the approved resolver/candidate guards
- **AND** the migration SHALL not add unique enforcement to normalized phone or
  name/date-of-birth
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

#### Scenario: Migration 230 baseline remains intact

- **WHEN** Gate A compares the database baseline
- **THEN** it SHALL verify migration 230 SHA-256
  `2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`
- **AND** it SHALL verify the absence of `clients_unique_identity`, the exact
  resolver v2 and accession RPC signatures, the enabled
  `sync_samples_client_name` trigger, reconciled projections, the trusted
  identity index, and the post-230 `run_security_tests()` registration
- **AND** it SHALL verify that authenticated table-level UPDATE/DELETE/TRUNCATE
  remain denied and only the five approved profile columns remain writable

#### Scenario: Lifecycle audit evidence is atomic and concrete

- **WHEN** deactivation, restoration, or identity correction succeeds
- **THEN** exactly one explicit `audit_logs` row SHALL be committed with
  `table_name = 'clients'`, the client UUID as `record_id`, and
  `changed_by = auth.uid()`
- **AND** `CLIENT_DEACTIVATED` SHALL contain `reason` and
  `lifecycle_status = 'inactive'`
- **AND** `CLIENT_RESTORED` SHALL contain `reason` and
  `lifecycle_status = 'active'`
- **AND** `CLIENT_IDENTITY_CORRECTED` SHALL contain `reason`,
  `corrected_fields`, and lifecycle status
- **AND** an audit failure SHALL roll back the client mutation with
  `CLIENT_AUDIT_FAILED` / SQLSTATE `P1116`
- **AND** a rejected conflict SHALL commit no client, sample, result, or
  lifecycle-success audit row
