## ADDED Requirements

### Requirement: Canonical runtime ownership
The system SHALL run one writable agentmemory authority on the Oracle VM,
independent of interactive shells, OpenCode, `herdr`, and repository working
directories.

#### Scenario: Oracle VM reboots
- **WHEN** the Oracle VM completes a normal reboot
- **THEN** systemd starts the pinned agentmemory engine and worker as user `ubuntu`
- **AND** the canonical health endpoint becomes available without starting an interactive session

#### Scenario: Runtime process exits unexpectedly
- **WHEN** the canonical engine or worker exits unexpectedly
- **THEN** systemd restarts the failed service according to its restart policy
- **AND** the canonical store remains in the dedicated persistent data path

### Requirement: Stable private storage
The canonical runtime SHALL use absolute storage paths below
`/home/ubuntu/.local/share/agentmemory/` and SHALL restrict data access to the
runtime owner.

#### Scenario: Runtime starts from a different working directory
- **WHEN** systemd starts the runtime without the `lims-lite` checkout as its working directory
- **THEN** the engine opens the same canonical state and stream stores
- **AND** no agentmemory data is created beneath a Git checkout

#### Scenario: Storage permissions are inspected
- **WHEN** an operator inspects the canonical data directories and persisted files
- **THEN** directories are no broader than mode `0700`
- **AND** persisted files are no broader than mode `0600`

### Requirement: Loopback-only service exposure
The canonical agentmemory HTTP and stream listeners MUST bind only to loopback
interfaces and MUST NOT publish an Internet, Docker, Cloudflare, or Tailscale
listener.

#### Scenario: Listener state is verified
- **WHEN** an operator inspects TCP listeners on the Oracle VM
- **THEN** the agentmemory ports are bound to `127.0.0.1`
- **AND** no wildcard, public, or Tailscale address exposes those ports

### Requirement: Pinned runtime compatibility
The engine, worker, and client integration SHALL be pinned to agentmemory
`0.9.29` until an explicit upgrade procedure succeeds.

#### Scenario: Client configuration is inspected
- **WHEN** Codex and OpenCode MCP configurations are inspected
- **THEN** neither configuration resolves an unversioned latest agentmemory package
- **AND** both configurations identify compatibility with server version `0.9.29`

#### Scenario: Upgrade is attempted
- **WHEN** an operator upgrades any agentmemory component
- **THEN** a cold snapshot and logical export exist first
- **AND** import compatibility, tool contracts, fail-closed behavior, restart persistence, and cross-client recall are reverified

### Requirement: Off-host logical backups
The system SHALL create one compressed logical export every night on the
current VPS through the private tunnel and SHALL retain 14 daily, 8 weekly, and
6 monthly generations.

#### Scenario: Scheduled backup succeeds
- **WHEN** the nightly backup job reaches a healthy canonical service
- **THEN** it validates the export structure and memory set
- **AND** atomically publishes a `JSON.gz` file with mode `0600`
- **AND** writes a matching SHA-256 checksum

#### Scenario: Scheduled backup cannot validate the export
- **WHEN** the nightly backup cannot reach the canonical endpoint or the export is malformed
- **THEN** the job exits non-zero
- **AND** no invalid file replaces a previously valid backup
- **AND** retention cleanup does not delete valid generations for that failed run

#### Scenario: Backup schedule is inspected
- **WHEN** an operator inspects the enabled backup timer
- **THEN** it is configured to run once every calendar night
- **AND** a missed or failed run is visible as an operational failure

#### Scenario: Backup restore is rehearsed
- **WHEN** an operator performs the documented restore rehearsal
- **THEN** the selected export restores into a temporary empty store
- **AND** every restored durable record and exported access log matches the backed-up export field by field after documented normalization
- **AND** the canonical production store is not modified

### Requirement: Secret-safe repository boundary
The repository SHALL document canonical operations without containing live
credentials, private keys, memory payloads, backups, or installed host runtime
files.

#### Scenario: Repository changes are reviewed
- **WHEN** the centralization change is reviewed before commit
- **THEN** only OpenSpec artifacts, agent guidance, and secret-safe runbook content are tracked
- **AND** host credentials, backups, and live unit files remain untracked
