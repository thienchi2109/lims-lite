## Database Verification Rule

Every persistent PostgreSQL apply/query/verification task in this roadmap MUST connect with `ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42`, operate from `/opt/lims-lite`, and invoke `sudo -n docker exec ... lims-postgres psql`. Supabase Studio, Supabase MCP, and Supabase CLI are prohibited for this repository's database.

## 1. Phase L0 - Atomic Approval Boundary (PR L0)

**Prerequisite:** None. This is the first implementation PR.

**PR boundary:** Approval correctness only. Do not add outbox, Firebase, Notification Service, browser, or Docker changes.

- [ ] 1.1 Add failing focused tests that reproduce the current multi-call approval risks, including result-update success followed by sample-update failure.
- [ ] 1.2 Add SQL regression cases for manager authorization, `review` sample state, selected result ownership/state, confidentiality access, QC blocking, partial approval, final approval, and reopen/reapproval.
- [ ] 1.3 Design the stable RPC input, success result, and fail-closed error-code contract used by the existing approval UI.
- [ ] 1.4 Add the next forward-only migration implementing the atomic approval RPC with fixed `search_path`, explicit grant/revoke, role checks, and documented security impact.
- [ ] 1.5 Route `approveResults` through the RPC while preserving Vietnamese error mapping, cache invalidation, audit behavior, and existing CoA completion behavior.
- [ ] 1.6 Add focused action/API tests proving no partial success and proving push availability is not referenced by this phase.
- [ ] 1.7 Run the focused TypeScript tests, SQL regression tests, `run_security_tests()`, `npm run typecheck`, and relevant lint checks.
- [ ] 1.8 Verify the migration and approval flow through the Database Verification Rule above, then record the exact applied migration before merging PR L0.

**Exit gate:** One authoritative transaction owns final approval and sample completion. Production behavior is otherwise unchanged.

## 2. Phase L1 - Durable Completion Outbox (PR L1)

**Prerequisite:** PR L0 merged and its migration verified on the authoritative database.

**PR boundary:** Database event contract only. Events may accumulate; no Notification Service or browser integration is required.

- [ ] 2.1 Add failing SQL tests for one event on `review -> completed` with a valid recipient, no event on partial approval or same-status updates, and a second event after reopen/recompletion.
- [ ] 2.2 Add failing SQL tests for server-derived `app_id`, recipient snapshotting from `samples.received_by`, canonical field encodings, monotonic `outbox_sequence` claim metadata, and the approved privacy-limited event fields.
- [ ] 2.3 Add failing security tests proving `anon`, general `authenticated`, and the application runtime role cannot directly read, lock, or mutate the outbox.
- [ ] 2.4 Add the next forward-only migration for provider-neutral `integration_outbox` and `integration_anomalies` tables, immutable event identity/payload, `outbox_sequence BIGINT GENERATED ALWAYS AS IDENTITY`, operational claim state, indexes, and retention-ready timestamps.
- [ ] 2.5 Add the guarded transition trigger that inserts `sample.completed.v1` in the sample-completion transaction without changing existing CoA trigger behavior.
- [ ] 2.6 Add least-privilege bounded claim ordered by `outbox_sequence` with optional `max_outbox_sequence BIGINT` and inclusive `<=` filtering, plus fenced acknowledge, retryable release, and terminal failure-reporting functions with claim tokens and lease expiry for a dedicated NOLOGIN consumer role; document the R0 administrator transaction that locks the outbox in `SHARE` mode before reading `clock_timestamp()` and `MAX(outbox_sequence)`; do not place credentials in the migration.
- [ ] 2.7 Verify `received_by` is a non-deleted analyst before event insertion; if not, complete approval without an event and atomically record the structured durable anomaly.
- [ ] 2.8 Run migration SQL tests, `run_security_tests()`, focused approval/CoA regressions, and `npm run typecheck`.
- [ ] 2.9 Apply and verify the migration through the Database Verification Rule above, including trigger source, grants, policy exposure, monotonic sequence ordering/high-water claims, concurrent insert blocking during the R0 boundary transaction, event creation, and safe pending-event accumulation.

