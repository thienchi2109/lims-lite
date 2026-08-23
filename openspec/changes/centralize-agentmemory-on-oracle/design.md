## Context

Agentmemory currently has two independent persistence modes:

- Codex on the current VPS uses agentmemory `0.9.21` in standalone mode with
  `/root/.agentmemory/standalone.json`. A live inspection on 2026-08-23 found
  650 memory records and no session or observation buckets.
- OpenCode runs under `herdr` on the Oracle VM and connects to an agentmemory
  `0.9.29` III engine at `127.0.0.1:3111`. A live export found 3 memory records
  with no ID overlap against the 650-record standalone store.

The Oracle engine and worker were started outside systemd, user lingering is
disabled, and the active engine resolves relative storage paths beneath the
`lims-lite` checkout. The official MCP shim also falls back to a local
`standalone.json` after probe or proxy failures, including when
`AGENTMEMORY_FORCE_PROXY` is set. Those properties are incompatible with a
durable single source of truth.

The repository is the source of committed guidance only. Live SSH keys,
`authorized_keys`, systemd units, runtime adapters, backups, and secrets remain
host-managed and must not be committed.

## Goals / Non-Goals

**Goals:**

- Make the Oracle VM the only writable agentmemory authority for Codex and
  OpenCode.
- Preserve the union of all source and Oracle memory records, including IDs,
  timestamps, version fields, and metadata.
- Keep the canonical REST service private on loopback and provide reliable
  cross-host access through a restricted SSH tunnel.
- Fail closed when the canonical service is unavailable.
- Run the canonical engine and worker independently of a repository checkout or
  interactive terminal session.
- Provide tested backup, restore, upgrade, outage, and rollback procedures.
- Teach repository agents how to use and verify the canonical memory path.

**Non-Goals:**

- Bidirectional replication, multi-writer conflict resolution, or a writable
  offline cache.
- High availability across multiple agentmemory servers.
- Public HTTP, HTTPS, Tailscale, Cloudflare, or Docker publication of the REST
  endpoint.
- Changes to LIMS application code, PostgreSQL, Supabase, production Docker,
  UI, localization, RLS, or audit behavior.
- Committing runtime credentials, backups, host unit files, or installed
  adapter source to this repository.

## Decisions

### Oracle is the sole writable authority

Both clients will route all memory operations to one Oracle-hosted store.
Codex will no longer use its standalone store after cutover, and OpenCode will
no longer depend on an unpinned `npx` shim with local fallback.

Alternatives considered:

- A one-time copy followed by independent stores was rejected because memories
  would diverge immediately.
- Periodic bidirectional synchronization was rejected because agentmemory does
  not provide a conflict-resolution contract for two writable authorities.

### Build a fresh canonical store in a stable path

The new store will live below
`/home/ubuntu/.local/share/agentmemory/` with absolute paths for the state and
stream stores. Directories will be mode `0700`, persisted files and exports
will be mode `0600`, and services will run as `ubuntu` with a restrictive
umask.

The existing Oracle store beneath the checkout will not be edited in place.
It will be stopped and retained as a cold rollback artifact after final export.
The source standalone file will likewise be archived read-only after cutover.

Alternatives considered:

- Reusing the checkout-relative store was rejected because Git cleanup,
  worktree operations, or a changed working directory can move or remove
  canonical data.
- Copying standalone JSON directly into III storage was rejected because the
  source and destination use different persistence formats.

### Use system services, not interactive or user-session ownership

Oracle will use system-level systemd units that run as user `ubuntu`: one unit
for the III engine with an explicit config path and one dependent unit for the
agentmemory worker. Units will use absolute executable paths, start after
network readiness, restart on failure, and expose health through loopback only.

This avoids reliance on `herdr`, OpenCode, shell startup files, NVM shell
activation, or systemd user lingering. Agentmemory `0.9.29` will be installed
and pinned explicitly; upgrades require a backup, compatibility preflight, and
verification.

### Keep the REST endpoint loopback-only

The Oracle III HTTP and stream listeners will bind only to `127.0.0.1`. No
Oracle firewall port or public listener will be added. OpenCode uses the local
endpoint directly.

