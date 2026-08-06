## Delivery Rules

This roadmap spans two repositories. Service phases `S0a` through `S5` belong
in the separate `vietnamese-address-service` repository. LIMS phases `L1a`
through `L3b` belong in `lims-lite`. Operational gates `G1` and `R0` coordinate
already-reviewed artifacts; any correction discovered there returns to a new
focused PR or next-numbered forward-only migration.

Every numbered phase below is already a separate PR or operational gate. Do
not recombine phases. Handwritten changes should remain materially below 1,000
lines per PR and MUST be split again before 1,200 lines unless atomic SQL makes
that less reviewable. Generated SQLite snapshots, dependency lockfiles,
retained raw-source bundles, and atomic migration SQL SHALL be reported
separately.

Every PostgreSQL apply, query, and verification task MUST connect through
`ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42`, operate from
`/opt/lims-lite`, and invoke `sudo -n docker exec ... lims-postgres psql`.
Supabase Studio, Supabase MCP, and Supabase CLI are prohibited.

A migration PR MUST merge before its SQL is executed against a persistent
database. The home-server checkout MUST be at the verified merged SHA before
apply. Once executed, the migration remains byte-for-byte immutable.

## 1. Phase S0a - Service Repository and Toolchain (Service PR S0a)

**Prerequisite:** This OpenSpec change is approved.

**PR boundary:** Repository ownership, minimal Go toolchain, module structure,
and local development verification only. Do not add production data, runtime
deployment, search, or API behavior.

- [x] 1.1 Create the independent `vietnamese-address-service` repository with ownership, support, versioning, compatibility, release, and OpenSpec documentation.
- [x] 1.2 Pin Go, the approved CGO-free SQLite driver, and explicit reproducible CGO-free build settings.
- [x] 1.3 Establish small packages for configuration, build metadata, dataset interfaces, HTTP transport, and graceful process lifecycle using `net/http`.
- [x] 1.4 Add proportional local verification for formatting, `go vet`, unit tests, and CGO-free builds without hosted CI/CD or automated dependency updates.
- [x] 1.5 Add contributor commands and local synthetic-test conventions so ordinary tests require no live upstream or home-server access.
- [x] 1.6 Run the complete local foundation check and review the diff for LIMS code, data, credentials, private infrastructure, and deployment secrets.

**Exit gate:** The repository has a stable development contract and can accept
runtime work without coupling to LIMS.

## 2. Phase S0b - Read-Only Runtime (Service PR S0b)

**Prerequisite:** Service PR S0a is merged.

**PR boundary:** Synthetic read-only runtime, health, and resource budgets only.
Do not add production ingestion, deployment files, or public `/v1` data
handlers.

- [ ] 2.1 Add a minimal synthetic SQLite fixture and read-only repository implementation.
- [ ] 2.2 Add startup validation that rejects missing, corrupt, incompatible, or unexpectedly writable snapshots before readiness.
- [ ] 2.3 Implement `/health/live` and `/health/ready` with distinct process and dataset semantics and redacted failures.
- [ ] 2.4 Add metadata-only request logging, request IDs, bounded server timeouts, graceful shutdown, and concurrency limits.
- [ ] 2.5 Add a reproducible CGO-free Linux binary build and document the runtime files required beside the binary without adding home-server deployment configuration.
- [ ] 2.6 Document CPU, memory, process, file-descriptor, disk, timeout, and concurrency budgets for idle and loaded operation.
- [ ] 2.7 Verify startup failure cases, read-only enforcement, liveness/readiness, graceful shutdown, idle use, and bounded load behavior.

**Exit gate:** A hardened dark service runs against synthetic immutable data
within documented resource limits.

## 3. Phase S1 - Current Dataset and Raw-Source Evidence (Service PR S1)

**Prerequisite:** Service PR S0b is merged.

**PR boundary:** Authoritative current province/commune generation and
reproducibility evidence only. Do not add historical lineage, fuzzy search,
HTTP data handlers, or publication automation.

