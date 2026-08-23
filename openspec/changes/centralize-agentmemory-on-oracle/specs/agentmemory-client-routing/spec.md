## ADDED Requirements

### Requirement: Private Codex routing
Codex on the current VPS SHALL reach the canonical Oracle endpoint through a
persistent loopback SSH tunnel authenticated by a dedicated forwarding-only
key.

#### Scenario: Tunnel is healthy
- **WHEN** the tunnel service is active and Oracle agentmemory is healthy
- **THEN** requests to the current VPS loopback endpoint reach Oracle
`127.0.0.1:3111`
- **AND** no agentmemory listener is exposed on a non-loopback address of either host

#### Scenario: Tunnel key is inspected
- **WHEN** the dedicated public key entry is inspected on Oracle
- **THEN** it permits forwarding only to `127.0.0.1:3111`
- **AND** it does not permit an interactive shell, PTY, agent forwarding, X11 forwarding, or unrelated destinations

#### Scenario: Tunnel connection drops
- **WHEN** SSH connectivity is interrupted
- **THEN** the tunnel service retries automatically
- **AND** it does not bind a misleading local listener unless remote forwarding setup succeeds

### Requirement: Local OpenCode routing
OpenCode on the Oracle VM SHALL use the same canonical loopback endpoint and
SHALL NOT start or select an independent store.

#### Scenario: OpenCode MCP starts
- **WHEN** OpenCode starts its agentmemory MCP integration
- **THEN** the integration connects to Oracle `127.0.0.1:3111`
- **AND** the MCP process contains no writable local fallback

### Requirement: Fail-closed memory operations
Codex and OpenCode MUST report canonical service failures as MCP errors and
MUST NOT execute memory operations against local in-memory or standalone
storage.

#### Scenario: Canonical service is unavailable before MCP startup
- **WHEN** a client starts its MCP integration while the canonical service is unavailable
- **THEN** memory tools report unavailability
- **AND** no local standalone store is created or modified

#### Scenario: Canonical service fails during a client session
- **WHEN** a proxied memory call loses the canonical service after MCP initialization
- **THEN** that call returns an MCP error
- **AND** the adapter does not retry the call against local storage

#### Scenario: Memory save fails closed
- **WHEN** `memory_save` is invoked while the canonical service is unavailable
- **THEN** the client does not report a saved memory ID
- **AND** the archived pre-cutover standalone file retains its original checksum

### Requirement: Cross-client canonical visibility
Successful memory writes from either client SHALL be observable from the other
client through the canonical store.

#### Scenario: OpenCode writes a memory
- **WHEN** OpenCode saves a uniquely identified verification memory
- **THEN** immediate recall in OpenCode returns that memory
- **AND** recall in Codex returns the same memory ID and content

#### Scenario: Codex writes a memory
- **WHEN** Codex saves a uniquely identified verification memory
- **THEN** immediate recall in Codex returns that memory
- **AND** recall in OpenCode returns the same memory ID and content

### Requirement: Repository usage guidance
Repository instructions SHALL direct agents to the canonical service, require
save-then-recall verification, and prohibit silent fallback.

#### Scenario: Agent starts a repository session
- **WHEN** an agent reads `AGENTS.md` or `CLAUDE.md`
- **THEN** it is instructed to recall repository memory through canonical agentmemory
- **AND** it treats empty recall and service unavailability as distinct states
- **AND** it verifies every explicit `memory_save` with the same short distinctive concepts

#### Scenario: Operator needs recovery guidance
- **WHEN** agentmemory, the tunnel, backup, restore, or rollback requires intervention
- **THEN** the repository points to `docs/operations/agentmemory-oracle-runbook.md`
- **AND** the runbook provides secret-safe commands and go/no-go checks
