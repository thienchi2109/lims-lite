# Bounded import policy gate — 2026-11-08

**PASS for the bounded rollout policy below; full TASK-7 certification remains INCOMPLETE.** The user explicitly approved isolated measurement, production migration/configuration prerequisites and deployment. This record does not certify concurrency, every valid sub-limit workbook, full fault/TTL/purge scheduling, production browser E2E, or a five-second SQL commit SLO.

## Environment and authority

- Home server `khoa-xn-cdc`; code `bd3b0a273c8abea12910a04ffaa896f517945054`.
- Fresh schema-only database `task7_policy_20261108`, matched production locale; no production business rows copied. Committed migrations 240 → 241 → 243 → 244 applied there, security 36/36 after each. Root independently reran final security 36/36 twice.
- Synthetic auth, two actors, one sample type and 20 assay/method pairs; catalog reviewed/published through product RPCs with guards/audits enabled. Templates fetched with real synthetic analyst SSR authentication from the current product generator. No prototype signing authority or Guide-row padding was used.
- Isolated app/driver CPU 1, memory 1,073,741,824 bytes; current production app has matching CPU/memory limits. Isolated auth-bound images were never promoted.
- Runtime artifacts on the home server: `/tmp/lims-lite-task7-policy-20261108/`. Credentials are excluded from evidence and removed during isolated cleanup. `measure.cjs`, safe JSONL/resource/before/after reports and baseline DDL are retained for review.

## Selected policy

```json
{
  "evidenceId": "task7-bounded-policy-20261108-bd3b0a2-v1",
  "leaseMs": 60000,
  "heartbeatMs": 5000,
  "request": {
    "maxBytes": 10010000,
    "maxResponseBytes": 524288,
    "timeoutMs": 30000
  },
  "resources": {
    "maxInflatedBytes": 33554432,
    "maxEntries": 36,
    "maxCells": 32768,
    "maxXmlDepth": 18,
    "maxXmlTextBytes": 4194304,
    "maxRetainedBytes": 268435456,
    "maxElapsedMs": 3000
  }
}
```

This policy imposes technical byte/time/parser budgets, not business count caps. Source file admission remains strictly `0 < size < 10,000,000` decimal bytes. A sub-limit workbook can still fail validation or a resource guard; responses/preview rows are not truncated to make it appear valid.

## Measurements

Exploratory trials established counters and candidate limits; all valid cohorts were rerun three times under the selected policy, with unique business intent per trial so confirmation measured real independent commits rather than normalized-hash replay.

| Selected cohort | Result |
| --- | --- |
| Normal: 10 clients / 20 samples / 100 assignments | 3/3 preview + confirm succeeded |
| Valid exact 9,999,999-byte workbook | 3/3 preview + confirm succeeded, including chunked upload |
| Valid high-compression workbook | 3/3 preview + confirm succeeded |
| Many rows: 501 clients / 1,001 samples / 1,001 assignments | 3/3 succeeded; no business count caps |
| Original file exactly 10,000,000 or 10,000,001 bytes | HTTP 413 |
| Compressed 68,000,000-byte XML payload packed into 633,836 bytes | RESOURCE_LIMIT; no business-row delta |
| Actual inflation quota one byte below observed consumption | RESOURCE_LIMIT in all three boundary probes |

The valid exact-boundary fixture used a product-valid STORED ZIP with legal XML whitespace distributed across eight worksheets; semantic rows were unchanged by padding. Strict parser, preview and committed receipt acceptance were all required. Inflated/resource consumption was measured from actual parser work rather than only central-directory declared sizes.

Selected maxima: preview HTTP **11,226.30 ms**, confirm HTTP **18,812.44 ms**, complete preview response **155,834 bytes**, parser **713.04 ms**, event-loop delay **82.45 ms**, actual inflated bytes **10,035,628**, retained-accounting peak **100,046,961**, and boundary app RSS **255,639,552 bytes**. The many-row selected runs were slower than exploratory runs as the isolated dataset accumulated; the timeout rationale uses the later, higher 18.81-second observation.