- [ ] 3.1 Define a versioned source manifest for official NSO sources and a pinned `thanglequoc/vietnamese-provinces-database` revision as secondary evidence.
- [ ] 3.2 Acquire and retain immutable raw source artifacts with content addresses, retrieval metadata, checksums, parser/toolchain versions, and applicable source terms.
- [ ] 3.3 Add deterministic parsers and local fixtures so identical retained inputs produce identical logical output without live downloads.
- [ ] 3.4 Implement current `dataset_metadata`, `source_artifacts`, stable administrative-unit identities, immutable unit revisions, parent relationships, and source provenance.
- [ ] 3.5 Add invariants for one active revision per level/code, valid current province ownership, unit kinds, normalized names, validity intervals, and provenance completeness.
- [ ] 3.6 Cross-check official current units against the pinned secondary source and require a reviewed allow-list for material disagreement.
- [ ] 3.7 Treat expected counts as release-manifest evidence and fail closed on source schema or semantic drift until a reviewed manifest change exists.
- [ ] 3.8 Add malformed-source, unavailable-source, checksum, duplicate-active-code, orphan-parent, disagreement, legitimate-count-change, and reproducibility fixtures.
- [ ] 3.9 Verify SQLite integrity, deterministic output, raw-input retrievability, provenance completeness, source terms, and generated-artifact size.

**Exit gate:** A current immutable dataset can be rebuilt exactly from retained
evidence and cannot auto-publish unexplained semantic changes.

## 4. Phase S2a - Historical Revisions and Lineage (Service PR S2a)

**Prerequisite:** Service PR S1 is merged.

**PR boundary:** Historical ingestion and temporal model only. Do not add
ranking, fuzzy search, HTTP handlers, or deployment automation.

- [ ] 4.1 Extend source manifests and parsers for former names, levels, validity intervals, renames, transfers, mergers, splits, and old-to-new evidence.
- [ ] 4.2 Add aliases and many-to-many predecessor/successor revision relations with effective dates, sources, relation types, and ambiguity metadata.
- [ ] 4.3 Preserve former districts as searchable context without making them required parents in the current two-tier hierarchy.
- [ ] 4.4 Model official code reuse with distinct revision identities and non-overlapping validity intervals instead of treating codes as timeless keys.
- [ ] 4.5 Add lineage invariants that reject impossible intervals, missing revisions, cycles where prohibited, unsupported relation types, and silently collapsed ambiguity.
- [ ] 4.6 Add fixtures for one-to-one rename, transfer, merger, partial merger, split, former district, repeated name, and reused official code.
- [ ] 4.7 Verify historical provenance, temporal identity, many-to-many preservation, current revision selection, and legacy evidence completeness.

**Exit gate:** Historical units and ambiguous transitions are represented
without guessed successors or code-identity collisions.

## 5. Phase S2b - Deterministic Vietnamese Search (Service PR S2b)

**Prerequisite:** Service PR S2a is merged.

**PR boundary:** Search indexing and ranking only. Do not add HTTP handlers,
publication, or deployment code.

- [ ] 5.1 Implement normalization for Unicode, case, whitespace, punctuation, Vietnamese diacritics, and `đ`/`d` equivalence while retaining display text.
- [ ] 5.2 Add indexed exact and prefix retrieval plus a generated normalized n-gram or equivalent bounded candidate structure for typos that prevent prefix matches.
- [ ] 5.3 Implement ranking tiers for exact code, exact current name, current prefix, province-scoped current match, historical exact/prefix, and bounded fuzzy fallback.
- [ ] 5.4 Add total tie-breakers by similarity, current status, level, normalized canonical path, official code, and revision ID.
- [ ] 5.5 Return match text/type, current or historical status, canonical path, revision identity, dataset version, and all ambiguous successors.
- [ ] 5.6 Add golden tests for accented/unaccented text, `d`/`đ`, punctuation, province scope, first-character typo, multi-token typo, historical alias, former district, reused code, split, and partial merger.
- [ ] 5.7 Verify deterministic order, bounded candidates, no full scan, latency, memory, and proof that fuzzy results cannot outrank stronger tiers.

**Exit gate:** Search remains deterministic and bounded even when a typo
prevents prefix retrieval.

## 6. Phase S3 - Versioned Read-Only API (Service PR S3)

**Prerequisite:** Service PR S2b is merged.

**PR boundary:** `/v1` transport and contract only. Do not add source
publication, home-server deployment, or LIMS code.

