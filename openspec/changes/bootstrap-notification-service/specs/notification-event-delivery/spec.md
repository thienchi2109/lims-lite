## ADDED Requirements

### Requirement: Outbox ingestion is durable and idempotent
The Notification Service SHALL convert each supported LIMS outbox event into one durable SQLite job before acknowledging the source event.

#### Scenario: New completion event is ingested
- **WHEN** the service claims a valid `sample.completed.v1` event
- **THEN** it commits one job keyed by `event_id`
- **AND** preserves the event's `app_id`, recipient, sample ID, sample code, and occurrence time using the versioned field encodings
- **AND** acknowledges the source event only after the SQLite commit

#### Scenario: Process crashes before acknowledgement
- **WHEN** a job commits but the service crashes before acknowledging the LIMS event
- **THEN** later ingestion reuses the existing job
- **AND** creates no duplicate job

#### Scenario: Unsupported event version is claimed
- **WHEN** the service claims an event version it does not support
- **THEN** it reports a non-retryable ingestion failure using the current claim token
- **AND** the LIMS event enters terminal quarantine
- **AND** does not silently acknowledge or deliver it

#### Scenario: An expired claim is completed by a stale worker
- **WHEN** a worker acknowledges, releases, or fails an event using an expired claim token
- **THEN** LIMS rejects the stale operation
- **AND** the service does not overwrite the newer claim state

### Requirement: Completion jobs target one application and analyst
The Notification Service SHALL fan out a completion job only to enabled installations matching the event's `app_id` and snapshotted `recipient_user_id`.

#### Scenario: Recipient has multiple enabled browsers
- **WHEN** a completion job is processed for an analyst with multiple enabled installations
- **THEN** the service creates one delivery for each enabled installation
- **AND** snapshots each installation's `app_id`, owner user, and `owner_version`

#### Scenario: Recipient has no enabled browser
- **WHEN** a completion job is processed for an analyst with no enabled installation
- **THEN** the service completes the job as having no eligible delivery
- **AND** does not redirect it to another analyst, doctor, or manager

#### Scenario: One installation is disabled
- **WHEN** an analyst has enabled and disabled installations
- **THEN** the service creates deliveries only for the enabled installations

#### Scenario: Another application has an installation for the same user
- **WHEN** the same user ID has an enabled installation under a different `app_id`
- **THEN** the service creates no delivery for that installation

### Requirement: Distinct completion events are delivered independently
The Notification Service SHALL deliver every distinct completion event while deduplicating retries of the same event.

#### Scenario: Sample is completed for the first time
- **WHEN** the service ingests the first completion event for a sample
- **THEN** it creates and processes its job

#### Scenario: Sample is reopened and completed again
- **WHEN** the service ingests a later completion event with a new `event_id` for the same sample
- **THEN** it creates and processes another job

#### Scenario: Same event is ingested repeatedly
- **WHEN** the same `event_id` is claimed more than once
- **THEN** the service reuses the existing job and deliveries

### Requirement: Job completion has explicit terminal semantics
The Notification Service SHALL record a durable terminal job outcome after fan-out and delivery processing.

#### Scenario: Recipient has no eligible installation
- **WHEN** fan-out finds zero installations
- **THEN** the job becomes `completed_no_targets`
- **AND** records a target count of zero and completion time

#### Scenario: All deliveries reach terminal states
- **WHEN** every delivery for a job is `accepted_by_fcm`, `failed`, or `expired`
- **THEN** the job becomes `completed`
- **AND** preserves separate accepted, failed, and expired counts for operations

#### Scenario: Process restarts during fan-out
- **WHEN** the service stops during job fan-out
- **THEN** transactional fan-out or idempotent recovery produces the same target set
- **AND** creates no duplicate delivery row

### Requirement: FCM payload is fixed and privacy limited
The Notification Service SHALL send a data-only FCM message containing only the approved visible sample-code presentation and provider metadata required for FCM delivery.

#### Scenario: Service builds a completion message
- **WHEN** the worker sends a completion delivery
- **THEN** the data envelope identifies the versioned completion presentation
- **AND** the title is `Mẫu đã hoàn thành`
- **AND** the body is `Mẫu {sample_code} đã được phê duyệt`

#### Scenario: Payload is inspected
- **WHEN** a completion payload is created
- **THEN** it contains no customer, patient, result, assay, confidential flag, sample UUID, `app_id`, URL, or deep link

### Requirement: Delivery status reflects provider acceptance rather than device delivery
The Notification Service SHALL record provider handoff truthfully and SHALL NOT infer that an accepted FCM message was displayed.

#### Scenario: FCM accepts a message
- **WHEN** Firebase Admin returns a message ID
- **THEN** the delivery becomes `accepted_by_fcm`
- **AND** stores the message ID as operational metadata

#### Scenario: FCM provides no device acknowledgement
- **WHEN** the service has only an FCM acceptance response
- **THEN** it does not record `delivered` or `read`

### Requirement: Provider submission is at-least-once
The Notification Service SHALL use leases and fencing to prevent duplicate internal state but SHALL NOT claim exactly-once FCM submission or browser display.

#### Scenario: Process crashes after FCM accepts a message
- **WHEN** FCM accepts a message but the process stops before committing `accepted_by_fcm`
- **THEN** the expired delivery lease is recoverable
- **AND** a later attempt may submit the message again
- **AND** operations can distinguish attempts without creating a duplicate delivery row

### Requirement: Retry policy distinguishes transient and permanent failures
The Notification Service SHALL retry transient failures with bounded backoff and SHALL stop retrying permanent failures.

#### Scenario: FCM returns a transient quota or availability failure
- **WHEN** a delivery receives a retryable response
- **THEN** the service schedules another attempt using bounded exponential backoff and jitter

#### Scenario: FCM reports an unregistered installation
- **WHEN** a delivery receives a permanent unregistered response
- **THEN** the service marks the delivery failed
- **AND** disables the installation only when its current owner and `owner_version` match the delivery snapshot
- **AND** does not retry that installation

#### Scenario: Message payload is invalid
- **WHEN** FCM rejects a delivery because the message payload is invalid
- **THEN** the service fails the delivery and alerts operations
- **AND** does not automatically disable the installation

#### Scenario: Retry budget is exhausted
- **WHEN** a transient delivery exceeds its configured attempt or age limit
- **THEN** the service marks it `expired`
- **AND** preserves the failure history for operations
