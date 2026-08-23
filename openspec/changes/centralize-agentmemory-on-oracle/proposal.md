## Why

Codex on the current VPS and OpenCode on the Oracle VM use separate agentmemory
stores, so durable guidance diverges between agents and can be silently written
to a local fallback when the canonical service is unavailable. Centralizing the
store on the Oracle VM provides one long-lived source of truth, but the cutover
must preserve all existing memories, fail closed during outages, and remain
recoverable and documented.

## What Changes

- Establish the Oracle VM agentmemory `0.9.29` runtime as the only writable
  canonical store, managed by systemd under user `ubuntu` with absolute data
  paths below `/home/ubuntu/.local/share/agentmemory/`.
- Create a fresh canonical store, normalize the standalone source export into
  the server import envelope, merge the current source and destination exports,
  preserve memory IDs and metadata, and keep both previous stores as rollback
  artifacts. The observed baseline on 2026-08-23 is 650 source memories plus 3
  non-overlapping Oracle memories; implementation must recheck these counts,
  data categories, and ID sets immediately before cutover.
- Keep the Oracle REST endpoint bound to `127.0.0.1:3111` and connect the
  current VPS through a persistent SSH tunnel that uses a dedicated,
  forwarding-only key restricted to that endpoint.
- **BREAKING** Replace the official MCP shim's silent local fallback with a
  host-local fail-closed adapter for Codex and OpenCode. If the canonical
  service or tunnel is unavailable, memory operations report an error and do
  not create or modify a local standalone store.
- Pin the engine, worker, and MCP integration to agentmemory `0.9.29`; upgrades
  become explicit maintenance operations with backup and compatibility checks.
- Add nightly logical exports through the private tunnel as `JSON.gz` files
  with mode `0600`, retaining 14 daily, 8 weekly, and 6 monthly backups, plus
  cold snapshots before migration or upgrades.
- Update `AGENTS.md` and `CLAUDE.md`, and add
  `docs/operations/agentmemory-oracle-runbook.md`, so repository agents use the
  canonical path, verify saves through recall, recognize fail-closed outages,
  and follow the documented backup, restore, and rollback procedures.
- Keep SSH keys, `authorized_keys` entries, live systemd units, backups,
  secrets, and host-specific adapter installations outside the repository.

## Capabilities

### New Capabilities

- `agentmemory-canonical-runtime`: Operate a version-pinned, loopback-only,
  systemd-managed canonical agentmemory service on the Oracle VM with stable
  storage, health checks, backup, restore, and upgrade controls.
- `agentmemory-client-routing`: Route Codex and OpenCode to the canonical store
  through private connectivity and a fail-closed MCP contract that prohibits
  local fallback writes.
- `agentmemory-data-migration`: Merge all existing source and Oracle memories
  into a fresh canonical store with identity preservation, verification,
  rollback, and cross-client recall acceptance tests.

### Modified Capabilities

None.

## Impact

- **Repository:** Changes are limited to `AGENTS.md`, `CLAUDE.md`, a new
  operations runbook, and this OpenSpec change. Host runtime files remain
  untracked.
- **Hosts:** The current VPS gains a persistent loopback SSH tunnel, a
  fail-closed MCP adapter, and scheduled backup jobs. The Oracle VM gains
  dedicated agentmemory systemd services, canonical storage, and the same
  fail-closed MCP adapter for OpenCode.
- **Availability:** Agentmemory becomes dependent on the Oracle VM and tunnel.
  During an outage, memory tools are intentionally unavailable rather than
  writing to a divergent local store.
- **Security:** The REST service remains unexposed to the Internet. A dedicated
  SSH key is restricted to forwarding `127.0.0.1:3111`; private keys, memory
  exports, and runtime secrets are never committed.
- **Data protection:** Logical backups are transferred over SSH and stored
  outside Oracle as compressed files readable only by root. They are not
  separately encrypted at rest, so root compromise of the backup VPS can
  expose their contents.
- **Application and compliance:** No LIMS UI, Vietnamese copy, application
  behavior, PostgreSQL schema, migration, RLS policy, audit log, production
  Docker stack, or Cloudflare Tunnel behavior changes.
