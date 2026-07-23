## Context

The Notification Service is a new deployable Go capability for the Ubuntu home server. It receives authenticated installation-management calls from LIMS, consumes `sample.completed.v1` events from the LIMS integration outbox, stores durable local job state, and sends browser push messages through Firebase Admin Go.

The initial workload is one LIMS application, one event type, one service replica, and low write concurrency. SQLite is therefore preferred over a second PostgreSQL container. The service remains a microservice because it has an independent repository, process, data store, credentials, deployment lifecycle, and API contract.

This change is stored in the LIMS OpenSpec tree only as the coordinated contract. Applying it MUST initialize and implement a separate `notification-service` repository.

## Goals / Non-Goals

**Goals:**

- Isolate Firebase Admin credentials and provider logic from LIMS.
- Provide durable, idempotent, at-least-once event handling.
- Manage multiple active FIDs for one analyst.
- Deliver the agreed sample-code-only message.
- Run as one small Docker container with one local SQLite volume.
- Expose private health and installation-management endpoints.
- Provide bounded retries, invalid-FID cleanup, backup/restore, and actionable operations.
- Divide implementation into one focused PR per phase.

**Non-Goals:**

- Running service code inside the `lims-lite` repository or container.
- Public browser access to the service.
- Multi-channel notification, arbitrary broadcast, scheduling, templates, or dashboards.
- Multiple service replicas, high availability, remote workers, or networked SQLite storage.
- Confirming that a browser displayed or a user read a notification.
- Storing clinical results, patient data, customer data, or deep links.

## Decisions

### Decision 1: Bootstrap a separate repository

Phase S0 creates a dedicated `notification-service` repository with its own:

- OpenSpec configuration and change history.
- Source, tests, migrations, Dockerfile, Compose file, and runbooks.
- CI and conventional-commit workflow.
- Dependency update and security scanning policy.

No service source code is committed to `lims-lite`. The service repository copies or restates the approved event and API contracts and links back to these coordinated proposals.

### Decision 2: Use one Go binary for API and workers

The MVP uses one compiled Go process that runs:

- A private HTTP API for health and installation lifecycle.
- A periodic outbox-ingestion goroutine.
- A delivery-worker goroutine.

One process avoids cross-container SQLite locking and reduces home-server operational overhead. A root cancellation context owns the HTTP server and worker goroutines. An unexpected exit from an enabled critical worker, or failure to advance its heartbeat/progress within the configured `worker_stall_timeout`, cancels the root context and terminates the process nonzero so Docker restarts it. Disabled workers are excluded from this rule. Startup fails unless the timeout exceeds the worker's maximum operation deadline plus poll interval.

Internal Go packages still separate configuration, API, SQLite, ingestion, jobs, delivery, and operations so they can become separate processes later. S0 selects the Go version, HTTP stack, SQLite driver, migration tool, and CGO policy after consulting current primary documentation. S3 uses the official `firebase.google.com/go/v4` Admin SDK. Library choices MUST preserve the specified language-neutral wire contracts.

Alternatives considered:

- **Separate API and worker containers sharing SQLite:** workable on one host, but adds lock coordination and deployment ordering without MVP benefit.
- **PostgreSQL container:** stronger concurrency and scaling, but unnecessary for one replica and increases backup and operations work.
- **In-memory queue:** rejected because restarts would lose events and retry state.

### Decision 3: Use SQLite with a local named volume

The database resides on a local Docker volume and uses:

- WAL journal mode.
- Foreign keys enabled.
- Bounded busy timeout.
- Short explicit write transactions.
- A schema migration table.
- Online-safe backup and tested restore procedures.

SQLite MUST NOT reside on NFS, SMB, or another network filesystem. The service remains one replica while SQLite is authoritative.

Initial tables:

```text
installations
- id
- app_id
- user_id
- fid
- owner_version
- enabled
- disabled_reason
- last_seen_at
- created_at
- updated_at

notification_jobs
- id
- source_event_id
- event_type
- app_id
- recipient_user_id
- sample_id
- sample_code
- occurred_at
- status
- target_count
- terminal_delivery_count
- last_error_code
- completed_at
- created_at
- updated_at

notification_deliveries
- id
- job_id
- installation_id
- app_id
- owner_user_id
- owner_version
- status
- attempts
- next_attempt_at
- lease_token
- lease_expires_at
- fcm_message_id
- last_error_code
- accepted_at
- created_at
- updated_at
```

Required uniqueness:

- `(app_id, fid)` for installation ownership and rebind.
- `source_event_id` for job ingestion idempotency.
- `(job_id, installation_id)` for fan-out idempotency.

Rebind or reactivation increments `owner_version`. Delivery rows snapshot `app_id`, `owner_user_id`, and `owner_version` so later installation mutation cannot rewrite delivery history.

Job states distinguish `queued`, `suppressed_pre_rollout`, `fanout_processing`, `deliveries_pending`, `completed_no_targets`, and `completed`. Fan-out occurs in one SQLite transaction. A job becomes `completed` only when all of its delivery rows are terminal; accepted, failed, expired, and stale-installation-skip counts remain separately observable.

### Decision 4: Use a two-stage durable handoff

The ingestion loop:

1. Claims a bounded batch through the LIMS outbox function.
2. Receives a fresh claim token and lease expiry, then validates the event version and required fields.
3. Inserts the SQLite job or finds it by `source_event_id` and compares every immutable field: event type, `app_id`, recipient user, sample ID, sample code, and occurrence time.
4. Commits the SQLite transaction.
5. Acknowledges the LIMS event using the current claim token.

If the process crashes after step 4 and before step 5, the event is claimed again. An identical immutable payload reuses the unique job and is acknowledged without creating a duplicate. A mismatched payload for the same `source_event_id` is an integrity conflict: the service records a terminal ingestion conflict, reports it through the current LIMS failure claim, alerts operations, and does not acknowledge or deliver it.

Retryable ingestion failures release the event with bounded backoff. Unsupported or malformed events are reported with the current claim token into the LIMS terminal quarantine state and are not silently acknowledged, delivered, or reclaimed forever. Expired claims receive a new token; operations using an older token are rejected as stale.

Production activation also supplies a UTC `delivery_cutoff_at`. Events older than the cutoff are ingested into terminal `suppressed_pre_rollout` jobs and acknowledged without fan-out or FCM submission. R0 drains this historical backlog before registration or normal delivery is enabled.

### Decision 5: Authenticate every non-health API request as service-to-service

The installation API accepts calls only from the LIMS backend over a private Docker network. Authentication uses a rotatable service credential, request timestamp, and replay-resistant request identifier. The concrete mechanism may be HMAC or a short-lived signed token selected in S2.

The API MUST:

- Reject missing, expired, replayed, or invalid authentication.
- Enforce request-size and rate limits.
- Validate `app_id` against the configured application allowlist and validate `user_id`, FID, permission state, ownership generation, and operation.
- Avoid returning or logging full FIDs.
- Never expose a send-notification endpoint to browsers.

### Decision 6: Rebind one FID to the current authenticated user

An FID identifies an app installation, not a permanent user identity. Upserting the same `(app_id, fid)` for a new authenticated user transfers ownership, increments `owner_version`, and returns an opaque installation handle plus the new version. Reactivating a disabled installation also increments the version; refreshing the same active owner does not.

Logout, explicit opt-out, permanent-invalid FCM responses, and stale-installation maintenance target the opaque installation handle and use compare-and-disable with expected `app_id`, owner, and `owner_version`. A delayed request or response for an older generation is an idempotent no-op. Installation mutation never rewrites the owner snapshot stored on historical deliveries.

### Decision 7: Fan out to all enabled installations for the snapshotted recipient