**Exit gate:** LIMS durably emits the approved event contract and remains fully functional with no consumer.

## 3. Phase L2 - Installation Registration Backend (PR L2)

**Prerequisite:** Service PR S2 merged and its private installation API contract available in a test environment.

**PR boundary:** Authenticated backend integration only. Do not add the Firebase Web SDK, service worker, banner, or profile UI.

- [ ] 3.1 Add shared Zod schemas and TypeScript types for installation upsert, rebind, handle-targeted compare-and-disable with expected `app_id`, current user, and owner generation, opaque installation handles, and normalized service responses.
- [ ] 3.2 Add a server-only Notification Service client with timeout, replay-resistant service authentication, redacted errors, and no Firebase Admin dependency.
- [ ] 3.3 Add a focused same-origin API or client-action boundary that derives `user_id`, `app_id`, rollout mode, and controlled-cohort membership from trusted server state; reject `off` and non-allowlisted `registration_only` callers before contacting the service.
- [ ] 3.4 Add current-installation compare-and-disable handling using the opaque installation handle plus expected `app_id`, current user, and owner generation before logout session destruction; stale requests are no-ops, while timeout or service failure keeps the session intact and returns a retryable Vietnamese logout error.
- [ ] 3.5 Add rebind and reconciliation behavior for the same FID after another analyst signs in on the browser.
- [ ] 3.6 Add contract tests for authentication, caller-selected identity rejection, `off`, non-allowlisted `registration_only`, payload validation, service denial, full-identity stale logout, timeout preventing session destruction, retry success, FID redaction, and unsupported operations.
- [ ] 3.7 Add configuration validation for the private service URL and credential without enabling any browser-visible feature.
- [ ] 3.8 Run focused API/action tests, security-sensitive auth tests, `npm run typecheck`, and relevant lint checks.

**Exit gate:** LIMS can securely manage installations, but no browser requests permission or obtains an FID.

## 4. Phase L3 - Browser FCM and Vietnamese Opt-In UX (PR L3)

**Prerequisite:** PR L2 and service PR S3 merged; controlled FCM delivery has passed outside the production UI.

**PR boundary:** Browser integration only. Keep the rollout mode `off` in production until the joint rollout gate.

- [ ] 4.1 Re-check current Firebase Web SDK primary documentation and lock the supported `register()` / `onRegistered()` / FID contract before adding dependencies.
- [ ] 4.2 Add validated public Firebase and VAPID configuration with no Firebase Admin or private credentials.
- [ ] 4.3 Add a focused client messaging module for capability detection, permission state, FID registration, ownership-generation persistence, foreground data messages, shared `presentation_id` claiming, and current-browser compare-and-disable.
- [ ] 4.4 Add a shared envelope formatter, same-origin presentation ledger, and `firebase-messaging-sw.js`; only a visible page with an active handler owns foreground presentation, while hidden or handler-less controlled tabs hand off without presenting and the service worker owns background presentation plus root/focus click behavior.
- [ ] 4.5 Add the one-time Vietnamese post-login banner that opens the permission prompt only after `Bật thông báo` is pressed.
- [ ] 4.6 Add profile controls showing and changing notification state for the current browser without affecting other installations.
- [ ] 4.7 Add tests for `off`, backend-enforced `registration_only`, and `banner_enabled`; the `Bật thông báo` gesture before every permission prompt; unsupported browsers; permission decisions; multiple browsers; stale logout after rebind; visible and multiple foreground tabs; hidden controlled tabs; foreground-to-service-worker handoff; duplicate `presentation_id` suppression; exact title/body; and prohibited payload fields.
- [ ] 4.8 Run focused React tests, React Doctor, `npm run typecheck`, relevant lint checks, and the production build.
- [ ] 4.9 Verify supported desktop and mobile browser behavior through screenshots and real service-worker/notification interaction while the production rollout mode remains `off`.

**Exit gate:** Browser functionality is complete and testable, but production analysts do not see the opt-in banner.

