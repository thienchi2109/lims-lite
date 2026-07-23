## 1. Phase S0 - Repository and SQLite Foundation (PR S0)

**Prerequisite:** LIMS PR L1 contract is approved. Implementation occurs in a new `notification-service` repository.

**PR boundary:** Dark service foundation only. Do not connect to LIMS PostgreSQL or Firebase.

- [ ] 1.1 Initialize the separate repository, Git workflow, OpenSpec configuration, `go.mod`, pinned supported Go version, formatting/static-analysis policy, and focused test runner.
- [ ] 1.2 Review current primary documentation and select the minimal Go HTTP stack, SQLite driver, migration tool, and CGO policy; record the decision in the service repository.
- [ ] 1.3 Create focused Go packages for configuration, API, SQLite access, ingestion, jobs, delivery, and operations without implementing later phases.
- [ ] 1.4 Add validated configuration that fails closed on missing production values and never prints secrets.
- [ ] 1.5 Add forward SQLite migrations for `installations`, `notification_jobs`, and `notification_deliveries` with the approved uniqueness and foreign-key constraints.
- [ ] 1.6 Configure WAL, foreign keys, bounded busy waiting, short transactions, and graceful database shutdown.
- [ ] 1.7 Add private liveness/readiness endpoints and a root cancellation lifecycle that distinguish process health from SQLite readiness and fail fast on critical goroutine exit.
- [ ] 1.8 Add a multi-stage Go Dockerfile and Compose stack with one binary, one container, one local named volume, non-root execution, health check, and no public production port.
- [ ] 1.9 Add unit/integration tests for migrations, uniqueness, configuration failure, health behavior, goroutine cancellation, concurrent write contention, and clean restart persistence.
- [ ] 1.10 Run `gofmt`, `go vet ./...`, the selected linter, `go test ./...`, `go test -race ./...`, binary/image builds, container health, restart persistence, and SQLite integrity verification before merging PR S0.

**Exit gate:** The new repository runs a dark, persistent, healthy SQLite-backed service with no LIMS or FCM dependency.

## 2. Phase S1 - LIMS Outbox Ingestion (PR S1)

**Prerequisite:** PR S0 merged and LIMS PR L1 applied to the test database.

**PR boundary:** Durable event-to-job handoff only. Do not call Firebase or expose installation APIs.

- [ ] 2.1 Restate `sample.completed.v1` and the claim/ack/release/failure contracts as versioned Go structs and language-neutral fixtures, including field encodings and `app_id`.
- [ ] 2.2 Add the least-privilege PostgreSQL client using only the outbox functions and dedicated runtime credentials.
- [ ] 2.3 Implement bounded claim polling, claim-token fencing, lease/release behavior, graceful shutdown, and backoff when LIMS PostgreSQL is unavailable.
- [ ] 2.4 Validate event version, required fields, and production `delivery_cutoff_at`; create terminal `suppressed_pre_rollout` jobs for older events without fan-out.
- [ ] 2.5 Insert or reuse the SQLite job by `source_event_id`, compare every immutable field before treating a claim as an identical retry, and acknowledge only after the SQLite commit.
- [ ] 2.6 Report unsupported or malformed events into the approved terminal quarantine contract without silently acknowledging, delivering, or repeatedly reclaiming them.
- [ ] 2.7 Add deterministic crash-window tests for failure before SQLite commit, after commit before acknowledgement, and after acknowledgement.
- [ ] 2.8 Add tests for identical duplicates, conflicting payloads under one event ID, pre-rollout suppression, stale claim-token rejection, batch boundaries, lease expiry/reclaim, retryable release, terminal failure, database outage, redacted logging, and backlog metrics.
- [ ] 2.9 Run Go formatting, static analysis, race-enabled tests, container restart tests, and an integration test against the LIMS outbox contract before merging PR S1.

**Exit gate:** LIMS events become durable idempotent SQLite jobs; no notification is sent.

## 3. Phase S2 - Installation Registry API (PR S2)

