## Context

The current manager approval path updates selected `results`, counts remaining unapproved rows, and updates `samples.status` through separate application-driven database calls. The sample update currently provides the transition used by CoA generation, but the sequence is not one atomic business transaction and is not a safe place to add a synchronous network call.

FCM Web also cannot be moved entirely outside LIMS. The application origin must own the permission UX, Firebase Web initialization, service worker, foreground behavior, and notification-click behavior. Firebase Admin credentials and delivery retries belong outside LIMS in the coordinated `bootstrap-notification-service` change.

The agreed product behavior is:

- Trigger on every committed `review -> completed` transition.
- Address only the analyst recorded in `samples.received_by`.
- Send to all browser installations that analyst has enabled.
- Send again after a sample is reopened and later completed again.
- Display only `Mẫu đã hoàn thành` and `Mẫu {sample_code} đã được phê duyệt`.
- Include no customer, patient, result, or deep-link information.

## Goals / Non-Goals

**Goals:**

- Make final approval and event creation reliable before enabling push.
- Persist a versioned `sample.completed.v1` event in the LIMS database.
- Keep FCM outages outside the approval transaction.
- Authenticate browser installation changes through the existing LIMS session.
- Provide a Vietnamese, user-initiated permission flow.
- Make every implementation phase small enough for one focused PR.
- Preserve RLS, auditability, soft-delete rules, and forward-only migration history.

**Non-Goals:**

- Implementing the delivery worker or Firebase Admin SDK in `lims-lite`.
- Sending to doctors, managers, assigned analysts, or arbitrary audiences.
- Sending patient, customer, result, or confidential assay information.
- Adding sample-detail deep links or an in-app notification center.
- Adding email, SMS, Zalo, templates, schedules, or broadcast administration.
- Claiming that an FCM-accepted message was delivered to a device.

## Decisions

### Decision 1: Use two coordinated changes and two implementation repositories

`add-fcm-notification-integration` owns LIMS behavior. `bootstrap-notification-service` defines a separate Go `notification-service` repository that owns FIDs, jobs, delivery attempts, Firebase Admin Go, and service operations.

The shared contract is versioned and deliberately small:

```text
sample.completed.v1
- source_event_id: UUID encoded as a canonical string
- app_id: non-empty application namespace derived by trusted LIMS configuration
- sample_id: UUID encoded as a canonical string
- sample_code: non-empty string copied exactly from the sample
- recipient_user_id: UUID encoded as a canonical string
- occurred_at: UTC RFC 3339 timestamp
```

The immutable event payload is separate from mutable outbox claim metadata. `app_id` is never accepted from the browser, and `sample_id` is retained for internal traceability but is not placed in the FCM payload. The service MUST treat new event versions as unsupported until explicitly implemented.

Alternatives considered:

- **Send directly from the approval action:** rejected because network failure would either lose the event or contaminate approval success.
- **Put Firebase Admin in Next.js:** rejected because it couples credentials, retry, and provider behavior to the LIMS application.
- **Let the browser call the service directly:** rejected because the service would need to trust or reproduce the LIMS authentication boundary.

### Decision 2: Make approval mutation atomic before relying on completion events

The final approval mutation SHALL move behind one authoritative database transaction that revalidates manager authorization, sample state, result ownership/state, confidentiality authorization, and QC approval eligibility before it:

1. Updates the selected result rows.
2. Recomputes whether all active results are approved.
3. Updates the sample to `completed` or keeps it in `review`.
4. Allows existing completion-triggered CoA behavior to run.
5. Inserts the notification outbox event when the actual transition is `review -> completed` and `received_by` identifies an active analyst; otherwise inserts the durable recipient anomaly.

The transactional function SHALL use the repository's established `SECURITY DEFINER`, fixed `search_path`, grant/revoke, and fail-closed patterns. Application code remains responsible for mapping stable error codes to Vietnamese UI messages.

Alternatives considered:

- **Keep the existing application sequence and add only a trigger:** event creation would be atomic with the sample update, but approval could still report success after an inconsistent partial mutation.
- **Insert the outbox row from TypeScript:** rejected because it cannot share the sample-status transaction.

### Decision 3: Use a generic LIMS integration outbox

Add a generic `integration_outbox` table rather than an FCM-specific table. The first event type is `sample.completed.v1`, but the table contract remains provider-neutral.

Required characteristics:

- Immutable event identity and payload after insertion.
- No hard deletion during normal processing.
- A database-generated `BIGINT GENERATED ALWAYS AS IDENTITY` `outbox_sequence` that is strictly increasing but potentially non-contiguous and is used only for deterministic claim and rollout-drain ordering.
- A bounded claim batch ordered by `outbox_sequence`, optionally capped by an inclusive high-water mark, returning `outbox_sequence`, a fresh `claim_token`, and `lease_expires_at` as claim metadata.
- Fenced, idempotent acknowledgement, retryable release, and terminal failure operations that accept only the current claim token.
- Automatic reclaim after lease expiry with a new token so stale consumers cannot mutate the event.
- Retry scheduling and a terminal quarantined state for malformed or unsupported events.
- A unique `source_event_id` used by the service for idempotency.
- No grants to `anon` or the general `authenticated` role.
- Access only through narrowly scoped claim, acknowledge, release, and failure-reporting functions granted to a dedicated NOLOGIN consumer role.

The service acknowledges the LIMS outbox after the event has been committed to its SQLite job store, not after FCM delivery. FCM retries then remain entirely service-owned.

R0 captures the rollout boundary in one short administrator transaction before ingestion starts. It first executes `LOCK TABLE integration_outbox IN SHARE MODE`, which waits for in-flight outbox writes and blocks new writes, then reads `delivery_cutoff_at` from `clock_timestamp()` and `high_water_outbox_sequence` from `COALESCE(MAX(outbox_sequence), 0)` before commit. Because authorized event insertion occurs only through the guarded database path, no lower sequence can commit after this locked boundary is captured. The claim function accepts optional `max_outbox_sequence BIGINT` and, when supplied, returns only rows with `outbox_sequence <= max_outbox_sequence`. Direct boundary capture and outbox access are unavailable to `anon`, general `authenticated`, and the application runtime role.

### Decision 4: Snapshot the recipient at transition time

The outbox row records `samples.received_by` as `recipient_user_id`. Delivery does not re-query current sample ownership later.

This prevents delayed consumption from changing the intended recipient. Event creation first verifies that `received_by` still refers to a non-deleted analyst. If that validation fails, approval still completes, no notification event is emitted, and LIMS writes a durable `sample.completed.recipient_invalid.v1` anomaly in the same transaction. The anomaly records a reason code, sample ID, actor ID, and transition time without patient, customer, or result data. Failure to insert either the required event or anomaly fails the transaction.

### Decision 5: Proxy all installation lifecycle changes through LIMS

The browser calls a focused same-origin LIMS API through the established client API pattern. LIMS authenticates the current user, validates the payload, and calls the private Notification Service using a service credential.

Supported operations:

- Upsert or refresh the current FID after permission is granted.
- Rebind the same FID when another user authenticates in the same browser and return a new opaque installation handle plus ownership generation.
- Disable the current installation before logout using its opaque installation handle plus the expected `app_id`, current user, and ownership generation; a stale request is an idempotent no-op.
- Destroy the authenticated session only after that fenced disable is confirmed. A timeout or service error keeps the session intact and returns a retryable Vietnamese logout error rather than leaving an enabled installation owned by a signed-out analyst.
- Reconcile permission revocation or FID changes during later authenticated sessions.

LIMS derives `app_id` from server configuration and never accepts it or `user_id` from the browser. The LIMS backend never stores the Firebase service-account credential. Full FIDs MUST NOT appear in application logs or audit payloads.