- [ ] 6.1 Define normative JSON schemas, examples, compatibility rules, stable errors, bounds, and consumer fixtures for `/v1`.
- [ ] 6.2 Implement metadata, province list, commune list, and current unit lookup endpoints over read-only service interfaces.
- [ ] 6.3 Implement bounded address search and legacy resolution with revision, match, lineage, ambiguity, and dataset evidence.
- [ ] 6.4 Accept administrative query text only and reject unsupported PII-bearing fields; never log raw queries.
- [ ] 6.5 Enforce methods, query length, minimum query, result limit, timeout, response size, and concurrency before expensive work.
- [ ] 6.6 Build ETags from API representation version, service version, dataset version, route, and canonical request parameters.
- [ ] 6.7 Require consumers to validate known required fields while tolerating unknown additive fields; reserve breaking changes for a new major version.
- [ ] 6.8 Add handler, contract, malformed-input, cancellation, concurrency, ETag, additive-field, error-redaction, PII-boundary, liveness, and readiness tests.
- [ ] 6.9 Verify the Go checks, representative searches, bounded load, stable ordering, compatibility fixtures, and production-shaped process behavior.

**Exit gate:** Consumers have a stable, privacy-bounded API independent of the
SQLite schema.

## 7. Phase S4 - Manual Dataset Release (Service PR S4)

**Prerequisite:** Service PR S3 is merged.

**PR boundary:** Operator-initiated dataset refresh and immutable release
evidence only. Do not access or alter the home server.

- [ ] 7.1 Document that a maintainer initiates refresh only when official administrative data actually changes.
- [ ] 7.2 Run acquisition, semantic-drift policy, generation, integrity, lineage, search, contract, resource, security, and reproducibility checks manually.
- [ ] 7.3 Retain the raw-source bundle, manifest, checksums, row counts, parser/toolchain versions, source commit, and generated snapshot as release evidence.
- [ ] 7.4 Create an immutable service tag or record an exact commit SHA only after all checks pass.
- [ ] 7.5 Fail closed on semantic drift, source failure, test failure, or incomplete evidence without changing the active service.
- [ ] 7.6 Retain the current and previous known-good release revisions under bounded disk retention.
- [ ] 7.7 Test disappeared upstream files, retained-source rebuild, structural drift, code reuse, disagreement, regression failure, and successful manual release preparation.
- [ ] 7.8 Verify byte-for-byte reproducibility, revision immutability, checksums, and absence of secrets or LIMS data.

**Exit gate:** A maintainer can prepare a reproducible reviewed release revision
without deployment authority or hosted automation.

## 8. Phase S5 - Manual Home-Server Deployment and Rollback (Service PR S5)

**Prerequisite:** Service PR S4 is merged and an approved tag or commit exists.

**PR boundary:** Home-server checkout, build, systemd service, private binding,
health verification, and rollback runbook only. Do not modify LIMS runtime or
enable consumers.

- [ ] 8.1 Select the source checkout path, versioned binary/release paths, systemd unit name, loopback/Tailscale bind addresses, host port, service user, and retention limits.
- [ ] 8.2 Add a minimal systemd unit that runs the binary as a dedicated non-root user with bounded logs, restart policy, resource limits, and read-only access to the SQLite snapshot.
- [ ] 8.3 Bind same-host access to loopback and cross-host access only to `100.93.19.42`; reject wildcard, Internet, Cloudflare Tunnel/Funnel, and permissive browser CORS configurations.
- [ ] 8.4 Add an operator runbook that fetches source, checks out an exact approved tag or commit, runs `make verify`, and builds the CGO-free binary on the home server.
- [ ] 8.5 Verify source revision, manifest, snapshot checksums, and required runtime files before installing or restarting.
- [ ] 8.6 Restart the service and verify health, integrity, metadata, representative searches, private reachability, expected revision, and resource budgets.
- [ ] 8.7 Keep the previous checkout and binary until post-restart checks pass; restore them and restart on failure.
- [ ] 8.8 Document recovery from an interrupted fetch, build, install, or restart using explicit active, selected, and previous revision checks.
- [ ] 8.9 Document startup, stale dataset inspection, manual pinning, rollback, cleanup, and why no SQLite backup is required.
- [ ] 8.10 Test bad revision, failed build, checksum mismatch, failed restart, private-binding error, budget exceedance, rollback, and release retention.