## 5. Phase L4 - Home-Server Integration Wiring (PR L4)

**Prerequisite:** Service PR S4 merged and the service stack is ready for private deployment.

**PR boundary:** Runtime wiring, configuration, and LIMS-side operational documentation only. Do not add notification features beyond the approved specs.

- [ ] 5.1 Declare the LIMS app and narrowly required PostgreSQL outbox endpoint attachments to the approved external private Docker network without publishing new application or database ports; create and activate the network only in R0.
- [ ] 5.2 Add server-only environment contracts for the Notification Service URL, service authentication, server-derived `app_id`, validated rollout mode `off | registration_only | banner_enabled`, and the server-side `registration_only` user allowlist; keep all secret values outside Git.
- [ ] 5.3 Document home-server creation/rotation of service credentials and the exact separation from Firebase Admin credentials.
- [ ] 5.4 Document deploy order, health checks, outbox backlog inspection, browser enablement, rollback, and forward-only database recovery.
- [ ] 5.5 Add deployment verification commands for LIMS-to-service private connectivity and proof that Internet clients cannot reach the service endpoint; execute them in R0 after deployment.
- [ ] 5.6 Run the complete focused LIMS regression set, migration security tests, `npm run typecheck`, and relevant lint/build checks.
- [ ] 5.7 Publish the joint R0 checklist covering runtime LOGIN creation/rotation, external network lifecycle, dark deployment, controlled registration, E2E evidence, staged enablement, monitoring, and rollback.

**Exit gate:** LIMS runtime wiring and runbooks are merge-ready while production rollout remains `off`.

## 6. Gate R0 - Joint Production Rollout (Operational, No PR)

**Prerequisite:** LIMS PR L4 and service PR S4 are merged, deployed artifacts are available, and approved Firebase credentials exist outside Git.

**Operational boundary:** Deployment and controlled enablement only. Any code or schema correction discovered here returns to a new focused PR or forward-only migration.

- [ ] 6.1 Create or verify the external private Docker network, attach only the LIMS app, Notification Service, and narrowly required PostgreSQL outbox endpoint, and confirm no new host or Internet ports.
- [ ] 6.2 Create and rotate the dedicated PostgreSQL LOGIN credential that inherits only the L1 NOLOGIN consumer role; mount all service and Firebase credentials from protected runtime paths.
- [ ] 6.3 Before ingestion starts, use the approved administrator path to open one short transaction, `LOCK TABLE integration_outbox IN SHARE MODE`, capture authoritative UTC `delivery_cutoff_at` from `clock_timestamp()` plus `high_water_outbox_sequence` from `COALESCE(MAX(outbox_sequence), 0)`, commit, persist the pair in protected deployment configuration, deploy the Go service dark with ingestion, installation API, delivery, and LIMS rollout mode `off`, then verify liveness, readiness, worker heartbeats, SQLite integrity, and backup/restore evidence.
- [ ] 6.4 Enable pre-rollout drain mode, process rows through the captured high-water mark in monotonic order, classify every event with `occurred_at < delivery_cutoff_at` as terminal `suppressed_pre_rollout`, and verify boundary equality, a pre-cutoff event inserted during drain, and no FCM submission for any pre-cutoff event.
- [ ] 6.5 After every row through the captured high-water mark is terminal, enable normal delivery for events with `occurred_at >= delivery_cutoff_at` and the private installation API, set LIMS to `registration_only` with a server-side controlled-user allowlist, register two browsers for one controlled analyst, and execute completion, reopen, and recompletion tests.
- [ ] 6.6 Verify no doctor, manager, unrelated analyst, stale ownership generation, disabled installation, cross-`app_id` installation, or prohibited field participates in delivery.
- [ ] 6.7 Set LIMS to `banner_enabled` only after the controlled gate passes, then observe outbox age, service jobs, worker health, FCM failures, and application logs.
- [ ] 6.8 Record rollback evidence proving the rollout can return to `off` and stop ingestion or delivery without editing applied migrations.

**Exit gate:** Production rollout is enabled, observed, and reversible through configuration with complete joint evidence.