Codex reaches the same endpoint through a systemd-managed local forward:

```text
127.0.0.1:3111 -> SSH -> Oracle 127.0.0.1:3111
```

The tunnel uses a dedicated Ed25519 key. Its Oracle `authorized_keys` entry
will allow only port forwarding to `127.0.0.1:3111` and will disable shell,
PTY, agent, X11, and unrelated forwarding. The tunnel will require
`ExitOnForwardFailure`, use keepalives, and restart automatically.

Tailscale and public HTTPS were rejected because both add network publication
and policy surface that is unnecessary for one remote client.

### Replace fallback behavior with a fail-closed MCP adapter

The official MCP shim cannot enforce the selected failure policy: after a
failed REST call it can execute core tools against local in-memory state and
persist to `standalone.json`. `AGENTMEMORY_FORCE_PROXY` skips the initial probe
but does not prevent this runtime fallback.

A small host-local MCP adapter will therefore:

- expose the canonical server's tool definitions over stdio;
- forward tool calls to the canonical REST MCP endpoint;
- return an MCP error when health checks or calls fail;
- contain no local KV implementation or persistence path; and
- identify and pin its compatible agentmemory server version.

Codex and OpenCode will both invoke this adapter. The repository runbook will
document its required behavior and installation checks, but the installed
host-specific file will not be committed.

### Migrate through versioned logical exports

The source export will be produced through the `0.9.21` MCP `memory_export`
contract rather than by treating the internal standalone file as the target
schema. The standalone export contains `version`, `memories`, and `sessions`,
while the full server import contract also requires `summaries` and
`observations`. A deterministic normalization step will add only the required
empty categories after preflight proves the source standalone store contains no
corresponding summary or observation data. It will not rewrite memory records,
IDs, timestamps, or metadata.

The raw standalone export and normalized import envelope will receive separate
checksums, and their memory ID sets and normalized memory records must compare
equal. The Oracle source store will be exported through
`GET /agentmemory/export`. Agentmemory `0.9.29` accepts export version `0.9.21`
after this schema normalization.

Immediately before cutover, the implementation will:

1. freeze memory writes on Codex and OpenCode;
2. create raw, logical, and normalized source backups with SHA-256 checksums;
3. create a cold Oracle store snapshot plus a logical export;
4. compare source and target ID sets;
5. abort if overlapping IDs have non-identical records;
6. start an empty canonical store in the stable path;
7. import the Oracle export, then merge the normalized source export; and
8. verify the canonical ID set equals the exact union of both final exports.

The observed `650 + 3 = 653` count is a planning baseline, not a hard-coded
acceptance value. Final exports and their union are authoritative.

Verification will compare more than IDs. For every imported record, the
canonical export must match the normalized source record field by field for the
full durable payload supported by the export contract. Every exported
access-log record and every record in another non-empty logical category must
also match its normalized source record field by field, with category
cardinality preserved. Differences caused only by explicitly documented
canonical test records are separated from the imported-data comparison.

Compatibility and fallback tests performed before the maintenance window will
use disposable state directories and a temporary `HOME`. Before and after
checksums will prove that neither legacy store was modified.

### Back up logical data off the Oracle VM

The current VPS will pull a logical export through the private tunnel every
night, validate its JSON shape and non-empty memory set, compress it to
`JSON.gz`, write through a temporary file, set mode `0600`, calculate SHA-256,
and atomically publish the backup.

Retention is 14 daily, 8 weekly, and 6 monthly backups. Cold Oracle data
snapshots are additionally required before migration and upgrades. Backups are
not encrypted at rest by design; SSH protects transport, and root-only
permissions protect local storage. This accepted simplification is documented
as a residual risk.

### Repository guidance is part of the cutover

`AGENTS.md` and `CLAUDE.md` will state that repository sessions must use the
canonical agentmemory path, verify `memory_save` with immediate recall, and
treat canonical unavailability as an error rather than falling back.

`docs/operations/agentmemory-oracle-runbook.md` will cover topology, health
checks, service and tunnel lifecycle, version pinning, backup rotation, restore
rehearsal, migration, outage handling, rollback, and secret-safe commands. It
will use placeholders or host aliases rather than embedding private keys,
credentials, memory content, or backup payloads.

