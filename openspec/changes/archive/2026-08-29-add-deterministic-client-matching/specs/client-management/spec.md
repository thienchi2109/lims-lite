## MODIFIED Requirements

### Requirement: Client registry with constrained identity
The system SHALL store clients in a dedicated, auditable registry with canonical
identity fields, soft lifecycle, and fail-closed duplication guardrails.
- `id` SHALL remain the immutable UUID primary key used by historical samples
  and results.
- `name`, `date_of_birth`, and `gender` SHALL remain required; `gender` SHALL
  remain constrained to {'Nam','Nữ','Khác'}.
- `phone` SHALL remain required by current client creation and CoA
  authentication; `address`, `health_insurance_num`, and `expiry_date` SHALL
  remain optional profile fields, and rows SHALL retain `created_at` and
  `updated_at`.
- Canonical government identity SHALL be nullable and typed as CCCD or CMND;
  CCCD SHALL contain exactly 12 digits and CMND exactly 9 digits.
- Legacy raw identity evidence MAY remain readable during rollout but SHALL NOT
  be treated as canonical unless it passes typed validation.
- Name normalization SHALL apply Unicode NFC, trim, collapsed whitespace, and
  case-folding while preserving Vietnamese diacritics.
- Date of birth SHALL be compared as an exact date.
- Phone normalization SHALL accept equivalent Vietnamese `+84` and `0` forms;
  the canonical phone projection SHALL be nullable, and historical placeholder
  `0000000000` SHALL normalize to missing/untrusted without changing the raw
  phone contract used by existing CoA authentication.
- Invalid, placeholder, and `BACKFILL-*` values SHALL be represented as
  missing/untrusted and SHALL NOT act as match signals.
- Active/inactive lifecycle SHALL use soft-delete fields with actor, timestamp,
  and required reason; hard deletion SHALL NOT be permitted.
- Trusted CCCD/CMND values SHALL remain reserved across active and inactive
  clients.
- The former unconditional (`name`, `date_of_birth`) uniqueness rule SHALL be
  replaced by deterministic candidate resolution; equal names and birth dates
  SHALL NOT by themselves merge or overwrite clients.
- Rows SHALL remain covered by created/updated timestamps, immutable audit
  evidence, existing confidentiality controls, and RLS.

#### Scenario: Create client with a valid CCCD
- **WHEN** an authorized workflow receives `not_found` and submits a new client
  with a valid 12-digit CCCD, validated name, exact date of birth, and allowed
  gender plus a valid phone through transactional resolve-and-create
- **THEN** the system SHALL store CCCD as the canonical typed identity
- **AND** SHALL store the normalized identity projections
- **AND** SHALL record the creation through existing audit and RLS boundaries

#### Scenario: Create client without government identity
- **WHEN** an authorized workflow receives a `not_found` resolver outcome for a
  client with validated name and exact date of birth but no valid CCCD or CMND
- **THEN** the system SHALL allow atomic creation with nullable canonical
  government identity
- **AND** the required phone SHALL be valid and non-conflicting
- **AND** no existing normalized name/date-of-birth candidate SHALL exist

#### Scenario: Reject invalid gender or missing required profile data
- **WHEN** client creation is attempted with `gender` outside
  {'Nam','Nữ','Khác'} or any required name/date-of-birth/gender field missing
- **THEN** the system SHALL return a validation error
- **AND** SHALL NOT create or update a client row

#### Scenario: Reject invalid or placeholder identity as canonical
- **WHEN** submitted government identity has an invalid length, contains
  non-digits, starts with `BACKFILL-`, or phone equals `0000000000`
- **THEN** the system SHALL classify that value as missing/untrusted
- **AND** SHALL NOT use it to match or satisfy canonical uniqueness

#### Scenario: Preserve CoA phone authentication contract
- **WHEN** a client is created or an existing client authenticates for CoA
- **THEN** the current required raw-phone request and lookup contract SHALL
  remain available
- **AND** a new client SHALL NOT use `0000000000` as a valid required phone
- **AND** canonical nullable-phone cleanup SHALL NOT change CoA behavior in this
  change

#### Scenario: Preserve distinct people with the same name and birth date
- **WHEN** two clients have the same normalized name and date of birth but
  different trusted government identities
- **THEN** the system SHALL preserve them as separate client UUIDs
- **AND** SHALL NOT merge or overwrite either identity

#### Scenario: Deactivate instead of deleting a client
- **WHEN** an authorized manager removes a client from active use with a reason
- **THEN** the system SHALL retain the same client UUID and historical links
- **AND** SHALL record inactive timestamp, actor, reason, and audit evidence
- **AND** hard DELETE SHALL NOT occur

#### Scenario: Preserve allowed non-identity profile edits
- **WHEN** an authorized existing workflow updates allowed address,
  health-insurance, or expiry profile data without changing identity/lifecycle
