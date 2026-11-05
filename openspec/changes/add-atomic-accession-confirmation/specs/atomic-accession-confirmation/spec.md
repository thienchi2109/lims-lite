## ADDED Requirements

### Requirement: Successful intent is globally claimed with a durable receipt
The system SHALL retain one immutable minimal receipt per successful batch and enforce global uniqueness of its normalized intent hash across actors, files, expiry and canonicalization versions. Receipt, claim, business rows, mappings and audit MUST become durable in the same transaction. Failed, rejected and expired attempts MUST NOT retain a blocking claim.

#### Scenario: Two batches contain the same intent
- **WHEN** concurrent batches have the same canonical intent despite different refs, row order or actors
- **THEN** at most one succeeds, the loser transitions to terminal failed with reason ALREADY_IMPORTED and no business rows or retained claim, without another actor's receipt or identifiers

#### Scenario: Business entities later change
- **WHEN** imported samples are subsequently soft deleted or voided or preview bindings are purged
- **THEN** receipt, mappings, audit and global successful claim remain immutable and the intent cannot be reimported

### Requirement: Confirmation accepts only a verified trusted-server handoff
Confirmation SHALL derive actor from the authenticated session and require current active analyst ownership and explicit acceptable-quality attestation. The server MUST reparse transient original bytes, validate the template/workbook, verify source SHA-256/size, canonical intent hash/version and retained-key client HMAC bindings. Only a restricted service database entrypoint SHALL receive transient verified inputs; the database MUST recheck owner, role, state, sealed hashes/bindings and current catalog/resolver authority.

#### Scenario: Client forges normalized input or identity
- **WHEN** an anonymous/authenticated caller invokes the privileged SQL handoff, or a request supplies arbitrary actor, resolved UUID or received time
- **THEN** the request cannot gain write authority or create business rows

#### Scenario: Source, bindings or attestation do not match
- **WHEN** bytes/hash/content/HMAC/key version or explicit acceptable-quality attestation fail verification
- **THEN** confirmation fails closed with safe terminal handling and no business rows, payload retention or identity-bearing failure audit

### Requirement: Authority and expiry are checked after locks
Confirmation SHALL serialize batch access and relevant catalog/client writers with a stable lock order. It MUST recheck published revision, active entities, generation, methods, pairs, same-batch client guards and exact resolution outcome/UUID/fingerprint without switching reuse/create. The acceptance clock MUST be database time taken after locks and validation; `now >= expires_at` SHALL reject new confirmation. No official entity IDs SHALL be exposed before commit.

#### Scenario: Waiting for a lock crosses expiry
- **WHEN** a confirmation begins before expiry but receives required locks at or after the deadline
- **THEN** it records expiry without business rows, receipt or official IDs

#### Scenario: Accepted work finishes after deadline
- **WHEN** all authority checks and acceptance occur before expiry and business work finishes afterward
- **THEN** the transaction can succeed and cleanup cannot reclaim its in-use commitment

#### Scenario: Catalog, client or actor authority drifts
- **WHEN** revision/generation/pair/method or client outcome/UUID/display fields change, confidentiality is withdrawn or the owner loses analyst authority
- **THEN** the whole batch fails closed without silent replanning, profile overwrite or partial writes

### Requirement: Entire business graph commits atomically
Confirmation SHALL directly create only genuinely new clients, all new assigned samples and all pending result assignments in one database transaction. Every sample MUST have acceptable quality, one common database `received_at` and authenticated `received_by`; official identifiers SHALL be generated only inside business work. The implementation MUST NOT emulate atomicity by looping single-accession RPCs or compensating deletes.

#### Scenario: Any write, mapping, claim or audit step fails
- **WHEN** failure is injected after a client, sample, final assignment, mapping or audit write
- **THEN** all new business rows, mappings, receipt/claim and success audit roll back, and a usable outer connection records safe terminal failure and failure audit

#### Scenario: Connection loss prevents failure persistence
- **WHEN** the connection is lost before the database can commit an outcome
- **THEN** confirmation does not fabricate success or failure, and status/recovery must determine the durable outcome before replay

#### Scenario: Final graph validation rejects success
- **WHEN** final receipt/count/parent/entity/actor-audit validation fails after writes
- **THEN** validation raises inside the business savepoint before returning success, rolls back all business work and allows safe outer failure state/audit; deferred validation additionally protects commit without a full graph scan per mapping

### Requirement: Same-batch repeats return the authorized receipt
Batch locking SHALL ensure repeated confirmations create at most one business graph. An authorized repeat of succeeded SHALL return the existing receipt before requiring source resend, attestation, retained binding keys/runtime configuration or unexpired preview, without extending TTL or repeating success audit. Current reader authority MUST still apply. Other terminal attempts MUST NOT replay; a new linked attempt is required after failure or expiry.

#### Scenario: Two callers confirm the same owned batch
- **WHEN** two confirmations contend on one batch and the first succeeds
- **THEN** the second returns the same committed receipt and no duplicate rows or lifecycle success event

### Requirement: Provenance and reads remain minimal and protected
Successful provenance SHALL map every client/sample/assignment source row to the correct canonical/new entities, parent graph, validated refs, assay/method and official sample identifier without duplicating profile fields or source/normalized rows. Current nondeleted analysts SHALL read only owned history and current nondeleted managers SHALL read permitted history. Every mapping, including reused clients, MUST pass parent-receipt ownership/role plus current active client, confidentiality and applicable sample/result RLS gates; manager role alone MUST NOT bypass confidential authorization. Deactivated/deleted/restricted mapping details SHALL be hidden while safe history remains. Browser roles MUST NOT mutate receipt, mappings, claims or batch state directly. Creation-time provenance MUST NOT constrain later auditable business updates.

#### Scenario: A mapping points to a newly restricted entity
- **WHEN** the reader currently lacks permission to the client, sample or result
- **THEN** history cannot expose that entity's identifiers, refs or mapping through privileged reads

#### Scenario: Preview data expires
- **WHEN** the 30-minute deadline or terminal state makes preview bindings purge eligible
- **THEN** no retained workbook/full normalized payload exists, while minimal receipt/provenance/audit/dedup history has no automatic TTL

### Requirement: Verification claims identify their evidence lane
The change SHALL retain focused source RED→GREEN checks and SQL rollback, concurrency, RLS/security, drift, hash and lock-time TTL scenarios. Source validation MUST NOT be reported as SQL runtime, deployment, HTTP, capacity or recovery acceptance. Applied migrations MUST remain immutable and each new migration requires separately authorized home-server execution and security tests.

#### Scenario: Source checks pass before runtime authorization
- **WHEN** source tests, lint/typecheck and strict OpenSpec validation pass without executing SQL
- **THEN** SQL runtime/security/atomicity gates remain NOT RUN or INCOMPLETE and TASK-11 remains open
