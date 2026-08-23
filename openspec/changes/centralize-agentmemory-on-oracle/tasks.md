## 1. Preflight and Regression Proof

- [ ] 1.1 Reconfirm the current VPS and Oracle agentmemory versions, process ownership, listener addresses, data paths, package paths, OpenCode MCP configuration, and available disk space without modifying either store.
- [ ] 1.2 Record SHA-256 checksums and permissions for the source standalone file and the current Oracle state and stream stores so later preflight and cutover evidence can distinguish expected changes from drift.
- [ ] 1.3 Produce read-only planning exports from both stores, record counts, data categories, and sorted memory ID sets, compare them for overlap, and verify normalized `0.9.21` import compatibility against a disposable `0.9.29` store using a temporary `HOME` and disposable persistence paths; then prove the checksums captured in 1.2 are unchanged.
- [ ] 1.4 Write and run a failing black-box test with a temporary `HOME` and disposable persistence path proving that the official shim can fall back locally when the canonical REST endpoint is unavailable, then prove both legacy-store checksums are unchanged.
- [ ] 1.5 Write adapter acceptance tests for healthy proxying, unavailable-at-startup behavior, mid-session failure, `memory_save` error reporting, tool-list forwarding, and absence of local file mutation.
- [ ] 1.6 Write backup-job acceptance tests for valid export publication, malformed or unavailable export rejection, mode `0600`, SHA-256 generation, atomic replacement, and retention selection.

## 2. Repository Guidance

- [ ] 2.1 Update `AGENTS.md` Session Memory Recall guidance to name canonical agentmemory as the only writable path, require save-then-recall verification, distinguish empty recall from service outage, and prohibit fallback.
- [ ] 2.2 Apply the same canonical and fail-closed contract to `CLAUDE.md` without duplicating host secrets or stale host-specific values.
- [ ] 2.3 Add `docs/operations/agentmemory-oracle-runbook.md` covering topology, prerequisites, maintenance freeze, version pinning, service and tunnel lifecycle, migration, health checks, backup rotation, temporary restore rehearsal, outage handling, rollback, and secret-safe troubleshooting.
- [ ] 2.4 Ensure committed documentation uses host aliases or placeholders and does not include private keys, `authorized_keys` payloads, memory content, backup payloads, secrets, or live host unit files.

## 3. Fail-Closed MCP Integration

- [ ] 3.1 Implement the minimal host-local MCP adapter against the pinned agentmemory `0.9.29` REST MCP contract with no local KV or persistence implementation.
- [ ] 3.2 Make the adapter return MCP errors for failed health checks, failed tool discovery, and failed tool calls instead of invoking any local fallback.
- [ ] 3.3 Pass the adapter acceptance tests on the current VPS against both a healthy temporary endpoint and a deliberately unavailable endpoint.
- [ ] 3.4 Install the adapter on Oracle for OpenCode and on the current VPS for Codex, record installed versions and checksums as operational evidence, and keep the installed files outside Git.
- [ ] 3.5 Prepare pinned Codex and OpenCode MCP configurations that invoke the adapter, but do not activate them before canonical import and routing checks are ready.

## 4. Canonical Oracle Runtime

- [ ] 4.1 Install or verify pinned agentmemory `0.9.29` and its III runtime using absolute executable paths that do not depend on interactive NVM shell activation.
- [ ] 4.2 Create `/home/ubuntu/.local/share/agentmemory/` state, stream, config, and operational directories with owner `ubuntu`, directory mode `0700`, file mode `0600`, and a restrictive service umask.
- [ ] 4.3 Create an explicit III config with loopback-only HTTP and stream listeners and absolute state and stream paths in the dedicated directory.
- [ ] 4.4 Create disabled system-level engine and worker units that run as `ubuntu`, order the worker after engine readiness, restart on failure, and remain independent of `herdr`, OpenCode, and repository working directories.
- [ ] 4.5 Run `systemd-analyze verify` and static listener/configuration checks before enabling either canonical service.

## 5. Restricted SSH Tunnel

- [ ] 5.1 Generate a dedicated Ed25519 forwarding key on the current VPS with mode `0600`; do not reuse the Oracle administrative key.
- [ ] 5.2 Add a restricted Oracle authorized-key entry that permits forwarding only to `127.0.0.1:3111` and denies shell, PTY, agent, X11, user-rc, and unrelated forwarding.
- [ ] 5.3 Prove the dedicated key cannot obtain an interactive shell or forward to an unrelated destination while it can establish the approved loopback forward.
- [ ] 5.4 Create a disabled systemd tunnel unit on the current VPS with loopback bind, `ExitOnForwardFailure`, keepalives, automatic restart, and ordering after network readiness.
- [ ] 5.5 Verify the tunnel unit definition without enabling it and confirm no new non-loopback listener or firewall allowance is introduced.