**Exit gate:** An operator can deploy and roll back an exact revision on the
home server with a short documented manual procedure.

## 9. Phase L1a - Additive Structured Address Migration (LIMS PR L1a)

**Prerequisite:** Service PR S3 is merged and its selection contract is stable.

**PR boundary:** Migration SQL and schema-level regression definitions only.
Do not apply the migration, add service calls, change client mutations, or add
UI.

- [ ] 9.1 Reinspect all client projections, forms, sample detail, CoA, reports, exports, generated types, audit triggers, RLS, grants, and current delete policies.
- [ ] 9.2 Define nullable columns for address detail, province code, commune code, dataset version, input source, administrative-selection source, and original scanned text when normalization changes it.
- [ ] 9.3 Add failing regression definitions proving existing free-text-only rows remain valid and no address backfill is required.
- [ ] 9.4 Add the next numbered forward-only migration with baseline assertions, compatible nullable columns, documented security impact, and no widened DELETE behavior.
- [ ] 9.5 Add constraints that reject contradictory complete structured states without invalidating legacy/manual/CCCD-only rows.
- [ ] 9.6 Add SQL verification for column shape, constraints, existing rows, RLS, grants, audit triggers, and unchanged delete-policy state.
- [ ] 9.7 Run pre-merge static SQL review, migration filename/order checks, relevant TypeScript checks, and confirm the SQL has not executed against any persistent database.

**Exit gate:** The migration is reviewed and merged but remains unapplied.

## 10. Gate G1 - Post-Merge Migration Apply (Operational, No PR)

**Prerequisite:** LIMS PR L1a is merged and all review comments are resolved.

**Operational boundary:** Apply and verify the exact merged migration only. Any
correction uses a new PR and next-numbered migration.

- [ ] 10.1 Update `/opt/lims-lite` to the verified merged commit and record repository SHA, migration identifier, and migration SHA-256 before apply.
- [ ] 10.2 Apply the committed migration once through the approved SSH and `sudo -n docker exec ... lims-postgres psql` path.
- [ ] 10.3 Verify columns, constraints, existing rows, grants, RLS, audit triggers, and unchanged client delete-policy state.
- [ ] 10.4 Run `run_security_tests()` and role-specific client read/mutation checks.
- [ ] 10.5 Record apply and verification evidence and mark the migration byte-for-byte immutable.

**Exit gate:** The additive schema is active and verified at the exact merged
revision.

## 11. Phase L1b - Intent-Discriminated Client Mutation (LIMS PR L1b)

**Prerequisite:** Gate G1 is complete.

**PR boundary:** Client schemas, mutation semantics, and audit behavior only.
Do not add address-service calls or autocomplete UI.

- [ ] 11.1 Add strict discriminated address intents for `preserve`, `manual`, `cccd`, and `structured`.
- [ ] 11.2 Make omitted address intent preserve all existing address fields during unrelated client updates.
- [ ] 11.3 Make manual and CCCD replacement clear incompatible codes, dataset version, and administrative-selection source atomically.
- [ ] 11.4 Make structured replacement require complete validated detail, codes, dataset version, selection source, originating input source, and original scanned text when needed.
- [ ] 11.5 Reject ambiguous partial payloads and prevent changed free text from retaining stale codes when autocomplete is disabled.
- [ ] 11.6 Add create/edit round-trip tests for address detail, preserve-only update, manual replacement, CCCD replacement, scanned normalization, legacy null metadata, unauthorized mutation, and audit evidence.
- [ ] 11.7 Run focused action/schema tests, role checks, audit verification, `npm run typecheck`, and relevant lint checks.

**Exit gate:** Client address persistence is internally consistent before any
autocomplete consumer exists.

## 12. Phase L2a - LIMS Private Network and Rollout Configuration (LIMS PR L2a)

**Prerequisite:** Service PR S5 is merged.

**PR boundary:** LIMS Compose wiring, server-only configuration, and operations
documentation only. Rollout mode remains `off`; do not add address handlers or
UI.