### Decision 6: Use explicit, non-coercive Vietnamese permission UX

When browser permission is undecided, LIMS presents a one-time post-login banner. The browser permission prompt opens only after the user presses `Bật thông báo`.

- `off` rejects all registration/rebind requests and exposes no browser control.
- `registration_only` permits registration only for authenticated user IDs in a validated server-side rollout allowlist. The backend enforces the allowlist even when callers bypass the UI. The profile action remains `Bật thông báo`, and the browser permission prompt opens only after that explicit gesture.
- `banner_enabled` permits active analysts to register and enables the one-time banner.
- Granting permission registers the current FID.
- Denial or dismissal does not repeatedly prompt.
- The profile page always exposes current-browser notification state and controls.
- Each browser installation is independent.
- Unsupported browsers receive no broken control or repeated error.

### Decision 7: Keep the notification payload minimal and non-navigational

Visible content is fixed:

```text
Title: Mẫu đã hoàn thành
Body: Mẫu {sample_code} đã được phê duyệt
```

FCM uses a data-only message carrying only an opaque `presentation_id`, the versioned presentation type, and the fixed title and body. The identifier is stable across provider retries for one delivery, contains no sample or user identity, and exists only to deduplicate presentation. This prevents provider auto-display from racing the LIMS presentation path. A shared formatter validates the envelope and builds notification options but never displays them.

The foreground owner is a controlled page whose handler is running and whose `document.visibilityState` is `visible`; merely being controlled by the service worker is insufficient. A hidden, frozen, or handler-less tab is background. The page and service worker atomically claim the same `presentation_id` in a shared same-origin presentation ledger before displaying anything. A visible page that claims the identifier presents the fixed notification. A page that is no longer visible forwards the envelope to the service worker without presenting it. The service worker claims and presents background messages, owns root/focus click behavior, and performs no display when the identifier was already claimed. Multiple visible tabs, hidden controlled tabs, handoff races, and at-least-once provider retries therefore still produce at most one presentation for one `presentation_id`.

The payload contains no customer name, patient identifier, result value, assay name, confidential flag, sample UUID, `app_id`, sample-detail URL, or deep link. Clicking the notification only focuses an existing LIMS window or opens the application root.

### Decision 8: Merge in PR-sized phases with a shared cross-change order

Each phase below is one PR and must be independently testable and deploy-safe.

| Order | Phase | Repository | PR scope | Exit boundary |
| --- | --- | --- | --- | --- |
| 1 | L0 | `lims-lite` | Atomic approval mutation and regression coverage | Approval has one authoritative transaction; no push behavior |
| 2 | L1 | `lims-lite` | Outbox schema, transition trigger, consumer role/functions, SQL tests | Events persist locally and may safely accumulate |
| 3 | S0 | `notification-service` | Repository bootstrap, SQLite schema, health endpoint, local Docker | Service runs dark with no LIMS or FCM traffic |
| 4 | S1 | `notification-service` | Outbox claim/ingestion and idempotent SQLite jobs | Events become durable jobs; no delivery |
| 5 | S2 | `notification-service` | Authenticated installation API and lifecycle | FIDs can be managed internally; no browser path |
| 6 | L2 | `lims-lite` | Registration proxy, validation, logout/rebind backend lifecycle | LIMS can manage installations; UI remains disabled |
| 7 | S3 | `notification-service` | Firebase Admin sender, fan-out, retry, invalid-FID handling | Delivery pipeline works with contract fixtures |
| 8 | L3 | `lims-lite` | Firebase Web SDK, service worker, banner, profile controls | Feature complete but gated off by configuration |
| 9 | S4 | `notification-service` | Production secrets, backup, logs, resource limits, runbook | Service stack is production-ready |
| 10 | L4 | `lims-lite` | Shared private network for app/outbox access, environment wiring, deployment runbook | LIMS and the service can communicate privately |

