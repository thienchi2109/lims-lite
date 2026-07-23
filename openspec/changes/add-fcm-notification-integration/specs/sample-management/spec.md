## ADDED Requirements

### Requirement: Final approval and sample completion are committed atomically
The system SHALL perform the authoritative final result approval, sample status recomputation, completion transition, and required completion event or recipient-anomaly write in one database transaction.

#### Scenario: Final entered results complete a sample with a valid recipient
- **WHEN** an authorized manager approves the remaining eligible entered results for a sample in `review` whose `received_by` identifies an active analyst
- **THEN** the system marks those results `approved`
- **AND** changes the sample from `review` to `completed`
- **AND** commits one `sample.completed.v1` outbox event in the same transaction

#### Scenario: Partial approval keeps the sample under review
- **WHEN** an authorized manager approves eligible results but other active results remain unapproved
- **THEN** the system keeps the sample in `review`
- **AND** creates no `sample.completed.v1` event

#### Scenario: Approval validation fails closed
- **WHEN** authorization, confidentiality access, QC eligibility, sample state, or result state validation fails
- **THEN** the system commits none of the result approval, sample completion, or outbox event changes

#### Scenario: Required integration record insertion fails
- **WHEN** the sample would transition to `completed` but its required outbox event or recipient anomaly cannot be inserted
- **THEN** the database transaction fails
- **AND** the system does not report final approval success

### Requirement: Each completed transition records a recipient outcome
The system SHALL emit one new versioned completion event for every committed `review -> completed` transition with a valid receiving analyst, and SHALL otherwise record a durable recipient anomaly.

#### Scenario: Event targets the receiving analyst
- **WHEN** a sample transitions from `review` to `completed`
- **THEN** the event `recipient_user_id` equals the sample's `received_by` user at that time
- **AND** no doctor or manager recipient is added

#### Scenario: Receiving user is not an active analyst
- **WHEN** a sample transitions from `review` to `completed` but `received_by` is missing, soft-deleted, or no longer identifies an analyst
- **THEN** sample completion succeeds
- **AND** the system emits no notification event
- **AND** records `sample.completed.recipient_invalid.v1` in the same transaction with a reason code, sample ID, actor ID, and transition time
- **AND** records no customer, patient, assay, or result data in the anomaly

#### Scenario: Completion after reopening emits another event
- **WHEN** a completed sample returns to `review` and later transitions to `completed` again
- **THEN** the system emits a new event with a new `event_id`

#### Scenario: Repeated completed update emits no event
- **WHEN** a sample update leaves its status as `completed`
- **THEN** the system emits no additional completion event

### Requirement: Completion events contain only the approved integration contract
The system SHALL constrain `sample.completed.v1` to the minimum fields required for traceability, recipient routing, and visible sample-code notification.

#### Scenario: Event payload is privacy limited
- **WHEN** the system creates `sample.completed.v1`
- **THEN** it records canonical-string UUIDs for `event_id`, `sample_id`, and `recipient_user_id`
- **AND** records server-derived `app_id`, non-empty `sample_code`, and UTC RFC 3339 `occurred_at`
- **AND** it records no customer, patient, result, assay, confidential-association, or deep-link data

#### Scenario: Outbox is inaccessible to application roles
- **WHEN** an `anon` or general `authenticated` database role attempts to read or mutate the integration outbox
- **THEN** access is denied

#### Scenario: Dedicated consumer claims an event
- **WHEN** the Notification Service claims a bounded batch
- **THEN** each event includes a fresh `claim_token` and `lease_expires_at`
- **AND** immutable event payload fields remain separate from mutable claim metadata

#### Scenario: Dedicated consumer completes a claim
- **WHEN** the Notification Service acknowledges, releases, or reports failure for an event
- **THEN** it uses the narrowly granted outbox functions
- **AND** supplies the current claim token
- **AND** a stale or repeated operation cannot overwrite a newer claim
- **AND** receives no general access to LIMS application tables

#### Scenario: Consumer reports unsupported or malformed event
- **WHEN** the Notification Service reports a non-retryable contract failure with the current claim token
- **THEN** the event enters a retained terminal quarantine state
- **AND** it is not repeatedly reclaimed for delivery