- [ ] 12.1 Configure only the LIMS application service with the server-only address-service URL through the approved home-server Tailscale endpoint without publishing a new LIMS or address-service port.
- [ ] 12.2 Add server-only validation for service URL, connect/response timeouts, request bounds, and rollout mode `off | allowlist | on`.
- [ ] 12.3 Add a protected principal allowlist contract that cannot be selected or disclosed by browser code.
- [ ] 12.4 Keep the Tailscale endpoint and operational paths out of public environment variables and client bundles.
- [ ] 12.5 Document deploy order, endpoint lifecycle, private connectivity, public-denial checks, mode changes, rollback, and configuration ownership across repositories.
- [ ] 12.6 Verify Compose rendering, feature-off startup, no new public exposure, and production build/typecheck with no user-visible behavior change.

**Exit gate:** LIMS is ready to reach the service privately but cannot issue an
address request.

## 13. Phase L2b - Authenticated Server Adapter (LIMS PR L2b)

**Prerequisite:** LIMS PR L2a and service PR S3 are merged.

**PR boundary:** Schemas, server adapter, same-origin actions, caching, and
`api-client` wrappers only. Rollout mode remains `off`; do not render
autocomplete.

- [ ] 13.1 Add Zod schemas and TypeScript types that require known contract fields and tolerate unknown additive `/v1` fields.
- [ ] 13.2 Add a server-only adapter with request IDs, timeout, `AbortSignal` propagation, redacted errors, ETag handling, and bounded retries only where safe.
- [ ] 13.3 Authenticate the session, authorize existing client-entry roles, enforce rollout mode and per-principal/aggregate bounds, and reject before upstream access.
- [ ] 13.4 Add typed same-origin handlers for metadata, provinces, communes, search, and legacy resolution and expose them only through `src/lib/api-client.ts`.
- [ ] 13.5 Accept administrative-only query text, reject full-address fields, and exclude raw query text from all logs.
- [ ] 13.6 Cache immutable responses by full ETag, avoid caching malformed failures, and refresh safely when service or dataset representation changes.
- [ ] 13.7 Add contract tests for anonymous, unauthorized, `off`, non-allowlisted, allowlisted, malformed, oversized, timeout, cancellation, additive fields, changed ETag, PII payload, log redaction, and zero-upstream denial.
- [ ] 13.8 Run focused adapter/API-client tests, `npm run typecheck`, relevant lint checks, and production build with rollout mode `off`.

**Exit gate:** LIMS has a secure server-only consumer boundary with no visible
feature and no anonymous proxy path.

## 14. Phase L3a - Reusable Address Field and State Machine (LIMS PR L3a)

**Prerequisite:** LIMS PR L2b is merged.

**PR boundary:** Reusable field, request state, and accessibility in an isolated
test harness only. Do not integrate client forms or scanner workflows.

- [ ] 14.1 Add a feature module separating free-form detail, administrative-only query, selected unit, formatted snapshot, input source, selection source, and original scanned text.
- [ ] 14.2 Implement debounce, minimum query, cancellation, latest-request generation, ownership transitions, ETag-aware caching, and unavailable recovery.
- [ ] 14.3 Ensure full free-form or scanned addresses can never become service queries without explicit administrative-only input.
- [ ] 14.4 Implement current/historical/ambiguous presentation, manual override, Vietnamese loading/error/no-result states, and explicit successor selection.
- [ ] 14.5 Implement ARIA combobox/listbox semantics, accessible naming, expanded/active-descendant state, live announcements, Escape behavior, and focus restoration.
- [ ] 14.6 Emit explicit preserve/manual/CCCD/structured mutation intent without directly importing server actions.
- [ ] 14.7 Add `user-event` tests for keyboard, mobile sizing, loading, results, no result, error, dismissal, focus restoration, stale response, user edit, reset, and service recovery.
- [ ] 14.8 Run focused React tests, React Doctor, `npm run typecheck`, relevant lint checks, production build, and desktop/mobile verification.

**Exit gate:** The reusable field and state machine are reviewable independently
and remain disconnected from production workflows.

## 15. Phase L3b - Scanner-First Client and Accession Integration (LIMS PR L3b)