## 6. Migration and Cutover

- [ ] 6.1 Schedule the approved 5-10 minute maintenance window, pre-stage all disposable test and restore tooling, stop memory interactions in Codex and OpenCode, record the freeze start time, and start the 10-minute go-live budget.
- [ ] 6.2 Produce final source raw and logical backups plus final Oracle logical and cold backups, set restrictive permissions, and write SHA-256 checksums before changing runtime state.
- [ ] 6.3 Prove source categories omitted by the standalone export are empty, create a server-compatible envelope by adding only explicit empty defaults, checksum it separately, and verify its memory records and ID set equal the raw logical export.
- [ ] 6.4 Validate export versions and schemas, calculate the exact expected memory ID union, and abort on malformed data or divergent overlapping IDs.
- [ ] 6.5 Stop the prior Oracle engine and worker, verify their checkout-relative store is unchanged, and keep the prior runtime start command available for rollback.
- [ ] 6.6 Start the fresh canonical engine and worker against the empty dedicated store and verify loopback health, systemd ownership, permissions, and empty-state expectations.
- [ ] 6.7 Import the final Oracle export first and merge the normalized source export second, recording import results and any accepted byte-equivalent deduplication.
- [ ] 6.8 Export the canonical store, prove its memory ID set equals the calculated final union, and compare every imported durable record plus every exported access log and other non-empty logical category field by field against the normalized final artifacts.
- [ ] 6.9 Activate the Oracle OpenCode fail-closed adapter, enable the current VPS tunnel, activate the Codex fail-closed adapter, and restart both MCP clients.
- [ ] 6.10 Save and recall uniquely identified verification memories in both directions, proving OpenCode-to-Codex and Codex-to-OpenCode visibility with matching IDs and content.
- [ ] 6.11 Restart the canonical engine, worker, tunnel, and MCP clients, then repeat health, ID-set, and representative recall checks.
- [ ] 6.12 Deliberately stop the tunnel and canonical service in controlled tests, prove memory operations return errors without creating or modifying local standalone data, and restore service afterward.
- [ ] 6.13 Keep normal memory writes frozen after controlled client tests; if any migration, field-comparison, persistence, routing, outage, recall, backup, restore, or 10-minute-budget check fails, execute rollback and verify the original source checksum and prior Oracle store before reopening writes.

## 7. Backup, Restore, and Go-Live

- [ ] 7.1 Install the tested backup job on the current VPS to pull through the tunnel, validate the export, gzip it, publish atomically with mode `0600`, and generate SHA-256 evidence.
- [ ] 7.2 Install and enable a nightly scheduled job with 14 daily, 8 weekly, and 6 monthly retention while ensuring a failed run cannot remove valid retained backups.
- [ ] 7.3 Run the first nightly-equivalent backup and verify timestamp, export version, memory count, permissions, compressed integrity, and checksum.
- [ ] 7.4 Restore the first backup into a temporary empty store, compare every durable record and exported access log field by field with the backup artifact, and remove the temporary runtime without touching canonical data.
- [ ] 7.5 If all migration, routing, fail-closed, backup, restore, and timing gates pass, record the freeze end and go-live timestamps, declare Oracle authoritative, and reopen normal memory writes.
- [ ] 7.6 Archive the former source standalone file and Oracle checkout-relative store read-only, and retain them until the first verified monthly backup generation exists.

## 8. Final Verification and Delivery

- [ ] 8.1 Re-read `AGENTS.md`, `CLAUDE.md`, and the operations runbook against the deployed topology and correct any command, path, version, or failure-mode drift without adding secrets.
- [ ] 8.2 Run `openspec validate centralize-agentmemory-on-oracle --strict`, `git diff --check`, and focused documentation consistency searches for old local-fallback guidance and unpinned agentmemory commands.
- [ ] 8.3 Capture final evidence for service enablement, loopback listeners, tunnel restrictions, exact memory ID union, cross-client recall, restart persistence, fail-closed outage behavior, backup creation, and temporary restore.
- [ ] 8.4 Commit the repository documentation with a conventional commit, pull with rebase, push the branch, confirm it is up to date with origin, and open or update the review PR.
- [ ] 8.5 Record any deferred high-availability, encrypted-backup, or upstream fail-closed-shim work as explicit follow-up issues rather than widening this change.
