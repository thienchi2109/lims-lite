## ADDED Requirements

### Requirement: Authenticated owner-only HTTP boundary

The system SHALL expose confirmation and file-free status only to the current active analyst who owns the batch, enforcing existing confidentiality/session checks in both application and database boundaries. The server MUST derive actor identity from the authenticated request, validate the batch UUID and conceal inaccessible batches. Manager history SHALL remain outside these endpoints. Responses MUST use private no-store caching and safe Vietnamese errors.

#### Scenario: Wrong actor or withdrawn role
- **WHEN** an anonymous, manager, nonowner, deleted or no-longer-analyst user requests confirmation or status
- **THEN** the system denies the request without exposing batch state, processing existence, source commitment, receipt or entity IDs

#### Scenario: Status lookup needs no source
- **WHEN** an authorized owner requests GET status without a workbook or attestation
- **THEN** the system authenticates and obtains the protected status without requiring source/configuration used only for new confirmation

### Requirement: Original source and attestation are immutable authorities

New confirmation SHALL accept one original workbook strictly below 10,000,000 decimal bytes and explicit true attestation that all samples are collected and acceptable. It MUST reject malformed/duplicate/unknown multipart fields and MUST NOT accept actor, normalized JSON, IDs, client hashes, received time or metadata as authority. Trusted existing preparation MUST reparse/revalidate exact source SHA-256/size, canonicalization version/normalized commitment, snapshot, bindings and current authority; changed data MUST NOT replace the sealed preview.

#### Scenario: Exact file ceiling
- **WHEN** fresh confirmation supplies an otherwise admissible original file of 9,999,999 bytes, 10,000,000 bytes or 10,000,001 bytes
- **THEN** only 9,999,999 bytes passes the file-size ceiling, independently of additional measured resource-policy checks

#### Scenario: Changed bytes or missing attestation
- **WHEN** new confirmation has different original bytes, changed normalized intent/version or no exact true quality attestation
- **THEN** existing trusted confirmation validation fails closed for the whole batch without changing immutable commitment or creating business rows

#### Scenario: Forged authority fields
- **WHEN** a request contains client-supplied actor, normalized payload, resolved ID, received time, metadata or duplicate multipart values
- **THEN** transport validation rejects the unsupported shape before atomic dispatch

### Requirement: One existing atomic confirmation dispatch

The HTTP bridge SHALL invoke the existing `confirmAccession` adapter at most once per request and SHALL NOT create an alternate writer, direct browser privileged RPC or per-row write loop. Before reading source it MUST obtain protected lock-aware status: processing/unknown or a committed terminal state MUST return safely without a new adapter call; only an unlocked valid preview_ready SHALL proceed. The atomic RPC MUST still resolve preflight races under its own lock. New accepted confirmation MUST retain TASK-11 atomicity, role/owner recheck and receipt validation. An authorized succeeded repeat SHALL return the same committed receipt without source, attestation or confirmation-only configuration and MUST NOT write another audit acceptance or extend TTL.

#### Scenario: Preflight finds in-flight or uncertain result
- **WHEN** POST preflight reports processing or unknown
- **THEN** it returns the lookup outcome without reading source or dispatching confirmation again

#### Scenario: First request succeeds
- **WHEN** an authorized request supplies matching original bytes and attestation
- **THEN** the bridge dispatches through the existing adapter once and returns only its validated committed outcome

#### Scenario: Successful repeat without source
- **WHEN** an authorized owner repeats confirmation for a succeeded batch without sending a file
- **THEN** the same existing receipt is returned and no new business action occurs

### Requirement: Status observes the batch lock and committed state

Status SHALL authorize the actor before exposing any outcome, obtain the batch lock without waiting and distinguish inaccessible/missing batches from lock contention. A held batch lock MUST produce processing without official IDs or any inferred preview_ready/failure/expiry result. When unlocked, status MUST read and validate committed state and authorized receipt within the same database RPC transaction. Unlocked logical expiry MUST use database time. Status SHALL NOT change lifecycle state, create a lifecycle audit, purge data or extend TTL.

#### Scenario: Accepted transaction crosses deadline
- **WHEN** confirmation accepted before expiry holds the batch lock after the deadline
- **THEN** status reports processing without IDs and does not mark the batch expired or interfere with commit

