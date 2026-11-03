## ADDED Requirements

### Requirement: Preview resolution uses canonical read-only authority

The server SHALL consume TASK-9 validated rows and use shared canonical resolver v2 and SQL normalization. It MUST validate supplied optional fields for both create/reuse, require valid non-placeholder phone and gender only for creation, preserve typed trusted identity semantics including legacy matches, and never call a client creation/upsert path or overwrite existing identity.

#### Scenario: Existing client permits omitted create-only fields
- **WHEN** canonical v2 returns an authorized active matched UUID and phone/gender are absent
- **THEN** preview plans reuse without filling or changing existing fields

#### Scenario: Creation requires phone and gender
- **WHEN** v2 returns not_found and valid phone or gender is absent
- **THEN** preview rejects the entire batch with Vietnamese errors at the client cells

#### Scenario: Supplied invalid optional value on reuse
- **WHEN** a supplied optional value is invalid even though the row would match
- **THEN** preview rejects without dropping or silently correcting that value

#### Scenario: Conflict or resolver unavailability
- **WHEN** resolution is ambiguous, conflicting, restricted, inactive, malformed, unavailable, or unexpectedly created
- **THEN** preview fails closed without business writes, candidate disclosure or a partial plan

### Requirement: Same-batch guards preserve canonical identity policy

The server SHALL reject duplicate resolved UUIDs and duplicate compatible trusted identities, report contradictory evidence as conflict, and evaluate unresolved creation collisions using canonical name/accent/phone/identity rules. Name+DOB alone MUST NOT prove identity or cause duplicate classification. Distinct identities permitted by shared v2 and existing adjudication MUST remain distinct. Different typed strings MUST NOT override unresolved cross-key conflicts.

#### Scenario: Duplicate UUID or trusted identity
- **WHEN** two references resolve to one active UUID or the same trusted typed identity with agreeing evidence
- **THEN** all involved rows receive CLIENT_DUPLICATE and no rows are merged

#### Scenario: Same identity has disagreement
- **WHEN** equal trusted identity keys have differing canonical name, DOB or supplied phone
- **THEN** all involved rows receive conflict instead of permitting two creates

#### Scenario: Confirmed distinct existing clients
- **WHEN** v2 permits different existing UUIDs with distinct trusted identities and equal name+DOB through confirmed-distinct adjudication
- **THEN** both remain valid distinct clients

#### Scenario: Unresolved creation collision
- **WHEN** not_found rows overlap canonical name+DOB, accent-only name+DOB, phone or trusted identity without a safe canonical distinct resolution
- **THEN** the batch rejects with duplicate or conflict according to canonical evidence, never a first/last winner

### Requirement: Intent hashing preserves graph and multiplicity

The server SHALL implement accession-intent-v1 exactly as approved #113 §7: nine normalized input fields plus nested samples; sample type code/acceptable/sorted assays; UTF-8 byte lexicographic sorting of codes and serialized tuple blocks; ECMAScript JSON.stringify array serialization; absent optional fields null; unpaired surrogates rejected. It MUST preserve multiplicity and graph edges and SHA-256 the exact domain prefix, LF byte and canonical JSON. It MUST exclude references/order/filename/catalog labels and metadata, actor, batch IDs, resolver outcome/UUID and received_at.

#### Scenario: Golden vector
- **WHEN** the approved normalized An/ST-DEMO/CT-000001 fixture is serialized
- **THEN** SHA-256 equals 090da05ce3b97394845d98b5d3fde180f150b3d452b5f067155466859a4e908e

#### Scenario: Equivalent input after create becomes reuse
- **WHEN** only refs, ordering, filename or resolver outcome/UUID change for the same normalized input graph
- **THEN** canonical bytes and hash remain unchanged

#### Scenario: Multiplicity or relationship changes
- **WHEN** an identical sample is added or an assignment moves between samples or clients
- **THEN** canonical structure preserves that change and the intent hash changes

#### Scenario: SQL and application parity
- **WHEN** Unicode, null, control-escape and byte-order fixtures pass through SQL normalization and application serialization
- **THEN** both produce the approved normalized values and canonical hash fixture expectations

### Requirement: Durable preview commitment is immutable and owner-bound