**Prerequisite:** LIMS PR L3a is merged, the service passes dark checks, and
`add-web-serial-cccd-scanner` plus `update-qr-scanner-cccd-vneid` are completed
and archived or explicitly reconciled in this PR.

**PR boundary:** Client create/edit and accession integration only. Production
rollout remains `off`.

- [ ] 15.1 Add failing baselines around the CCCD parser, payload classifier, dispatcher/provider, QR and Web Serial dialogs, duplicate lookup, and `handleParsedIdentityScan`.
- [ ] 15.2 Add a failing test proving a valid scan assigns a new scan generation and immediately applies a scan-owned draft including address before duplicate lookup resolves, with zero address-service calls.
- [ ] 15.3 Fence duplicate lookup by scan generation and ownership so stale lookup cannot replace a newer scan, edit, reset, dialog lifecycle, or explicit client selection.
- [ ] 15.4 Preserve current behavior when the current-generation lookup finds an existing client and when it finds no duplicate or fails.
- [ ] 15.5 Integrate the shared field with manual client creation and existing-client editing through the intent-discriminated audited mutation.
- [ ] 15.6 Require explicit normalization of scanned text, send administrative-only query text, and retain original scanned provenance until successful persistence.
- [ ] 15.7 Keep scanner-first, explicit manual choice, service failure fallback, and disabled mode independent from service readiness.
- [ ] 15.8 Add deferred-promise race tests for scan A/B, duplicate found/not found/failure, manual selection, user edit, reset, close/reopen, autocomplete response order, save failure, and feature rollback.
- [ ] 15.9 Add persistence tests for address detail round-trip, input/selection sources, original scanned text, stale-code clearing, audit evidence, and unauthorized mutation.
- [ ] 15.10 Run focused scanner/accession/client tests, React Doctor, `npm run typecheck`, relevant lint checks, production build, and desktop/mobile verification with rollout `off`.

**Exit gate:** Scanner auto-fill remains immediate and authoritative, duplicate
lookup cannot race newer state, and autocomplete is complete but disabled.

## 16. Gate R0 - Dark Deployment, Allowlisted Rollout, and Rollback (Operational, No PR)

**Prerequisite:** Service PRs S0a-S5, LIMS PRs L1a-L3b, and gate G1 are
complete; an exact service revision and protected runtime configuration exist.

**Operational boundary:** Deploy, verify, enable, observe, and roll back only.
Any correction returns to a focused PR or forward-only migration.

- [ ] 16.1 Verify the Tailscale ACL/firewall, exact `100.93.19.42` bind, protected systemd configuration and install-path permissions, and absence of public/Cloudflare/Funnel reachability.
- [ ] 16.2 Deploy the exact approved service revision dark and verify source revision, release checksums, local build, SQLite integrity, metadata, representative search, logs, idle resources, and stopped-service behavior.
- [ ] 16.3 Exercise interrupted fetch, build, install, and restart plus failed post-restart checks, manual rollback, and previous-revision recovery.
- [ ] 16.4 Deploy LIMS with mode `off` and verify QR/Web Serial scanning, immediate draft, duplicate lookup, client create/edit, manual entry, and accession remain unchanged with zero address calls.
- [ ] 16.5 Enable `allowlist` for controlled authenticated principals and prove anonymous, unauthorized, and non-allowlisted callers make zero upstream requests.
- [ ] 16.6 Verify scan success makes no address request, stale lookup/autocomplete cannot overwrite newer state, and explicit normalization preserves original scanned provenance.
- [ ] 16.7 Verify outgoing requests and all logs contain no complete address, free-form detail, raw administrative query, client identity, or sample data.
- [ ] 16.8 Verify current, unaccented, first-character typo, historical, reused-code, and ambiguous-successor flows plus structured persistence and audit evidence.
- [ ] 16.9 Stop or isolate the service and prove scanner, duplicate lookup, manual client creation/editing, and sample accession continue without data loss.
- [ ] 16.10 Switch to `on` only after allowlisted evidence passes, observe latency/errors/resources/dataset age, and record rollback to `off` plus the previous service revision.

**Exit gate:** Internal autocomplete is enabled, observable, privacy-bounded,
scanner-first, independent of service health, and reversible without rewriting
the applied migration.