**Prerequisite:** PR S1 merged.

**PR boundary:** Private installation lifecycle only. Do not implement FCM delivery.

- [ ] 3.1 Review current primary security guidance and select HMAC or short-lived signed service-token authentication with timestamp and replay protection.
- [ ] 3.2 Implement request authentication, nonce/request-ID replay tracking, bounded clock skew, request-size limits, and rate limiting.
- [ ] 3.3 Implement validated installation upsert/refresh using unique `(app_id, fid)` and reject application namespaces outside the configured allowlist.
- [ ] 3.4 Implement atomic FID rebind and reactivation with incrementing `owner_version`, plus an opaque installation handle returned to LIMS.
- [ ] 3.5 Implement compare-and-disable targeted by opaque installation handle plus expected `app_id`, owner, and `owner_version`, with stale or mismatched requests becoming idempotent no-ops and historical delivery snapshots retained.
- [ ] 3.6 Add redacted installation identifiers for logs and prevent full FID logging or unsupported enumeration endpoints.
- [ ] 3.7 Add contract tests for valid authentication, missing/expired/forged/replayed requests, duplicate upsert, rebind, reactivation, delayed logout, stale generation, wrong opaque handle, multiple installations sharing an owner version, cross-app rejection, rate limits, and redaction.
- [ ] 3.8 Publish the versioned internal API contract required by LIMS Phase L2 and verify it from a contract-test client.
- [ ] 3.9 Run Go formatting, static analysis, race-enabled tests, API fuzz/size-limit checks, and private-container integration tests before merging PR S2.

**Exit gate:** LIMS can securely manage multiple active installations per analyst; no FCM send occurs.

## 4. Phase S3 - FCM Delivery Worker (PR S3)

**Prerequisite:** PR S2 merged and controlled Firebase project credentials are available outside Git.

**PR boundary:** Provider delivery and retry only. Do not add public APIs, templates, schedules, or new audiences.

- [ ] 4.1 Review current official Firebase Admin Go and FCM documentation for `firebase.google.com/go/v4/messaging`, FID sends, error taxonomy, retry guidance, and acceptance semantics.
- [ ] 4.2 Add Firebase Admin Go initialization from a read-only runtime credential path with fail-closed production validation.
- [ ] 4.3 Implement transactional job fan-out to every enabled installation matching `(app_id, recipient_user_id)`, snapshot owner generation, and create unique `(job_id, installation_id)` deliveries.
- [ ] 4.4 Implement the exact data-only title/body contract and assert the absence of customer, patient, result, assay, sample UUID, `app_id`, URL, and deep-link fields.
- [ ] 4.5 Implement delivery claiming with lease tokens, stale-processing recovery, immediate pre-send handle/generation re-check, graceful shutdown, provider timeout, and truthful `queued`, `processing`, `accepted_by_fcm`, `failed`, `expired`, and `skipped_stale_installation` states.
- [ ] 4.6 Implement bounded exponential backoff with jitter for transient failures and configured attempt/age expiry.
- [ ] 4.7 Compare-and-disable by opaque installation handle and snapshotted ownership generation on permanent unregistered responses; do not disable another installation, a newer generation, or a FID solely for a payload-invalid response.
- [ ] 4.8 Add tests for zero-target and mixed terminal job outcomes; one and multiple installations; cross-app exclusion; rebind/disable after fan-out but before send; no FCM call for stale generation; distinct recompletion events; duplicate event processing; transient retry; stale invalidation; payload failure; timeout; retry exhaustion; and restart during fan-out.
- [ ] 4.9 Add deterministic provider crash-window and shutdown tests before send, after dispatch with unknown outcome, and after FCM acceptance but before SQLite commit; document when later recovery can duplicate provider submission.
- [ ] 4.10 Verify controlled delivery with a test-only FID and service-worker harness, reserving real LIMS two-browser E2E for R0, and confirm FCM acceptance is never recorded as device delivery.
- [ ] 4.11 Run Go formatting, static analysis, race-enabled tests, container integration tests, and secret-leak scans before merging PR S3.