- **THEN** the compatible route and response contract SHALL remain available
- **AND** existing validation, confidentiality, RLS, audit, and timestamp
  behavior SHALL remain unchanged

### Requirement: QR intake mapping for clients
The system SHALL parse supported CCCD/CMND QR payloads into normalized client
input without storing the raw payload or changing scanner transport behavior.
- The supported payload layout SHALL remain
  `id_card_num|health_insurance_num|name|DDMMYYYY|gender|`.
- The existing health-insurance segment SHALL remain ignored by QR intake and
  SHALL NOT overwrite stored profile data.
- Parsed government identity SHALL include its explicit CCCD or CMND type.
- Date of birth SHALL be converted from `DDMMYYYY` to an exact date and gender
  SHALL be validated against {'Nam','Nữ','Khác'}.
- Parsed input SHALL be sent to the shared deterministic resolver rather than
  upserted by raw name and date of birth.

#### Scenario: Resolve a valid QR identity
- **WHEN** an analyst scans a valid supported identity QR payload
- **THEN** the system SHALL normalize the typed government identity, name, date
  of birth, gender, and any supplied phone
- **AND** SHALL resolve the client through the shared server-side contract
- **AND** SHALL NOT store the raw QR string

#### Scenario: Reject malformed QR payload
- **WHEN** a QR scan omits required segments or includes an invalid identity,
  date, or gender value
- **THEN** the system SHALL reject the payload with clear Vietnamese guidance
- **AND** SHALL NOT create or update any client record

#### Scenario: QR identity conflicts with an existing client
- **WHEN** a parsed government identity points to a client whose normalized name
  or exact date of birth disagrees with the QR input
- **THEN** the system SHALL return `conflict`
- **AND** SHALL display `Xung đột thông tin` with an actionable Vietnamese reason
- **AND** SHALL NOT overwrite, merge, or create a replacement client

## ADDED Requirements

### Requirement: Deterministic client identity resolution
The system SHALL expose one transactional server-side resolver used by client
upsert, QR/manual accession, and later bulk-accession callers.

#### Scenario: Match by trusted government identity
- **WHEN** a valid typed CCCD or CMND resolves to exactly one active client and
  normalized name, exact date of birth, and supplied phone all agree
- **THEN** the resolver SHALL return `matched`
- **AND** SHALL NOT mutate the client

#### Scenario: Do not fall back after government identity disagreement
- **WHEN** a valid typed CCCD or CMND is duplicated, resolves to an inactive
  client, or disagrees with normalized name, date of birth, or phone candidates
- **THEN** duplicate candidates SHALL return `ambiguous`
- **AND** inactive or disagreeing candidates SHALL return `conflict`
- **AND** SHALL NOT fall back to name/date-of-birth matching

#### Scenario: Return not found for an unknown trusted identity
- **WHEN** a valid typed CCCD or CMND matches no active or inactive client and
  no name/date-of-birth, accent-only, or phone collision signal exists
- **THEN** the resolver SHALL return `not_found`
- **AND** only transactional resolve-and-create MAY create the client

#### Scenario: Fail closed for conflicting fallback candidates
- **WHEN** no valid CCCD or CMND is supplied and name/date-of-birth candidates
  are multiple, inactive, accent-fold-only, or conflict with supplied phone
- **THEN** multiple exact candidates SHALL return `ambiguous`
- **AND** inactive, accent-only, or phone-conflicting candidates SHALL return
  `conflict`
- **AND** the resolver SHALL NOT create or mutate a client

#### Scenario: Match without government identity
- **WHEN** no valid CCCD or CMND is supplied and normalized name plus exact date
  of birth identify exactly one active client whose phone is absent or agrees
- **THEN** the resolver SHALL return `matched`
- **AND** phone alone SHALL NOT create the match

#### Scenario: Return not found for safe creation
- **WHEN** no active, inactive, exact, accent-fold-only, phone, or trusted
  government-identity collision signal exists
- **THEN** the resolver SHALL return `not_found`
- **AND** only that outcome SHALL be eligible for atomic client creation

#### Scenario: Serialize concurrent resolution and creation
- **WHEN** concurrent callers attempt to resolve and create the same normalized
  identity
- **THEN** the database SHALL serialize the decision under deterministic
  transaction-scoped locks
- **AND** no two clients SHALL be created from the same observed absence

#### Scenario: Hide restricted candidates without permitting duplicates
- **WHEN** one or more matching candidates are confidential or otherwise not
  visible to the authorized caller
- **THEN** the resolver SHALL return `conflict` with a stable non-disclosing
  reason and no client identifier
- **AND** SHALL NOT reveal candidate existence, attributes, or count
- **AND** SHALL NOT permit client creation

