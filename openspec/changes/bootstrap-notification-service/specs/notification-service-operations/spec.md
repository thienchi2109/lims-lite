## ADDED Requirements

### Requirement: The service runs as one isolated SQLite-backed container
The Notification Service SHALL run one compiled Go API-and-worker binary with SQLite on a local persistent Docker volume.

#### Scenario: Service starts normally
- **WHEN** the container starts with valid configuration and a writable data volume
- **THEN** it applies forward SQLite migrations
- **AND** enables required database safety settings
- **AND** starts the API, ingestion goroutine, and delivery goroutine under one root cancellation context

#### Scenario: A second replica is requested
- **WHEN** operations attempts to run multiple authoritative service replicas
- **THEN** the deployment contract rejects or blocks that topology until the data store is migrated from SQLite

#### Scenario: SQLite volume is network mounted
- **WHEN** the configured database path is on an unsupported network filesystem
- **THEN** deployment verification fails before production activation

### Requirement: Runtime networking and secrets remain private
The Notification Service SHALL publish no public application port and SHALL load sensitive credentials only from protected runtime mounts or secret mechanisms.

#### Scenario: LIMS calls the private API
- **WHEN** the LIMS app and service join the approved external Docker network
- **THEN** LIMS can reach the service by its private service address

#### Scenario: Internet client attempts direct access
- **WHEN** an external client scans the home server
- **THEN** no Notification Service application port is exposed

#### Scenario: Container image is inspected
- **WHEN** the built image or repository is inspected
- **THEN** it contains no Firebase private key, service token, database password, tunnel token, SSH key, or age identity

#### Scenario: Production artifacts are prepared before rollout
- **WHEN** S4 completes before joint operational gate R0
- **THEN** the image and Compose configuration are production-ready
- **AND** ingestion, installation mutation, FCM delivery, and public rollout remain disabled

### Requirement: Health checks distinguish process and dependency readiness
The Notification Service SHALL expose private liveness and readiness checks that do not disclose sensitive configuration.

#### Scenario: Process is alive but SQLite is unavailable
- **WHEN** the process can answer HTTP but cannot access its database
- **THEN** liveness may remain healthy
- **AND** readiness reports failure

#### Scenario: LIMS outbox is temporarily unavailable
- **WHEN** SQLite and the API are healthy but LIMS PostgreSQL cannot be reached
- **THEN** readiness or dependency status reports degraded ingestion
- **AND** installation state remains available

#### Scenario: A critical worker exits or stalls
- **WHEN** an enabled ingestion or delivery goroutine exits unexpectedly or fails to advance within `worker_stall_timeout`
- **THEN** the root context is cancelled
- **AND** readiness fails while the process shuts down
- **AND** the process exits nonzero for Docker restart
- **AND** disabled workers are excluded from heartbeat enforcement

#### Scenario: Worker stall timeout is unsafe
- **WHEN** `worker_stall_timeout` is not greater than the worker's maximum operation deadline plus poll interval
- **THEN** production startup fails closed

### Requirement: SQLite backup and restore are operationally verified
The Notification Service SHALL use an online-safe, encrypted, access-restricted backup procedure to a destination outside the service host's failure domain and SHALL periodically verify that backups can be restored.

#### Scenario: Scheduled backup runs
- **WHEN** the backup schedule executes while the service is running
- **THEN** it creates a consistent backup using the approved SQLite backup method
- **AND** encrypts it with a separately managed key
- **AND** stores it in an access-restricted destination outside the service volume and home server
- **AND** applies bounded retention and rotation

#### Scenario: Restore drill runs
- **WHEN** operations performs a restore verification
- **THEN** the restored database passes integrity checks
- **AND** expected installation and pending-job records are readable

#### Scenario: Backup becomes stale
- **WHEN** no verified backup completes within the configured maximum age
- **THEN** operations receives an alert

#### Scenario: Backup or verification fails
- **WHEN** backup creation, integrity verification, or restore verification fails
- **THEN** operations receives an alert with no credential or FID disclosure

### Requirement: Operational logs and alerts are privacy safe
The Notification Service SHALL provide enough telemetry to diagnose backlog and delivery failure without logging prohibited data.

#### Scenario: Delivery attempt is logged
- **WHEN** a delivery succeeds or fails
- **THEN** logs may include event ID, job ID, internal installation ID, status, attempt count, latency, and normalized error code
- **AND** exclude full FIDs, credentials, patient data, customer data, and result values

#### Scenario: Outbox backlog grows
- **WHEN** pending event age or count exceeds the configured threshold
- **THEN** operations receives an alert

#### Scenario: Container shuts down
- **WHEN** Docker sends the configured termination signal
- **THEN** the service stops claiming new work
- **AND** cancels the HTTP server and workers through the root context
- **AND** safely releases work that has not been submitted externally
- **AND** waits up to the provider deadline for definitive results from dispatched FCM requests
- **AND** never marks an unknown provider outcome complete
- **AND** leaves an unresolved processing lease to expire for fenced at-least-once recovery
- **AND** closes SQLite cleanly before exit