## Risks / Trade-offs

- **Oracle VM or SSH outage makes memory unavailable** -> The adapter fails
  closed, systemd restarts services and the tunnel, and repository guidance
  makes the outage explicit. Local feature work can continue without memory,
  but memory writes wait for recovery.
- **Unencrypted backup files expose memory to VPS root compromise** -> Backups
  are mode `0600`, directories are mode `0700`, transport uses SSH, and the
  runbook records this accepted residual risk.
- **Standalone export and server import schemas differ** -> Prove source
  summary and observation categories are empty, add only explicit empty
  defaults, checksum both artifacts, and compare all memory records before
  import.
- **Logical import is not one atomic transaction** -> Import only into a fresh
  store, retain both old stores, verify the exact ID union, and rollback by
  stopping the new services and restoring the old Oracle runtime.
- **Writes during export can create an inconsistent cutover** -> Enforce the
  approved maintenance window and repeat exports and ID comparison after the
  freeze begins.
- **Verification can exceed the approved maintenance window** -> Stage all
  disposable compatibility, adapter, service, tunnel, and restore tooling
  before the freeze; record freeze start and end times; and rollback if the
  final gates cannot finish inside the approved 10-minute budget.
- **A future package upgrade can break the adapter contract** -> Pin all
  components to `0.9.29`; require backup, tool-list comparison, outage tests,
  and cross-client recall before any upgrade.
- **Host-only runtime files can drift from documentation** -> Record installed
  paths, versions, unit status, and adapter checksum in the runbook's
  verification procedure, and re-run it after host changes.
- **The canonical service is not highly available** -> Accept one authoritative
  VM for this phase and rely on off-host backups and documented restore. HA is
  a separate future design.

## Migration Plan

1. Commit and push the repository guidance and runbook changes without touching
   either live store.
2. Capture fresh source and Oracle inventories, versions, ID sets, file
   checksums, service state, and available disk space.
3. Build and test the fail-closed adapter against a healthy endpoint and a
   deliberately unavailable endpoint using a temporary `HOME` and disposable
   stores, with before and after legacy-store checksums.
4. Prepare the stable Oracle data directory, pinned runtime, explicit III
   config, and disabled systemd units.
5. Create the restricted tunnel key and authorized entry, then install and test
   the disabled tunnel unit on the current VPS.
6. Enter the approved 5-10 minute maintenance window and freeze memory use in
   Codex and OpenCode.
7. Produce final raw, logical, normalized, and cold backups; compare categories
   and IDs and abort on unexplained overlap, non-empty omitted categories, or
   malformed exports.
8. Stop the old Oracle engine and worker, start the empty canonical services,
   import the final Oracle export and normalized source export, and verify
   their exact union.
9. Enable the fail-closed adapter in OpenCode, enable the SSH tunnel, and point
   Codex at its local tunnel endpoint.
10. Compare every imported durable record and exported access log field by
    field, then run controlled cross-client save/recall, service restart,
    tunnel outage, nightly-backup, and temporary-store restore tests while
    normal user memory writes remain frozen.
11. If every gate passes within the approved 10-minute budget, record the
    go-live timestamp, declare Oracle authoritative, and reopen memory writes.
    Otherwise execute rollback before reopening the prior stores.
12. Archive the former standalone and Oracle stores read-only. Keep rollback
    artifacts until the backup policy has produced and verified its first
    monthly generation.

Rollback:

- Stop the new canonical engine and worker.
- Restore the prior OpenCode MCP configuration and restart the previous Oracle
  engine against its untouched checkout-relative store.
- Restore the prior Codex MCP configuration only if the user explicitly
  abandons canonical cutover; otherwise leave memory unavailable while the
  canonical service is repaired.
- Verify the original Oracle export and source standalone checksum before
  reopening memory writes.

## Open Questions

None. The maintenance timestamp is an execution-time scheduling detail, and any
preflight drift in versions, record counts, or ID overlap is a go/no-go check
rather than an unresolved design decision.