### Requirement: Localized resolver outcomes
The system SHALL retain stable machine outcomes and reason codes while returning
clear Vietnamese labels and actionable messages to users.

#### Scenario: Display a matched outcome
- **WHEN** the resolver returns `matched`
- **THEN** the user-facing label SHALL be `Đã khớp`

#### Scenario: Display a not-found outcome
- **WHEN** the resolver returns `not_found`
- **THEN** the user-facing label SHALL be `Không tìm thấy khách hàng`
- **AND** the message SHALL explain that creation occurs only after confirmation

#### Scenario: Display an ambiguous outcome
- **WHEN** the resolver returns `ambiguous`
- **THEN** the user-facing label SHALL be `Không thể xác định duy nhất`
- **AND** the message SHALL explain that a manager must resolve the duplicate

#### Scenario: Display a conflicting outcome
- **WHEN** the resolver returns `conflict`
- **THEN** the user-facing label SHALL be `Xung đột thông tin`
- **AND** the message SHALL identify the actionable conflict without exposing
  raw database errors or unnecessary candidate PII

#### Scenario: Include bulk row context without retaining source PII
- **WHEN** a future bulk caller supplies sheet, row, column, or temporary
  reference context
- **THEN** the localized error SHALL include that context
- **AND** audit/error persistence SHALL NOT retain the source row or PII-rich
  normalized payload

### Requirement: Audited client lifecycle and adjudication
The system SHALL restrict client correction, deactivation, restoration, and
legacy collision adjudication to authorized managers using reason-required,
audited server-side contracts.

#### Scenario: Analyst cannot override a failed match
- **WHEN** an analyst receives `ambiguous` or `conflict`, including an inactive
  or restricted-candidate reason
- **THEN** the system SHALL reject override or forced client selection
- **AND** SHALL direct the analyst to manager adjudication in Vietnamese

#### Scenario: Manager corrects client identity
- **WHEN** an authorized manager submits a valid identity correction with a
  reason and no active or reserved identity conflict exists
- **THEN** the system SHALL update the same client UUID atomically
- **AND** SHALL record actor, reason, before/after identity, and audit evidence
- **AND** SHALL NOT rewrite historical sample or result links

#### Scenario: Manager adjudicates a legacy collision
- **WHEN** an authorized manager resolves a classified legacy collision with an
  explicit reason and a conflict-free canonical disposition
- **THEN** the system SHALL preserve every affected client UUID unless a
  separately authorized correction explicitly changes one record
- **AND** SHALL record the disposition and before/after evidence atomically
- **AND** SHALL NOT auto-merge clients or relink historical samples/results

#### Scenario: Manager restores the same client
- **WHEN** an authorized manager restores an inactive client with a reason and
  no active identity conflict exists
- **THEN** the system SHALL reactivate the same UUID
- **AND** SHALL record actor, reason, before/after state, and audit evidence

#### Scenario: Restore fails on active identity conflict
- **WHEN** an inactive client's trusted government identity, normalized phone,
  or normalized name/date-of-birth conflicts with an active client
- **THEN** restoration SHALL fail closed
- **AND** SHALL NOT merge clients or rewrite historical sample links

#### Scenario: Security or audit persistence is unavailable
- **WHEN** role verification, RLS, or required audit persistence fails
- **THEN** the adjudication mutation SHALL fail atomically
- **AND** SHALL return a sanitized Vietnamese error

### Requirement: Cleanup-gated identity enforcement
The system SHALL classify and adjudicate legacy identity state before canonical
uniqueness or direct-mutation enforcement is enabled.

#### Scenario: Classify placeholders without inventing identity
- **WHEN** a forward-only migration encounters invalid/backfill government
  identity or placeholder phone data
- **THEN** it SHALL preserve the historical raw evidence where required
- **AND** SHALL set the canonical representation to missing/untrusted
- **AND** SHALL NOT generate a plausible replacement value

#### Scenario: Block enforcement while collisions remain
- **WHEN** the cleanup checkpoint reports unresolved canonical collisions
- **THEN** the migration SHALL fail before enabling uniqueness or mutation guards
- **AND** current application callers SHALL remain on the compatible path

#### Scenario: Enforce trusted government identity reservation
- **WHEN** cleanup and manager adjudication are complete
- **THEN** the database SHALL enforce uniqueness of non-null typed CCCD/CMND
  across active and inactive clients
- **AND** direct changes that bypass audited manager contracts SHALL be rejected

#### Scenario: Preserve RLS and function security
- **WHEN** resolver or adjudication functions are created or replaced
- **THEN** they SHALL use fixed `search_path`, explicit analyst/manager role
  checks, minimal grants, and documented security impact
- **AND** `run_security_tests()` SHALL pass after every applied migration