For each job, the service creates one delivery per enabled installation matching both the event's `app_id` and `recipient_user_id`. No doctor, manager, unrelated analyst, or different application namespace lookup occurs.

Each distinct source event is sendable, so a reopened and recompleted sample creates another job. Reprocessing the same source event does not.

Immediately before FCM submission, the worker re-reads the installation by opaque handle and verifies that it remains enabled and that `app_id`, owner user, and `owner_version` still equal the delivery snapshot. A mismatch makes the delivery terminal `skipped_stale_installation` without calling FCM. This closes the queue-time rebind window; permanent-invalid responses use the same handle and generation fence.

### Decision 8: Keep FCM status truthful

Delivery states are:

```text
queued
processing
accepted_by_fcm
failed
expired
skipped_stale_installation
```

Delivery claims use a lease token and expiry so crashed `processing` work becomes recoverable and stale workers cannot commit over a newer attempt. An FCM message ID sets `accepted_by_fcm`; it does not set `delivered`. Transient errors are retried with bounded exponential backoff and jitter. Permanent invalid-installation errors compare-and-disable only the snapshotted ownership generation. Payload errors fail the delivery and alert operations rather than deleting a valid FID.

FCM submission is at-least-once. If FCM accepts a message and the process crashes before SQLite records that response, the recovered delivery may be submitted again. Unique rows and fencing prevent duplicate internal state, but cannot promise exactly-once browser display.

Graceful shutdown stops new delivery claims first. An attempt not yet submitted to FCM is released safely. Once the provider request has been dispatched, the worker waits up to the configured provider deadline for a definitive response and persists that response before releasing the lease. If shutdown reaches its timeout without a definitive provider outcome, the service never marks the delivery complete; it leaves the processing lease to expire and records or logs an `outcome_unknown` attempt for idempotent recovery. A later retry may duplicate provider submission under the documented at-least-once contract.

### Decision 9: Fix the visible payload and omit navigation data

The service sends a data-only FCM message whose presentation fields are:

```text
Title: Mẫu đã hoàn thành
Body: Mẫu {sample_code} đã được phê duyệt
```

The versioned data envelope contains only the presentation type, title, and body needed by LIMS. No customer, patient, assay, result, confidential flag, sample UUID, `app_id`, URL, or deep link is sent to FCM. The LIMS foreground handler and service worker own presentation; the service worker owns root/focus click behavior. Using data-only messages avoids Firebase auto-display competing with LIMS presentation.

### Decision 10: Keep the runtime private and secret-safe

The Compose stack:

- Builds a minimal runtime image from a multi-stage Go build and contains one application binary.
- Publishes no application port to the host or Internet.
- Declares the pre-agreed external Docker network shared with the LIMS app and outbox database endpoint; R0 creates and verifies that network before activation.
- Mounts Firebase credentials read-only.
- Runs as non-root with dropped capabilities and `no-new-privileges`.
- Uses a read-only root filesystem where practical and a writable SQLite volume only.
- Defines health checks, restart policy, resource limits, log rotation, and graceful shutdown.

SQLite backups use the online backup mechanism, are encrypted with a separately managed key, and are written to an access-restricted destination outside both the service volume and the home-server failure domain. Retention and rotation are bounded. Backup creation, integrity verification, restore verification, and maximum-age failures all alert operations.

### Decision 11: Follow the shared PR-sized roadmap

| Order | Phase | Repository | PR scope | Exit boundary |
| --- | --- | --- | --- | --- |
| 1 | L0 | `lims-lite` | Atomic approval mutation | Reliable source transition |
| 2 | L1 | `lims-lite` | Outbox and consumer DB contract | Durable events may accumulate |
| 3 | S0 | `notification-service` | Repo, SQLite, health, local Docker | Dark service foundation |
| 4 | S1 | `notification-service` | Outbox ingestion and idempotent jobs | Durable handoff without delivery |
| 5 | S2 | `notification-service` | Installation registry API | Internal FID lifecycle available |
| 6 | L2 | `lims-lite` | Registration proxy and logout/rebind backend | Authenticated LIMS integration |
| 7 | S3 | `notification-service` | FCM sender, retry, invalid-FID handling | Delivery pipeline complete |
| 8 | L3 | `lims-lite` | Browser SDK, service worker, permission UX | Client complete but gated off |
| 9 | S4 | `notification-service` | Production security, backup, monitoring | Service production-ready |
| 10 | L4 | `lims-lite` | Runtime network and environment wiring | Private cross-service path ready |

