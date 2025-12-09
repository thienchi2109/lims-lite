## ADDED Requirements

### Requirement: Samples linked to clients with snapshot naming
The system SHALL require every sample to reference a client while retaining a snapshot of the client name for audit/history.
- Columns: `client_id UUID NOT NULL REFERENCES clients(id)`, `client_name TEXT NOT NULL` (snapshot from clients.name).
- Behavior: a trigger SHALL set `client_name` from the linked client on insert/update; manual edits to client_name are not required for linkage.

#### Scenario: Create sample for an existing client
- **GIVEN** a client exists in the registry
- **WHEN** a user creates a sample with `client_id` set to that client
- **THEN** the system SHALL auto-fill `client_name` from the client row
- **AND** persist both the FK and snapshot name
- **AND** maintain existing `sample_status` enum for `status`

#### Scenario: Reject sample without client linkage
- **WHEN** a sample creation attempt omits `client_id`
- **THEN** the system SHALL reject the request before insert
- **AND** SHALL NOT create a sample row

---

### Requirement: Sample type validation via CHECK list
The system SHALL validate `samples.type` as TEXT against the allowed Vietnamese list: `Máu`, `Dịch niệu đạo/âm đạo`, `Nước tiểu`, `Phết tế bào âm đạo`, `Ngoáy trực tràng/hậu môn`, `Phân`, `Nước`, `Thực phẩm`.

#### Scenario: Accept allowed sample type
- **WHEN** a sample is created with `type = 'Nước tiểu'`
- **THEN** the insert SHALL succeed
- **AND** the type value SHALL be stored as TEXT

#### Scenario: Reject disallowed sample type
- **WHEN** a sample creation or update uses `type = 'Khác'`
- **THEN** the system SHALL reject the operation due to the CHECK constraint
- **AND** SHALL return a validation error
