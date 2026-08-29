## Context

Gate A established canonical client integrity at `b9e0247` and applied
`supabase/migrations/231_enforce_client_canonical_integrity.sql` on the home
server. Migration 230 is immutable; its recorded SHA-256 is
`2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`.

The read-only investigation on `2026-08-29` found:

- Migration 231 apply evidence: `2026-08-29 09:03:33 UTC`.
- Database observation timestamp: `2026-08-29 10:53:05 UTC`.
- Shadow telemetry contains 13 events from `2026-08-22 14:38:36 UTC` through
  `2026-08-28 08:57:02 UTC`, and zero events after the migration apply time.
- The running app has `CLIENT_RESOLUTION_LEGACY_UPSERT=off`,
  `CLIENT_RESOLUTION_V2_CATEGORIES=manual,qr`, and shadow categories
  `manual,qr,upsert`.
- The running app container/image predates Gate A: container creation was
  `2026-08-23 05:11:06 UTC` and the image has no revision label.
- Static source still dispatches `upsertClient`, `findClientByIdentity`,
  `prepareManualAccessionClient`, and `prepareQrAccessionClient` through
  compatibility handlers. Therefore zero post-apply events cannot prove
  absence of usage.

The live database has no `track_functions` or `pg_stat_statements` evidence
available for this decision. Runtime logs also contain no matching client RPC
names after the apply timestamp. These are evidence limitations, not proof of
zero usage.

## Goals / Non-Goals

**Goals:**

- Establish a reproducible observation window and a reviewable Gate B evidence
  artifact.
- Separate legacy behavior, compatibility adapters, shadow telemetry, and
  obsolete database contracts so each can be retired only after dependency
  proof.
- Require failing regression tests before removing each path.
- Preserve the v2 resolver contract, authorized profile updates, lifecycle
  audit behavior, RLS, fixed `search_path`, and historical sample/result truth.
- Make database cleanup forward-only and verifiable.

**Non-Goals:**

- Editing, renaming, reapplying, or deleting migrations 230 or 231.
- Deploying or operating production from this workspace.
- Removing a compatibility entry point or legacy RPC during proposal
  preparation.
- Deleting clients, samples, results, audit rows, or historical links.
- Restoring name/date-of-birth uniqueness or weakening any security boundary.

## Decisions

### 1. Treat the observation window as not started

The proposed window is seven complete UTC days after a healthy home-server
deployment whose running application revision is at or after `b9e0247`.
The start timestamp must be captured after deployment and health verification.
The current zero-event interval is rejected because the deployed image predates
Gate A and the source still contains reachable compatibility dispatch.

Alternative rejected: counting from migration 231 apply time alone. Database
enforcement and application deployment are separate events.

### 2. Use layered evidence

The evidence artifact must include:

- deployment revision/image identity and feature flags;
- migration 230 and 231 hashes plus the 231 apply timestamp;
- shadow event count and PII-free breakdown by caller category and outcome;
- aggregate client/sample/audit activity over the same window;
- static source search for compatibility action names, direct table writes,
  legacy RPC names, and client API callers;
- runtime log counts where available, explicitly marking unavailable database
  statement statistics;
- reviewer decision for each candidate path: retire, retain, or investigate.

The window is not sufficient when there is no normal client/accession activity
at all. The evidence must either show representative activity or record an
explicit reviewer-approved deferral.

### 3. Retire application paths in dependency order

First prove direct v2 route and client-library behavior with red tests. Then
replace known form/selector callers with direct v2 APIs while preserving
request/response and Vietnamese outcomes. Only after static and runtime checks
are green may the compatibility action dispatch, cutover flags, and shadow
adapter be removed. The generic `upsertClient` name is not removed merely
because its legacy mutation switch is off.

### 4. Retire database contracts only after catalog dependency checks

At implementation time, enumerate live definitions, dependencies, ACLs, and
PostgREST exposure for `record_client_resolution_shadow_v1`,
`resolve_client_identity_internal_v2_221`,
`resolve_and_lock_accession_client_v2_228`, and any other candidate. Select the
actual next migration number then. A forward-only migration may revoke or drop
only objects with no approved caller and must assert the expected baseline
before changing it.

### 5. Preserve a forward-only recovery boundary

Rollback before database retirement may disable application selection. After a
retirement migration is applied, recovery uses a new forward-only migration or
application release. It must not restore migration 230's removed constraint or
reintroduce an unsafe legacy write path.

## Risks / Trade-offs

- [Risk] The app image is stale, so current zero telemetry is misleading.
  → Redeploy a revision at or after `b9e0247` and restart the observation clock.
- [Risk] A compatibility wrapper is still used even when it delegates to v2.
  → Prove every source caller and route action before deleting the wrapper.
- [Risk] An apparently obsolete RPC is an internal dependency of a retained
  transactional RPC. → Query live catalog dependencies and function bodies
  before any revoke/drop.
- [Risk] Seven days may not represent low-frequency lab activity.
  → Require representative activity or an explicit reviewer-approved extension.
- [Risk] Removing telemetry too early removes evidence needed for later audit.
  → Export reviewed aggregate evidence before retirement and retain the
  PII-free artifact according to project retention policy.

## Migration Plan

1. Review this proposal, design, spec, evidence gap, and issue.
2. Deploy the Gate A application revision through the home-server process and
   record a new observation start timestamp; do not deploy from this workspace.
3. Complete the proposed seven-day observation window and commit PII-free
   evidence.
4. After approval, create a new branch and add failing regression tests for
   each selected application and database retirement.
5. Replace callers and remove only the approved application compatibility
   paths; verify focused tests before any database migration.
6. Select and author a new forward-only migration only if live catalog evidence
   proves a database object/grant is obsolete. Apply only through SSH and
   `sudo -n docker exec ... psql`.
7. Run focused tests, `run_security_tests()`, typecheck, lint, React Doctor,
   strict OpenSpec, health checks, browser smoke, and post-retirement evidence.

## Open Questions

- Does the reviewer approve seven full UTC days as the minimum observation
  window, or require a longer interval for this lab's traffic pattern?
- Which representative client/accession activity threshold is sufficient to
  call the window valid?
- Should shadow telemetry be retained for a post-retirement observation period
  before its table/RPC is removed?