The database SHALL persist preparing/preview_ready/terminal metadata, exact source SHA-256/size, canonical hash/version, template/revision/generation bindings, counts, safe outcomes, binding digest and DB timestamps. It MUST NOT retain source bytes, filename, full normalized payload, identity values, raw temporary references or raw exceptions in durable metadata/audit. Controlled bindings SHALL use separately keyed versioned HMAC-SHA-256 fingerprints under lims-lite:bulk-accession:client-binding:v1, covering batch/locator/outcome/UUID and decision/display values, with no raw low-entropy identity hash.

#### Scenario: Seal complete preview
- **WHEN** validation, source hash, canonical hash, current authority, counts and bindings agree
- **THEN** one metadata transaction seals preview_ready with immutable owner/commitment/bindings and DB preview_created_at/expires_at

#### Scenario: Source is released after request
- **WHEN** preview processing ends or application restarts
- **THEN** only permitted metadata/bindings/audit survive; the source and full normalized payload cannot be reconstructed from durable storage

#### Scenario: Binding key is unavailable
- **WHEN** required server-only HMAC key/version is missing or invalid
- **THEN** preview cannot seal and no fallback key or raw identity digest is used

### Requirement: Deadline and preparation lease use database time

The database SHALL set expires_at to preview_created_at plus 30 minutes. A new confirm at or after expires_at MUST be rejected; reload, HTTP retry, heartbeat and lock contention MUST NOT extend the deadline. Preparing SHALL carry server request lease token/generation and DB heartbeat/deadline; recovery may fail it only after row lock and expired matching lease recheck. Terminal states MUST NOT transition backwards. TASK-11 owns confirm admission under lock; TASK-12 owns recovery/purge runners.

#### Scenario: Exact expiry boundary
- **WHEN** database time reaches expires_at
- **THEN** no new confirm is admitted even if physical bindings remain

#### Scenario: Stale heartbeat or recovery
- **WHEN** an old token/generation attempts to renew or fail a sealed/terminal or renewed attempt
- **THEN** it cannot mutate that attempt or extend preview TTL

#### Scenario: Confirm accepted before deadline
- **WHEN** TASK-11 accepts a transaction before expiry while holding the required locks
- **THEN** expiry cleanup cannot cancel its completion after the deadline

### Requirement: Analyst-only API rejects stale authority without business writes

The preview endpoint SHALL authenticate current analyst role before accepting content/creating preparing and enforce owner isolation in application/RLS/RPC boundaries. Manager access MUST NOT substitute. It SHALL integrate TASK-8 snapshot/binding verification and TASK-9 validation, recheck supported version/published revision/generations/pairs/methods/current client resolution, reject catalog drift, return Vietnamese row errors/create-reuse counts and no official sample IDs. Browser mutations MUST use api-client and responses MUST be no-store. Audit MUST remain minimal and payload-free.

#### Scenario: Manager or another owner
- **WHEN** a manager or different analyst attempts preview ownership/read/seal operations
- **THEN** the operation fails closed without revealing another owner's preview or bindings

#### Scenario: Authority changes during preparation
- **WHEN** template version, published revision, referenced entity generation/pair/method or client resolution changes before seal
- **THEN** preparation rejects or fails without silently updating the commitment or writing business rows

#### Scenario: Valid preview
- **WHEN** the authenticated owner supplies a valid admitted workbook under current authority
- **THEN** the server returns a no-store preview with batch ID/DB expiry, create-reuse summaries and counts without official sample IDs or retained source/payload

### Requirement: Evidence distinguishes source readiness from runtime acceptance

Each implementation phase SHALL retain focused RED→GREEN tests, migration source checks where applicable, scoped lint/typecheck and OpenSpec strict validation. Source completion MUST NOT claim durable restart, behavioral SQL/RLS/security, stress, TTL/crash or full TASK-10 acceptance without separately authorized home-server runtime evidence including run_security_tests(). TASK-8 deferred acceptance and TASK-7/11/12 boundaries MUST remain open.

#### Scenario: Source checks pass without runtime
- **WHEN** local focused tests, typecheck/lint and strict OpenSpec pass but migration/runtime verification has not run
- **THEN** the handoff reports SOURCE ONLY and runtime INCOMPLETE rather than full TASK-10 DONE