Each service phase has its own focused test command and must not require loading later-phase context to review it.

After all implementation PRs merge, joint operational gate R0 creates runtime credentials and networking, deploys the service dark, enables ingestion and the installation API, runs controlled end-to-end tests in `registration_only`, and only then enables the LIMS banner.

## Risks / Trade-offs

- **SQLite permits only one writer at a time** -> Use one process, WAL mode, short transactions, bounded batches, and lock-contention metrics.
- **The service and LIMS remain on one physical server** -> Treat separation as security and ownership isolation, not high availability.
- **Direct PostgreSQL outbox access couples the service to one integration contract** -> Restrict access to stable claim/ack functions rather than application tables.
- **Service credential compromise allows FID mutation** -> Use private networking, replay resistance, rotation, rate limiting, and audit-safe logs.
- **Firebase credential compromise enables unauthorized sends** -> Use a dedicated least-privilege service account, read-only mount, and documented rotation.
- **A stale shared-browser registration can expose a sample code** -> Compare-and-disable by ownership generation, rebind on login, expire stale installations, and send no other data.
- **An FCM acceptance crash window can display a duplicate** -> Use delivery leases and truthful at-least-once semantics; do not claim exactly-once provider delivery.
- **SQLite backup taken incorrectly can be inconsistent** -> Use an online backup method, verify restore, and monitor backup age.
- **Outbox backlog can grow during downtime** -> Report oldest pending age and batch consumption without dropping events.
- **A future second replica cannot safely share the SQLite design** -> Make PostgreSQL migration an explicit prerequisite before horizontal scaling.

## Migration Plan

1. Complete S0 in the new repository with unit tests and local Docker verification.
2. Complete S1 against a contract fixture, then verify against the L1 outbox on the home server.
3. Complete S2 and test authentication, rebind, disable, and redacted logging.
4. Complete S3 with a Firebase test project and test-only FID/service-worker harness before production credentials are mounted.
5. Complete S4: production-ready Compose, secret mounts, resource controls, backup/restore, worker-aware health, and backlog monitoring without enabling production traffic.
6. Complete L4 so both repositories declare the shared network, configuration, and verification commands.
7. Execute R0 to record `delivery_cutoff_at`, create the external network and dedicated PostgreSQL LOGIN, then deploy the service with ingestion, installation API, and delivery disabled.
8. Verify private connectivity, SQLite migrations, worker health, encrypted off-host backup, and restore evidence.
9. Enable pre-rollout drain mode and verify every pre-cutoff event becomes terminal `suppressed_pre_rollout` without FCM submission.
10. Enable normal delivery and the installation API, register allowlisted analyst browsers while LIMS is `registration_only`, and execute the joint end-to-end gate before enabling `banner_enabled`.

Rollback strategy:

- Disable FCM delivery while preserving jobs and installations.
- Stop ingestion while preserving LIMS outbox events.
- Roll back the container image without rolling back SQLite schema destructively.
- Restore SQLite from the last verified backup only after preserving the failed database for investigation.
- Rotate service or Firebase credentials immediately when compromise is suspected.

## Open Questions

- Select the Go version, HTTP stack, SQLite driver, migration tool, and CGO policy during S0.
- Select HMAC versus short-lived signed service tokens during S2.
- Set maximum retry count, backoff caps, job expiry, stale-installation threshold, and history retention during S3/S4.
- Select the backup destination outside the home-server disk and the alert delivery channel during S4.
