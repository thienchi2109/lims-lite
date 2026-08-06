## Context

The reference data already exists in
`thanglequoc/vietnamese-provinces-database`. The service does not need its own
data-acquisition platform, historical model, publication pipeline, or search
engine. It only needs to pin a reviewed source revision, package current
province/commune data into SQLite, and expose a small private API.

LIMS already stores a human-readable client address and already has
authenticated server-side mutation boundaries. The integration can remain
additive in application code without changing the LIMS database.

## Goals / Non-Goals

**Goals:**

- Run one small Go service on the home server.
- Communicate only through the private Tailscale network.
- Rebuild one immutable current-address SQLite snapshot from a pinned community
  dataset revision.
- Provide provinces, communes by province, and simple bounded current-name
  search.
- Let LIMS use suggestions without blocking manual entry or CCCD scanning.
- Keep updates, verification, deployment, and rollback manual.

**Non-Goals:**

- Historical names, administrative lineage, old-to-new resolution, or code
  reuse history.
- Dedicated FTS/n-gram infrastructure, GIS, geocoding, or street-level data.
- LIMS structured-address columns or a database migration.
- Public Internet access, browser-direct calls, CORS, or an application API
  key.
- Containers, hosted CI/CD, automated dependency updates, scheduled refreshes,
  automated publication, or external failure notifications.

## Decisions

### Decision 1: Use a pinned community dataset

The service repository SHALL pin one
`thanglequoc/vietnamese-provinces-database` commit
`cd58063299585146ded3981f2272946ef19ced54` and retain
`json/simplified_json_generated_data_vn_units_2026-07-25__20_49_07.json` plus
its MIT license. A small manifest SHALL record the source commit, path,
checksum, expected 34 province-level and 3,321 commune-level records, parser
version, and generated snapshot checksum.

The builder SHALL use retained local files only. It SHALL fail on checksum,
schema, duplicate-code, invalid-parent, unsupported-kind, count, provenance, or
SQLite integrity errors. No live download occurs during ordinary verification.

### Decision 2: Generate one service-owned SQLite snapshot

The service SHALL generate a deterministic SQLite file containing:

- dataset and source metadata;
- current provinces;
- current communes with province ownership;
- normalized names needed by simple search.

The runtime SHALL open the snapshot read-only. The source JSON schema is not a
runtime contract for LIMS.

### Decision 3: Expose a minimal read-only API

The service SHALL expose:

- `GET /health/live`;
- `GET /health/ready`;
- `GET /v1/meta`;
- `GET /v1/provinces`;
- `GET /v1/provinces/{code}/communes`;
- `GET /v1/search?q=...&province_code=...&limit=...`.

Search SHALL cover current names only. It SHALL normalize case, whitespace,
Vietnamese diacritics, and `đ`/`d`; rank exact and prefix matches first; then
MAY use bounded edit distance over the small current dataset as a typo-tolerant
fallback. It SHALL use a stable total order and enforce query, candidate, and
result limits. Historical resolution and dedicated FTS/n-gram infrastructure
are out of scope.

### Decision 4: Keep the service private through Tailscale

The service SHALL run as a host-native process on the home server and listen on
a configured private address and port reachable through Tailscale. It SHALL
not bind a public wildcard address, be routed through Cloudflare Tunnel or
Funnel, or accept browser-originated requests.

The private network is the service trust boundary. The service does not need an
application API key. LIMS remains responsible for authenticating and
authorizing its own users before its server-side adapter calls the service.

### Decision 5: Keep LIMS integration small

LIMS SHALL call the service only from server-side code. Client components SHALL
call an authenticated same-origin LIMS action or route, never the address
service directly.

Selecting a suggestion SHALL format the existing address string from the
selected commune and province. The existing client mutation persists that
string and remains covered by current authorization and auditing. No new LIMS
address columns are required.

Manual entry SHALL remain available whenever the service is disabled,
unavailable, slow, or returns no useful result. CCCD scanning remains the
primary path and newer scan or user-owned form state always wins over stale
autocomplete results.

### Decision 6: Use manual maintenance only

There SHALL be no hosted CI/CD, automated dependency updater, scheduled dataset
job, automated publication, or deployment controller for this service.

A maintainer manually:

1. pins a reviewed upstream revision;
2. retains the source artifact and license;
3. rebuilds the SQLite snapshot;
4. runs local verification;
5. deploys an exact service revision to the home server;
6. verifies health and representative API responses.

The previous working service revision and snapshot remain available for manual
rollback.

## Delivery

The remaining work is intentionally small:

1. **S1 - Dataset:** pin source, retain evidence, generate and verify SQLite.
2. **S2 - API:** add current province/commune lookup and simple search.
3. **L1 - LIMS integration:** add the server adapter and optional
   autocomplete using the existing address field.
4. **R0 - Home-server rollout:** deploy through Tailscale, verify, and rehearse
   manual rollback.

Each phase remains separately reviewable, but no additional architecture phase
or automation layer is required.
