## Why

LIMS currently accepts client addresses as free text. A small shared reference
service can make province and commune selection faster and more consistent
without moving administrative data into LIMS or complicating its database.

## What Changes

- Keep `vietnamese-address-service` as a separate Go repository.
- Pin one revision of `thanglequoc/vietnamese-provinces-database`, retain its
  simplified JSON artifact and MIT license, and generate one immutable
  service-owned SQLite snapshot.
- Expose a small read-only API for metadata, provinces, communes by province,
  and bounded current-name search.
- Run the service on the home server and expose it only through the private
  Tailscale network. Do not expose it to the Internet or browser clients.
- Add a LIMS server-side adapter that calls the service over Tailscale.
- Add optional autocomplete to the existing client address workflow. Selecting
  a result formats the existing address text; manual entry remains available
  and no LIMS schema migration is required.
- Preserve CCCD scanning as the primary fast-entry path. Autocomplete must not
  overwrite a newer scan or user edit.
- Keep updates manual and infrequent: pin a reviewed source revision, rebuild,
  verify, deploy, and retain the previous working revision for rollback.
- Do not add historical lineage, a dedicated FTS/n-gram search platform,
  Internet-exposed APIs, application API keys, hosted CI/CD, automated
  dependency updates, automated publication, containers, or background update
  jobs.

## Capabilities

### New Capabilities

- `vietnamese-administrative-address-service`: A private Tailscale-only Go
  service backed by an immutable current-address SQLite snapshot.
- `vietnamese-address-autocomplete`: A small LIMS server-side lookup and
  autocomplete contract with manual fallback.

### Modified Capabilities

- `sample-management`: Allow analysts to use current province/commune
  suggestions while preserving the existing address field and CCCD-first flow.

## Impact

- **Service repository:** Adds retained source evidence, deterministic SQLite
  generation, a small read-only API, and a manual home-server runbook.
- **LIMS code:** Adds a server-only service client and address suggestions in
  the existing client-entry surfaces.
- **LIMS database:** No migration. The existing human-readable address remains
  the persisted value.
- **Network:** LIMS calls the service server-to-server through the home
  server's Tailscale address. The service is never exposed publicly.
- **Security and privacy:** The service stores public administrative reference
  data only. LIMS sends administrative search text only and never sends client,
  sample, CCCD, or complete free-form address records.
- **Operations:** One small manually managed home-server process. No hosted
  automation, updater, mutable database volume, or automated publication.
