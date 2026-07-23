## Why

Analysts currently receive no proactive browser notification when a sample they received is approved and moves from `review` to `completed`. LIMS needs a durable, privacy-limited integration that emits this business event without coupling manager approval success to Firebase availability or placing Firebase Admin credentials in the application.

## What Changes

- Add a transactional outbox event for every committed `review -> completed` sample transition with a valid receiving analyst, or a durable recipient anomaly otherwise.
- Version the completion-event and consumer protocol, including a server-derived application namespace, immutable payload fields, fenced leases, idempotent acknowledgement, retryable release, and terminal failure handling.
- Snapshot the receiving analyst from `samples.received_by` into each event so delayed processing cannot redirect the notification.
- Harden the approval transition so result approval, sample completion, and event creation have a reliable database boundary before push delivery is enabled.
- Add authenticated backend integration for registering, rebinding, and compare-and-disabling browser Firebase Installation IDs (FIDs) through the separate Notification Service.
- Use an opaque installation handle and ownership generation so delayed logout or stale FCM invalidation cannot disable a browser after it has been rebound.
- Add Vietnamese opt-in UX: a one-time post-login banner whose button opens the browser permission prompt, plus current-browser controls in the user profile.
- Add the Firebase Web SDK, same-origin service worker, data-only foreground/background presentation, and logout cleanup required by FCM Web.
- Send no clinical result, customer information, patient information, or deep link from LIMS. The visible message contract contains only the sample code.
- Deliver the change through small dependency-ordered phases where each phase is intended to fit one focused PR.
- Depend on the coordinated Go-based `bootstrap-notification-service` change for installation storage, SQLite job state, retry, Firebase Admin Go delivery, and service operations.

## Capabilities

### New Capabilities

- `fcm-web-notification-integration`: Browser permission UX, FID lifecycle, backend registration boundary, service-worker behavior, and privacy-limited notification presentation for authenticated LIMS users.

### Modified Capabilities

- `sample-management`: Make each committed `review -> completed` transition record either one durable `sample.completed.v1` event addressed to the active analyst in `samples.received_by` or a durable invalid-recipient anomaly, including a new event when a reopened sample is completed again.

## Impact

- **Database and workflow:** Adds forward-only outbox and durable anomaly records, a fenced claim/acknowledgement contract for the Notification Service, transition tests, and approval-boundary hardening. The integration tables must not be exposed to `anon` or general `authenticated` access, and migration security tests remain mandatory.
- **Compliance and audit:** Push remains advisory and is not an authoritative laboratory record. Approval must succeed independently of FCM availability. Event creation, installation registration changes, and service calls must be traceable without logging FIDs, credentials, patient data, customer data, or result values.
- **Backend:** Affects approval orchestration, `src/lib/api-client.ts`, the client-action or focused API boundary, logout handling, and internal service authentication.
- **Frontend:** Adds Vietnamese permission messaging, profile controls, Firebase initialization, foreground handling, and a same-origin service worker. Notification clicks only focus an existing LIMS window or open the application root.
- **Operations:** Requires private Docker-network connectivity to the separate Notification Service, public Firebase browser configuration, staged `off -> registration_only -> banner_enabled` rollout modes, and a joint operational rollout gate after all implementation PRs. Firebase Admin credentials remain exclusively in the service.
- **Dependencies:** Coordinated with `bootstrap-notification-service`; LIMS phases must not enable browser registration or delivery before the corresponding internal service contracts are deployed.
- **Non-goals:** Sending to doctors or managers, sending to analysts other than `samples.received_by`, customer/patient/result content, sample-detail deep links, email/SMS/Zalo, scheduling, or an in-app notification center.
