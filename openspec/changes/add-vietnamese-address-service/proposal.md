## Why

Manual client-address entry during sample accession is slow, inconsistent, and
cannot reliably follow Vietnam's changing administrative-unit structure. The
same reference data will also be needed by future applications and domains, so
it should be owned by one independently versioned internal service instead of
being duplicated inside LIMS.

## What Changes

- Bootstrap a separate `vietnamese-address-service` repository containing one
  small Go HTTP service and one immutable, read-only SQLite dataset snapshot.
- Build the snapshot from official Vietnamese administrative sources, using the
  `thanglequoc/vietnamese-provinces-database` project as a normalized secondary
  source and cross-check rather than the sole authority. Retain immutable raw
  source artifacts, checksums, parser/toolchain versions, and reviewed semantic
  exceptions so every published dataset can be reproduced after upstream files
  change or disappear.
- Represent current provinces and commune-level units, historical aliases, and
  revision-safe predecessor/successor relationships needed to search former
  names and codes after mergers, splits, renames, transfers, or code reuse.
- Expose a versioned, read-only internal API for province/commune lookup,
  accent-insensitive and fuzzy search, legacy-name resolution, dataset metadata,
  liveness, and readiness. Search ranking, response compatibility, cache
  validators, input bounds, and PII-safe logging are part of the contract.
- Deploy the service on the existing `khoa-xn-cdc` home server in a separate
  Compose project. Same-host applications use a private Docker network; other
  internal applications may use a port bound only to the server's Tailscale
  address.
- Keep the service off the public Internet, Cloudflare Tunnel, and browser
  access. Do not require an application API key in the initial release; the
  Docker/Tailscale network boundary is the trust boundary.
- Automatically detect, validate, build, publish, and deploy new dataset
  snapshots. Failed validation or failed rollout keeps the previous version;
  no external alerting channel is introduced. Material semantic drift requires
  a reviewed manifest or allow-list change, and the home server verifies the
  trusted image identity, digest, and provenance before candidate startup.
- Add a reusable LIMS address-autocomplete integration through the existing
  client-action and `api-client` boundary, with Vietnamese UI and a mandatory
  manual-entry fallback whenever the service is unavailable or no suggestion
  is suitable. Every same-origin address action authenticates and authorizes
  the current LIMS principal before contacting the service.
- Preserve CCCD scanning as the primary client-entry path whenever a supported
  scanner is available. A successful scan continues to auto-fill client data
  immediately; address autocomplete is a secondary normalization/editing aid
  and must not delay or overwrite scanned values without explicit user action.
  Both autocomplete and duplicate-client lookup results are fenced so stale
  asynchronous work cannot replace a newer scan or user-owned form state.
- Preserve the existing human-readable client address while adding nullable
  address detail, structured administrative codes, dataset version, original
  input source, administrative-selection source, and original scanned text when
  normalization changes it. Existing and manually entered addresses remain
  valid without forced conversion, and mutation intent explicitly distinguishes
  preserving metadata from clearing or replacing it.
- Keep sample-level historical address snapshot semantics outside this change;
  this proposal does not redefine whether reports use the client's current
  address or an accession-time address.

## Capabilities

### New Capabilities

- `vietnamese-administrative-address-service`: Generate, validate, publish,
  deploy, operate, and query the private Go/SQLite administrative-address data
  service.
- `vietnamese-address-autocomplete`: Provide a reusable consumer contract for
  current and historical Vietnamese administrative-address suggestions,
  structured selections, dataset provenance, and non-blocking manual fallback.

### Modified Capabilities

- `sample-management`: Enhance analyst sample accession so client addresses can
  use the shared Vietnamese address autocomplete while preserving manual entry,
  existing authorization, audit behavior, and current accession availability.

## Impact

- **Repository boundary:** Service implementation belongs in a new
  `vietnamese-address-service` repository. This change remains in `lims-lite`
  as the coordinated architecture, API, data, rollout, and consumer contract.
- **LIMS code:** Future implementation affects the client form, sample
  accession flow, shared hooks/types, the existing client-action gateway, and
  `src/lib/api-client.ts`. The two active scanner OpenSpec changes must be
  completed, archived, or explicitly reconciled before scanner integration.
- **LIMS database:** A forward-only migration will add nullable structured
  address metadata to `clients`; existing RLS and client audit triggers must
  continue to apply. No existing migration may be edited.
- **External service data:** SQLite contains public administrative reference
  data and release metadata only. It must not contain LIMS users, client
  identities, patient data, sample data, credentials, or application secrets.
- **Security:** The service is read-only and internally reachable. It publishes
  no Internet-facing endpoint, accepts no browser-originated calls, and relies
  on Docker/Tailscale network controls instead of an API key. LIMS remains an
  authenticated, role-authorized, rate-bounded proxy and sends only
  administrative search text, never a complete client or scanned address.
- **Compliance:** Selecting or manually editing a client address remains a LIMS
  client mutation and must remain auditable. Automated reference-data refreshes
  are versioned by source identifiers, checksums, build evidence, and deployed
  image digest.
- **Localization:** Address labels, fallback states, historical-name indicators,
  and validation messages in LIMS are Vietnamese.
- **Operations:** Adds one independently deployable, resource-bounded container
  and an automated pull-based update/rollback path on the home server. The
  service uses no mutable SQLite volume and requires no database backup. The
  deployment controller keeps protected desired/active/previous digest state,
  verifies signed provenance, tests active-plus-candidate resource use, and
  replaces the stable container only after dark candidate verification.
- **Availability:** Address suggestions are assistive. A service outage or stale
  dataset must never block client creation or sample accession.
- **Scanner compatibility:** Existing QR/Web Serial CCCD parsing, duplicate
  lookup, client prefill, and scanner-first workflows remain authoritative and
  require focused regression coverage.