**Exit gate:** The service can deliver the approved event to all enabled recipient installations with bounded retry and truthful state.

## 5. Phase S4 - Production Operations Readiness (PR S4)

**Prerequisite:** PR S3 merged.

**PR boundary:** Security hardening, backup, monitoring, deployment configuration, and runbooks only. Do not deploy or enable production traffic.

- [ ] 5.1 Harden the production image and Compose service with non-root execution, dropped capabilities, `no-new-privileges`, read-only root filesystem where practical, resource limits, log rotation, and graceful stop.
- [ ] 5.2 Make Compose reference the approved external private Docker network without creating it or publishing any Notification Service application port to the host or Internet.
- [ ] 5.3 Mount Firebase credentials and LIMS/service credentials read-only from protected home-server paths; document creation, permissions, rotation, and emergency revocation.
- [ ] 5.4 Implement private dependency readiness, nonzero process termination for enabled-worker exit/stall, a pinned `worker_stall_timeout` validated against operation deadlines, backlog count/oldest-age metrics, normalized FCM failure metrics, and privacy-safe structured logs.
- [ ] 5.5 Implement online-safe encrypted SQLite backup with separately managed keys, restricted access, bounded retention/rotation, an off-host failure-independent destination, integrity checks, creation/verification/staleness alerts, and a restore drill.
- [ ] 5.6 Add maintenance for stale installations, expired jobs, bounded history retention, and non-destructive cleanup.
- [ ] 5.7 Document installation, upgrade, migration, rollback, credential rotation, backup/restore, incident response, and PostgreSQL migration triggers for future scaling.
- [ ] 5.8 Verify the image and repository contain no Firebase key, service token, database password, SSH key, tunnel token, `.env` secret, or age identity.
- [ ] 5.9 Verify the production image and Compose configuration locally or in an isolated non-production environment, including required `delivery_cutoff_at`, dark startup, deterministic worker restart, and ingestion, installation API mutation, and FCM delivery disabled.
- [ ] 5.10 Prepare the service-side R0 rollout checklist and evidence template for external-network creation, runtime LOGIN credentials, dark deployment, staged enablement, cross-repo E2E, monitoring, and rollback.

**Exit gate:** The independently deployable Go service is production-ready and has a verified operational recovery path, but no production traffic is enabled.

## 6. Gate R0 - Joint Production Rollout (Operational, No PR)

**Prerequisite:** Service PR S4 and LIMS PR L4 are merged and deployable artifacts plus approved Firebase credentials are available outside Git.

**Operational boundary:** Deployment and controlled enablement only. Any code or schema correction discovered here returns to a new focused PR or forward-only migration.

- [ ] 6.1 Create or verify the external private Docker network and dedicated PostgreSQL LOGIN inheriting only the LIMS L1 consumer role.
- [ ] 6.2 Record UTC `delivery_cutoff_at`, deploy the service dark with protected secret mounts, and verify liveness, readiness, deterministic worker restart, SQLite integrity, encrypted off-host backup, and restore evidence.
- [ ] 6.3 Enable pre-rollout drain mode and verify every accumulated event older than the cutoff becomes terminal `suppressed_pre_rollout` without FCM submission before enabling normal ingestion or installation API mutation.
- [ ] 6.4 With LIMS in `registration_only`, register two browsers for one controlled analyst, enable FCM delivery, and execute completion, reopen, and recompletion tests.
- [ ] 6.5 Verify app-scoped fan-out, ownership-generation fencing, data-only payload privacy, truthful FCM acceptance, and absence of doctor, manager, unrelated analyst, and disabled-installation deliveries.
- [ ] 6.6 Enable `banner_enabled` only after controlled evidence passes, observe backlog and failure metrics, and record rollback evidence.

**Exit gate:** Production notification delivery is enabled, observed, and reversible through configuration with complete joint evidence.