The 10,010,000-byte transport budget leaves 9,709 bytes above the largest observed valid multipart body (10,000,291), independently of the original-file ceiling. The response/inflated/retained limits provide approximately 3.36×/3.34×/2.68× measured headroom; cells 3.78×, entries/depth 2×, XML text 3.37×, parser elapsed 4.20×. The 30-second request deadline is approximately 1.59× the measured worst confirmed HTTP duration, not 2.4×. The 60-second lease exceeds the HTTP deadline plus one deadline-length allowance; measured parse/stall are well below the five-second heartbeat interval. These are sequential-fixture margins, not a concurrency or universal capacity guarantee.

Production REST uses its existing postgres connection/default pool with no postgres/service-role statement timeout. An unrelated authenticator-role eight-second setting does not describe this connection. No production DB timeout/resource setting was changed. There is no preloaded `pg_stat_statements`; exact DB-only commit/CPU attribution and the proposed five-second SQL SLO remain INCOMPLETE. Sampling observed one active confirm connection, zero ordinary waiting-lock samples and zero deadlock delta; the deliberate deadline test below observed its expected lock waiter.

## Root independent witnesses

1. A unique normal trial (`serial=8000`) through the isolated stack: parser 180.01 ms; preview HTTP 523.48 ms, counts 10/20/100 and response 3,306 bytes; confirm `succeeded` in 924.63 ms. No fixture replay.
2. A unique exact-boundary trial (`serial=8100`) under the **selected policy and exact tracked nginx file**: original file 9,999,999 bytes; parser 616.26 ms; preview HTTP 200 in 847.14 ms with multipart 10,000,189 bytes; confirm HTTP 200 / `succeeded` in 633.70 ms with multipart 10,000,291 bytes. Exact 10,000,000 and 10,000,001-byte originals both returned HTTP 413.
3. Read-only security 36/36 and final deadline receipt below were queried directly through SSH/Docker/psql. Root inspected the safe policy, deadline summary and retention report separately from worker claims.

## Exact ingress, deadline and retention

The actual tracked `nginx/nginx.conf` SHA-256 was **9bef5c0b373515c813c3a1b563388df4c024eedb405d44175a65414db9a83e97**; root matched local bytes to the file tested by the isolated source-nginx container. `nginx -t` passed. Private import routing uses HTTP/1.1 streaming, 10,010,000-byte transport cap, no request/response proxy buffering, no response temp files/cache/import access logs. Thirty-five-second Nginx timers are inactivity limits with five seconds beyond the app's absolute 30-second deadline; they are not an independent total-request deadline.

An independent proxy-only boundary probe showed body 10,010,000 reaching the app (unauthenticated JSON 401) and 10,010,001 being rejected by nginx (HTML 413), without a DB write. The file-specific 10,000,000-byte rejection is separately proved by the authenticated root witness.

For deadline validation, only the isolated `sample_id_sequences` relation (OID 130154) was locked for 32 seconds. One unique 1/1/1 confirmation through the exact tracked nginx file returned **HTTP 503 / unknown after 30,016.04 ms**, before proxy timeout. There was exactly one confirm connection/sequence-lock waiter. After release, GET returned processing and then the same succeeded receipt 2,267.46 ms after the unknown response, with no repeated POST and +1 client/sample/result/receipt. Root independently read durable receipt `fb251bc7-d63c-4029-b773-9763eba8624b`, confirming counts 1/1/1 and create/reuse 1/0. Receipt admission time is not a DB-only commit-duration measurement.

Retention inspection found no workbook ZIP/synthetic-row markers or exact isolated credentials in app/proxy logs/temp files and 42 safe selected/deadline artifacts. App `/tmp` and nginx body/proxy temp directories were empty; source-nginx access logs contained auth/rest/template requests and zero import-route lines. Provisioned private env/secret files were deliberately excluded from content evidence and removed during cleanup. These observations cover these runs, not all future traffic.

## Cleanup and remaining acceptance

After root witnesses, the worker removed the exact six isolated containers, two private networks, disposable DB, two synthetic image tags and six credential/env files. It checked zero isolated sessions/shared dependencies before dropping the two temporary roles. The fixed migration-243 maintenance role was removed **before** production application could create it, preventing later cleanup from dropping a production role. Production container starts and the existing app were preserved. Safe metrics/driver and protected baseline DDL remain.

Root accepts this measured policy prerequisite with the stated limits. TASK-7 remains In Progress with its full AC unchecked: exact DB budgets, broader concurrency/dedup/fault certification, full TTL/purge scheduling and full root acceptance require their own evidence. Production migration/deployment results are recorded separately; this isolated evidence does not establish production import/browser E2E acceptance.
