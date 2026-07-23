## ADDED Requirements

### Requirement: Installation operations are private and authenticated
The Notification Service SHALL accept installation lifecycle operations only from the authenticated LIMS backend over the private service network.

#### Scenario: Valid LIMS request is accepted
- **WHEN** LIMS sends a valid, timely, replay-resistant installation request
- **THEN** the service validates the request and processes the operation

#### Scenario: Browser calls the service directly
- **WHEN** a browser or unauthenticated caller invokes the installation API
- **THEN** the service rejects the request
- **AND** reveals no installation data

#### Scenario: Request is replayed
- **WHEN** a previously accepted signed request is submitted again outside the allowed replay contract
- **THEN** the service rejects it without mutating installation state

### Requirement: FID registration is idempotent and rebindable
The Notification Service SHALL treat `(app_id, fid)` as one browser installation, SHALL bind it to the currently authenticated LIMS user supplied by the trusted backend, and SHALL version ownership changes.

#### Scenario: Same analyst refreshes the same FID
- **WHEN** LIMS upserts an existing `(app_id, fid)` for its current user
- **THEN** the service updates `last_seen_at` and enabled state without creating a duplicate
- **AND** leaves `owner_version` unchanged when the same active owner is refreshed

#### Scenario: Another analyst uses the same browser
- **WHEN** LIMS upserts an existing `(app_id, fid)` for a different current user
- **THEN** the service transfers the installation to the new user
- **AND** increments `owner_version`
- **AND** returns an opaque installation handle and the new ownership generation
- **AND** the previous user is no longer associated with that FID

#### Scenario: Analyst enables multiple browsers
- **WHEN** LIMS registers distinct FIDs for the same analyst
- **THEN** the service keeps every enabled installation

### Requirement: Installations can be disabled without deleting history
The Notification Service SHALL compare-and-disable installations on logout, explicit current-browser opt-out, permission revocation, permanent FCM invalidation, or stale-installation maintenance without deleting history.

#### Scenario: LIMS disables current browser on logout
- **WHEN** LIMS sends a valid disable request with the opaque installation handle and expected `app_id`, owner, and `owner_version`
- **THEN** the service marks it disabled
- **AND** excludes it from future fan-out

#### Scenario: Delayed logout targets an older owner
- **WHEN** a handle-targeted disable request arrives after that installation has been rebound or reactivated to a newer ownership generation
- **THEN** the service performs an idempotent no-op
- **AND** leaves the newer installation enabled

#### Scenario: Disable request targets another installation
- **WHEN** the supplied opaque handle does not identify the installation matching the expected application, owner, and generation
- **THEN** the service performs no mutation
- **AND** does not disable another browser with the same owner version

#### Scenario: FCM reports permanent invalidation
- **WHEN** FCM reports that a delivery's snapshotted installation is permanently unregistered
- **THEN** the service atomically disables it only when current `app_id`, owner, opaque installation handle, and `owner_version` all match the delivery snapshot
- **AND** otherwise performs an idempotent no-op
- **AND** preserves its historical delivery records

#### Scenario: Old delivery reports permanent invalidation
- **WHEN** an unregistered response belongs to a different application, owner, handle, or ownership generation
- **THEN** the service does not disable the current installation

#### Scenario: Installation is later registered again
- **WHEN** LIMS upserts a previously disabled valid FID
- **THEN** the service re-enables it for the current user
- **AND** increments `owner_version`

### Requirement: Application namespaces are isolated
The Notification Service SHALL accept only configured `app_id` values and SHALL never mix installation ownership across application namespaces.

#### Scenario: LIMS registers an allowed application
- **WHEN** the authenticated LIMS backend supplies its configured `app_id`
- **THEN** the service stores and returns installation state only within that namespace

#### Scenario: Request supplies an unknown application
- **WHEN** an installation request supplies an `app_id` outside the configured allowlist
- **THEN** the service rejects the request without mutation

### Requirement: FIDs are protected operational data
The Notification Service SHALL protect FIDs from public access and routine log disclosure.

#### Scenario: Installation mutation is logged
- **WHEN** the service records an installation operation
- **THEN** logs contain an internal installation ID or redacted fingerprint
- **AND** do not contain the full FID

#### Scenario: LIMS requests another user's installation list
- **WHEN** a request attempts to enumerate or retrieve installations outside the supported current-user operation
- **THEN** the service rejects the request