#### Scenario: Success committed before lookup
- **WHEN** the owner obtains status after successful commit
- **THEN** the validated durable receipt is returned without workbook and without replaying confirmation

#### Scenario: Unlocked preview reaches expiry
- **WHEN** an unlocked preview_ready batch has database time greater than or equal to expires_at
- **THEN** lookup reports logical expiry without mutating or physically purging the batch

### Requirement: Uncertain outcomes require lookup before retry

HTTP timeout, browser disconnect, RPC/DB outage or invalid upstream response SHALL NOT be interpreted as business failure. Once confirmation is dispatched, the bridge MUST preserve unknown outcome semantics, avoid aborting an accepted transaction merely because the caller disconnects and MUST NOT retry writes automatically. Before another confirmation following an uncertain result, the workflow SHALL use status. Terminal failed/rejected/expired attempts SHALL use a new same-owner linked attempt; terminal state MUST NOT reset. A valid unlocked preview_ready requires the identical original file to confirm again.

#### Scenario: Lost response after commit
- **WHEN** the response is lost after the database commits
- **THEN** lookup returns the existing success receipt and no duplicate import is attempted

#### Scenario: Failure before dispatch
- **WHEN** multipart admission fails or disconnects before the adapter is dispatched
- **THEN** the bridge returns safe admission/cancellation failure and performs no atomic confirmation call

#### Scenario: Source lost while result uncertain
- **WHEN** the owner loses the file after a request with unknown outcome
- **THEN** lookup remains available without source; success returns receipt, processing/unknown requires further lookup, and only a known unlocked preview_ready can require exact file reselection or an allowed new linked attempt

### Requirement: Preparing recovery is fenced and does not replay writes

Recovery SHALL use existing lease token/generation/heartbeat authority, acquire the batch lock and verify committed state before terminalizing an abandoned preparing request. It MUST preserve active work and record only safe recovery audit. No recovery runner SHALL replay confirmation business writes or infer rollback from elapsed HTTP time.

#### Scenario: Stale preparing request
- **WHEN** the runner obtains a preparing batch lock and proves its lease expired with no live fenced owner
- **THEN** it records safe terminal preparation failure, and a stale heartbeat cannot resurrect the attempt

#### Scenario: Restart or database outage
- **WHEN** the runner restarts or cannot reach the database
- **THEN** it does not replay import writes and resumes maintenance only after lock/state reconciliation is available

### Requirement: Physical cleanup preserves durable provenance

Physical purge SHALL occur only after hard logical expiry and successful eligible-batch lock acquisition. It MUST remove only approved transient commitment/binding material, preserve minimal lifecycle metadata and audit cleanup, and MUST NOT delete receipt, dedup claim, mapping, business entity or audit. It SHALL skip a locked accepted transaction and SHALL NOT change its outcome.

#### Scenario: Purge races confirmation
- **WHEN** purge meets an accepted confirmation holding the batch lock
- **THEN** it skips that batch and preserves all confirmation data until committed outcome can be reconciled

#### Scenario: Expired transient commitment
- **WHEN** a safely locked eligible batch reaches physical cleanup
- **THEN** only transient commitment/binding data is removed and durable receipt/dedup/mapping/audit remain available

### Requirement: Privacy and evidence are enforced across distinct lanes

The system SHALL retain no workbook or complete normalized payload in database, disk, temporary files, logs or caches. Endpoints MUST reject unsafe response shapes and avoid raw exceptions/PII/temporary refs. Source checks SHALL remain distinct from actual authenticated HTTP, SQL/security, concurrency, worker/restart, proxy retention and capacity evidence. Runtime operations MUST occur only in a separately authorized home-server session.

#### Scenario: Source-only route tests pass
- **WHEN** mocked HTTP/adapter and migration source tests pass
- **THEN** evidence labels them source-only and keeps TASK-11 adapter runtime gates, real SQL/security execution and TASK-7 acceptance incomplete

#### Scenario: Infrastructure retains an upload
- **WHEN** runtime proxy/temp/cache/log inspection finds workbook or full payload retention
- **THEN** runtime acceptance remains incomplete with the concrete blocker recorded instead of silently relaxing no-retention