After all PRs are merged, operational gate R0 applies any pending migrations and captures one rollout boundary from authoritative LIMS PostgreSQL state using the locked administrator transaction defined above. UTC `delivery_cutoff_at` and `high_water_outbox_sequence` are recorded in protected deployment configuration before ingestion starts. Event classification uses immutable `occurred_at`, not claim time or insertion order: `occurred_at < delivery_cutoff_at` is terminal `suppressed_pre_rollout`, while equality and later timestamps are eligible for normal delivery.

R0 then creates or verifies the external private network and dedicated runtime credentials, deploys the service dark, and verifies health. Pre-rollout drain processes rows through the captured outbox high-water mark in monotonic order while normal delivery remains disabled. Every event is still classified by `occurred_at`, including rows inserted during or after the drain, so a late-arriving pre-cutoff event can never become deliverable. Only after every row through the captured high-water mark is terminal may delivery and `registration_only` be enabled for controlled cross-service tests; `banner_enabled` remains the final step.

## Risks / Trade-offs

- **Approval hardening expands the first PR beyond notification UI** -> Keep L0 limited to mutation correctness and regression tests; no FCM dependencies.
- **Outbox events accumulate before the service is deployed** -> This is intentional; monitor table growth and consume only after S1 is ready.
- **At-least-once handoff and provider submission can display a duplicate** -> Use unique internal rows plus fenced leases to prevent duplicate state, while documenting that a crash after FCM acceptance can still cause a repeated provider submission.
- **Logout cleanup can fail on a shared workstation** -> Require confirmed full-identity compare-and-disable before session destruction; on timeout keep the session intact, return a retryable Vietnamese error, and use ownership generations plus stale-installation expiry as defense in depth.
- **Browser permission can be denied permanently** -> Never loop prompts; expose instructions and state in the profile.
- **Notification service downtime delays alerts** -> Approval remains successful, events remain durable, and operations alert on backlog age.
- **Outbox payload leaks sensitive data** -> Constrain and regression-test the event schema; never include patient, customer, assay, or result fields.
- **Applied migration rollback is unsafe** -> Use forward-only disable/fix migrations; feature flags disable browser behavior without rewriting migration history.

## Migration Plan

1. Complete L0 and verify approval transition, QC denial, confidentiality denial, audit, and CoA regressions.
2. Apply L1 as a forward-only migration and run `run_security_tests()`.
3. Verify the live home-server function, trigger, grants, and outbox state through SSH and `sudo -n docker exec ... psql`.
4. Implement S0-S3 without enabling the browser integration.
5. Merge L2 and L3 with the production rollout mode set to `off`.
6. Complete S4 and L4 so both repositories are production-ready but inactive.
7. Execute R0 to record `delivery_cutoff_at`, create or verify the external network, runtime LOGIN credential, secret mounts, and dark deployment.
8. Enable pre-rollout drain mode; ingest and terminally suppress all events older than the cutoff without calling FCM, then verify that no pre-cutoff event remains deliverable.
9. Enable normal delivery for events at or after the cutoff, set `registration_only` with its server-side user allowlist, and run an end-to-end `review -> completed` test including a reopen and second completion.
10. Set `banner_enabled` only after the controlled evidence and observation gates pass.

Rollback strategy:

- Set the rollout mode to `off` first.
- Disable service ingestion or delivery if delivery behavior is incorrect; outbox events and SQLite jobs remain durable.
- Keep the service API unavailable to browsers and retain the private network boundary.
- Use new forward-only migrations to disable or correct database behavior; never edit an applied migration.

## Open Questions

- Select the exact retention periods for acknowledged outbox rows and service delivery history during L1/S4.
- Select the stale-installation threshold and bounded retry schedule during S3.
- Select the Go SQLite driver, migration tool, and documented CGO policy during S0 after current primary documentation is reviewed.
- Select the monitoring destination for backlog age, repeated FCM failure, backup failure, and container health during S4.
