## Why

FCM delivery needs an independently deployable capability that protects Firebase Admin credentials, survives temporary outages, manages browser installations, and retries delivery without increasing the failure surface of LIMS approval. A small Go service with SQLite is sufficient for the initial single-host workload, integrates directly with the official Firebase Admin Go SDK, and keeps notification concerns outside the application repository.

## What Changes

- Define a new `notification-service` repository and Docker stack; no microservice implementation code will be added to `lims-lite`.
- Build one Go binary and run one service container containing the internal API, outbox-ingestion goroutine, and delivery goroutine for the MVP.
- Store installations, jobs, and delivery attempts in SQLite on a local Docker volume with WAL mode, bounded lock waiting, short write transactions, and online-safe backup procedures.
- Accept authenticated installation upsert, generation-changing rebind, and compare-and-disable requests from the LIMS backend only.
- Consume `sample.completed.v1` outbox events through a fenced least-privilege PostgreSQL contract and create one idempotent notification job per event.
- Fan out each job to every enabled installation matching the event's `app_id` and `recipient_user_id`, snapshotting installation ownership generation in each delivery.
- Send a data-only FCM message whose exact visible presentation is `Mẫu đã hoàn thành` / `Mẫu {sample_code} đã được phê duyệt`, without customer information, patient information, result data, sample UUID, application namespace, URL, or deep link.
- Treat every distinct `review -> completed` event as sendable, including completion after reopening, while deduplicating retries of the same `event_id`.
- Record durable job terminal outcomes and `queued`, `processing`, `accepted_by_fcm`, `failed`, and `expired` delivery states without claiming device delivery confirmation.
- Retry transient failures with bounded exponential backoff, compare-and-disable invalid FIDs, expose worker-aware health/readiness checks, and provide backup/restore and operational runbooks.
- Deliver the service through small dependency-ordered phases where each phase is intended to fit one focused PR.
- Coordinate with `add-fcm-notification-integration`, which owns the LIMS outbox, authenticated browser UX, FID registration proxy, and service worker.

## Capabilities

### New Capabilities

- `notification-installation-management`: Securely register, rebind, disable, and expire per-browser FIDs for authenticated LIMS analysts across multiple active installations.
- `notification-event-delivery`: Idempotently ingest LIMS completion events, create jobs, fan out deliveries, call the official Firebase Admin Go SDK, retry transient failures, and record truthful delivery states.
- `notification-service-operations`: Run the isolated SQLite-backed Docker service with private networking, secret mounts, health checks, backup/restore, resource limits, and operational monitoring.

### Modified Capabilities

None.

## Impact

- **Repository boundary:** Implementation belongs in a new Go `notification-service` repository. This OpenSpec change remains in `lims-lite` only as the coordinated architecture and execution contract until that repository is initialized.
- **Data:** The service owns a SQLite database containing FIDs and operational delivery metadata. It must not persist patient details, customer details, result values, or Firebase credentials in the database or logs.
- **Security:** The API is private, service-authenticated, rate-limited, and unavailable directly to browsers. Firebase service-account credentials are mounted read-only and never committed or embedded in images.
- **LIMS database access:** The worker receives only the minimum PostgreSQL privileges needed to claim, acknowledge, release, or terminally fail integration outbox events; it receives no general application-table access.
- **Operations:** Adds one application container and one local persistent volume on the Ubuntu home server. It shares a private external Docker network with LIMS but publishes no host or Internet port.
- **Reliability:** Outbox ingestion and internal job creation are idempotent. Provider submission is at-least-once because a crash after FCM acceptance but before the SQLite commit can cause a duplicate send; notification failure never rolls back sample approval.
- **Scalability boundary:** SQLite is the MVP store for one host and one service replica. Multiple replicas, remote workers, or sustained write contention require a planned migration to PostgreSQL.
- **Non-goals:** Multi-channel delivery, template editors, arbitrary broadcast APIs, scheduling, dashboards, public APIs, confirmed device delivery, high availability, or running the service outside the home server in the initial release.
