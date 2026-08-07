## Delivery Rules

- Keep the service independent from LIMS code and data.
- Use local verification only. Do not add hosted CI/CD, dependency automation,
  scheduled refreshes, or publication pipelines.
- Keep the runtime read-only and the network private through Tailscale.
- Use one reviewable phase at a time.

## 1. Phase S0a - Service Repository and Toolchain

- [x] 1.1 Create the independent `vietnamese-address-service` repository with
  ownership, support, compatibility, release, and OpenSpec documentation.
- [x] 1.2 Pin Go and the CGO-free SQLite driver.
- [x] 1.3 Establish small configuration, dataset, HTTP, and lifecycle packages.
- [x] 1.4 Add proportional local formatting, vet, test, and build verification.
- [x] 1.5 Keep ordinary tests synthetic and independent of live services.

**Exit gate:** The independent repository can accept runtime work.

## 2. Phase S0b - Read-Only Runtime

- [x] 2.1 Add a synthetic read-only SQLite repository and startup validation.
- [x] 2.2 Add liveness and readiness endpoints.
- [x] 2.3 Add bounded HTTP lifecycle, metadata-only logs, and graceful shutdown.
- [x] 2.4 Add a reproducible CGO-free Linux build and resource documentation.
- [x] 2.5 Verify the local runtime without containers or home-server access.

**Exit gate:** The health-only process can safely open an immutable snapshot.

## 3. Phase S1 - Current Dataset

**Boundary:** Current province/commune data and deterministic SQLite generation
only. Do not add API data handlers or LIMS code.

- [x] 3.1 Pin one `thanglequoc/vietnamese-provinces-database` commit and
  simplified JSON artifact in a versioned manifest.
- [x] 3.2 Retain the content-addressed JSON artifact and MIT license with
  retrieval metadata, checksums, and parser/toolchain versions.
- [x] 3.3 Add deterministic JSON parsing with local synthetic fixtures and no
  live downloads during verification.
- [x] 3.4 Generate current `dataset_metadata`, `source_artifacts`, provinces,
  communes, parent ownership, and provenance in service-owned SQLite.
- [x] 3.5 Reject duplicate codes, orphan communes, unsupported unit kinds,
  missing normalized names, invalid metadata, and incomplete provenance.
- [x] 3.6 Cross-check codes, names, normalized fields, nested province
  ownership, and counts within the pinned artifact.
- [x] 3.7 Keep expected counts and artifact size bounds in the manifest and fail
  closed on schema or semantic drift.
- [x] 3.8 Cover malformed, missing, checksum-invalid, duplicate, orphan,
  semantic disagreement, reviewed count change, and reproducibility fixtures.
- [x] 3.9 Verify SQLite integrity, exact rebuilds, retained inputs, source terms,
  provenance, and artifact size.

**Exit gate:** The current immutable dataset rebuilds exactly from the retained
pinned artifact.

## 4. Phase S2 - Minimal Read-Only API

**Boundary:** Current metadata, lookup, and simple search only.

- [x] 4.1 Define small JSON contracts for metadata, provinces, communes, search,
  and stable errors.
- [x] 4.2 Add `/v1/meta`, `/v1/provinces`, and
  `/v1/provinces/{code}/communes`.
- [x] 4.3 Add bounded current-name search with case, whitespace, diacritic, and
  `đ`/`d` normalization, exact/prefix priority, and lightweight edit-distance
  typo tolerance.
- [x] 4.4 Enforce method, query length, result limit, timeout, concurrency, and
  response-size bounds.
- [x] 4.5 Keep logs metadata-only and reject unsupported PII-bearing fields.
- [x] 4.6 Add focused handler, ordering, cancellation, error-redaction, and
  representative search tests.
- [x] 4.7 Verify local Go checks and production-shaped process behavior.

**Exit gate:** Internal consumers can query current address references through
a stable bounded read-only API.

## 5. Phase L1 - LIMS Server Adapter and Autocomplete

**Boundary:** Application integration only. No LIMS database migration.

- [x] 5.1 Add server-only Tailscale service URL and timeout configuration with
  autocomplete disabled by default when configuration is absent.
- [x] 5.2 Add an authenticated, role-authorized LIMS server adapter for
  metadata, provinces, communes, and search.
- [x] 5.3 Add a reusable current-address autocomplete to the existing client
  address input.
- [x] 5.4 Format a selected commune and province into the existing address
  string and persist it through the existing client mutation.
- [x] 5.5 Preserve manual entry whenever the service is unavailable or no result
  is suitable.
- [x] 5.6 Preserve CCCD-first ownership and ignore stale autocomplete responses
  after a newer scan or user edit.
- [x] 5.7 Add focused authorization, timeout, fallback, stale-response,
  scanner-first, and manual-entry tests.
- [x] 5.8 Verify typecheck, lint, tests, and a production build.

**Exit gate:** LIMS can use current suggestions without a database migration or
availability dependency.

## 6. Gate R0 - Manual Home-Server Rollout

- [x] 6.1 Run the service as a dedicated host-native process on the home server.
- [x] 6.2 Bind only to the configured private Tailscale interface and port.
- [x] 6.3 Keep the service off public Internet routes, Cloudflare Tunnel/Funnel,
  and browser CORS.
- [x] 6.4 Deploy an exact verified revision and immutable SQLite snapshot.
- [x] 6.5 Configure LIMS to call the private Tailscale service URL.
- [x] 6.6 Verify health, province/commune lookup, search, LIMS manual fallback,
  and CCCD-first behavior.
- [x] 6.7 Retain and rehearse rollback to the previous working revision.

**Exit gate:** The private service and LIMS integration operate on the home
server with manual rollback available.
