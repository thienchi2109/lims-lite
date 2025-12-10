## ADDED Requirements

### Requirement: Client registry with constrained identity
The system SHALL store clients in a dedicated table with required identity fields and duplication guardrails.
- Columns: `id` (UUID PK), `id_card_num` (TEXT NOT NULL), `name` (TEXT NOT NULL), `date_of_birth` (DATE NOT NULL), `gender` (TEXT NOT NULL with CHECK in {'Nam','Nữ','Khác'}), optional `address`, `health_insurance_num`, `expiry_date` (DATE), `created_at`, `updated_at`.
- Uniqueness: the system SHALL enforce a UNIQUE constraint on (`name`, `date_of_birth`).
- Auditability: rows SHALL carry created/updated timestamps and be covered by audit triggers.

#### Scenario: Create client from validated input
- **WHEN** a user submits client data with `id_card_num`, `name`, `date_of_birth`, and `gender` in the allowed list
- **THEN** the system SHALL persist a new client row with those values
- **AND** enforce the UNIQUE (`name`, `date_of_birth`) constraint
- **AND** record `created_at`/`updated_at` automatically

#### Scenario: Reject invalid gender or missing identity
- **WHEN** client creation is attempted with `gender` not in {'Nam','Nữ','Khác'} or any required field missing
- **THEN** the system SHALL reject the insert
- **AND** return a validation error without creating a row

#### Scenario: Prevent duplicate identity rows
- **WHEN** a client submission matches an existing (`name`, `date_of_birth`)
- **THEN** the system SHALL prevent a new row from being inserted (or upsert the existing row per API design)
- **AND** return the existing client identifier for linking samples

---

### Requirement: QR intake mapping for clients
The system SHALL parse QR payloads from ID cards to auto-fill client fields without storing the raw string.
- Mapping: `id_card_num|health_insurance_num|name|DDMMYYYY|gender|` (health insurance ignored, segment 1 unused).
- `date_of_birth` SHALL be converted from 8-digit DDMMYYYY to DATE; `gender` SHALL be validated against {'Nam','Nữ','Khác'}.

#### Scenario: Accept QR payload into client registry
- **WHEN** a sampler scans a QR code yielding `086094006827|331757192|NGUYỄN THIỆN CHÍ|21091994|Nam|`
- **THEN** the system SHALL map `id_card_num=086094006827`, `name=NGUYỄN THIỆN CHÍ`, `date_of_birth=1994-09-21`, `gender=Nam`
- **AND** upsert/select a client using (`name`, `date_of_birth`) uniqueness rules
- **AND** return the client identifier for downstream sample creation

#### Scenario: Reject malformed QR payload
- **WHEN** a QR scan omits required segments or includes an invalid gender value
- **THEN** the system SHALL reject the payload and prompt for manual correction
- **AND** SHALL NOT create or update any client record
