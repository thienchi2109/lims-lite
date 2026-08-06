## Context

LIMS currently stores `clients.address` as optional free text. The client form
can receive an address from a CCCD QR scan or from manual entry, but it has no
authoritative administrative-unit lookup, structured province/commune codes, or
historical-name resolution. Results and sample detail surfaces resolve the
current client address, so this change must preserve existing behavior while
improving entry quality.

Vietnam now uses a current two-tier province-to-commune administrative model,
while real addresses and older records still contain former province, district,
ward, and commune names. The official statistical authority publishes current
lists, history, and old-to-new conversion material. The community
`thanglequoc/vietnamese-provinces-database` repository provides useful
normalized artifacts and a reproducible generation pipeline, but its current
schema is not a complete temporal lineage model.

The service is expected to support LIMS first and other internal applications
later. The user has selected a separate repository, Go, SQLite, the existing
home server, loopback and Tailscale-only access, no application API key,
operator-controlled updates, and no external update-failure notification.

This OpenSpec change is the coordinated contract stored in `lims-lite`.
Implementation of the service itself belongs in a new
`vietnamese-address-service` repository. Production operations remain on
`khoa-xn-cdc`; the `/root/lims-lite` workspace must not run or operate the
production service.

## Goals / Non-Goals

**Goals:**

- Provide one internal source of current and historical Vietnamese
  administrative-address suggestions for multiple applications.
- Keep the service independently versioned, deployable, testable, and
  replaceable without coupling consumers to its SQLite schema.
- Use a small Go HTTP process and an immutable read-only SQLite snapshot.
- Search Vietnamese names with and without diacritics, tolerate bounded typos,
  rank current canonical units before historical aliases, and preserve
  ambiguous old-to-new mappings.
- Refresh and deploy the dataset only when an operator intentionally selects a
  reviewed source revision, while retaining the previous healthy revision for
  rollback.
- Integrate LIMS through its existing server-side client-action boundary and
  preserve manual address entry during every failure mode.
- Preserve successful CCCD scanning as the fastest and highest-priority
  client-data entry path, with autocomplete acting only after scan fallback or
  explicit user normalization.
- Store structured administrative selections and dataset provenance without
  invalidating existing free-text client addresses.
- Divide implementation into reviewable, deploy-safe, independently verifiable
  PR phases across the service and LIMS repositories.

**Non-Goals:**

- A public Internet API, Cloudflare route, Tailscale Funnel, or browser-direct
  API.
- Application API keys, end-user JWT validation, or per-consumer authorization
  in the initial release.
- Runtime mutation of the production SQLite file.
- A persistent SQLite volume, database backup workflow, multi-writer state, or
  administrative editing UI.
- Street, house-number, hamlet, postal-code, geocoding, GIS, PostGIS, or
  point-in-polygon capabilities.
- Automatically rewriting existing client addresses or silently resolving
  ambiguous historical mappings.
- Redefining whether CoA and sample history use the current client address or an
  accession-time address snapshot.
- Blocking client creation or sample accession when suggestions are unavailable.

## Decisions

### Decision 1: Bootstrap an independently deployable repository

The service SHALL live in a new `vietnamese-address-service` repository with
its own OpenSpec configuration, Go module, releases, and operational runbooks.
The repository SHALL use proportional local Go checks rather than hosted CI/CD.
The LIMS repository SHALL contain only the coordinated consumer contract and
LIMS-side implementation.

This boundary prevents future applications from depending on LIMS deployment,
database credentials, RLS, or internal schema. It also allows dataset releases
to advance independently from LIMS releases.

**Alternatives considered:**

- A module backed by LIMS PostgreSQL has the lowest initial operational cost,
  but it makes LIMS the owner and runtime dependency for unrelated apps.
- A separate PostgreSQL service provides more write and operational capacity
  than this read-only dataset requires.
- A shared SQLite file or package copied into every app creates version drift
  and duplicates search behavior.

### Decision 2: Use one small Go binary and the standard HTTP stack

The service SHALL use one Go binary for configuration, health checks, metadata,
lookup, search, and legacy resolution. The initial implementation SHOULD use
the standard `net/http` stack and `database/sql` with a CGO-free SQLite driver
such as `modernc.org/sqlite`; no ORM or general-purpose web framework is
required unless implementation evidence proves a concrete need.

The process SHALL validate configuration at startup, open SQLite read-only,
verify dataset metadata and integrity before becoming ready, use bounded
request timeouts, and shut down gracefully.

**Alternatives considered:**

- Node.js would match LIMS but provides no shared-code benefit across a separate
  service and has a larger runtime surface for a small read-only API.
- A CGO SQLite driver is mature but complicates cross-compilation and minimal
  container builds without a demonstrated requirement.

### Decision 3: Package an immutable SQLite snapshot in every release

The SQLite database SHALL be generated before a release tag is selected and
stored with the versioned service checkout or another immutable release path.
Production SHALL open it read-only. The service SHALL NOT create a writable
database copy or download data during startup.

Each release SHALL identify:

- service semantic version;
- API representation version;
- dataset version and effective date;
- source identifiers or upstream release references;
- immutable raw-source artifact identifiers;
- source and generated-artifact SHA-256 checksums;
- current and historical row counts;
- build timestamp and source commit;
- source commit or tag.

Because runtime state is reproducible and immutable, rollback restores the
previous checkout and snapshot; no SQLite backup is required.

**Alternatives considered:**

- Updating one mutable SQLite file in place creates partial-update, locking,
  backup, and restart-consistency risks.
- A named volume is useful for service-owned mutable state but provides no
  benefit for this rebuildable reference dataset.

### Decision 4: Use official data as authority and the community repository as a cross-check

The builder SHALL treat official Vietnamese administrative-unit lists, history,
and old-to-new conversion artifacts as authoritative. The
`thanglequoc/vietnamese-provinces-database` artifacts SHALL be pinned and used
as a normalized secondary input and cross-check.

Every build SHALL retain immutable copies of the exact raw inputs or
content-addressed source artifacts, together with retrieval metadata,
checksums, parser/toolchain versions, and applicable source terms. A published
snapshot SHALL remain reproducible even if an upstream URL later changes or
disappears.

An update SHALL fail closed when:

- required source files are unavailable or structurally changed;
- checksums or parsing fail;
- official codes are duplicated within an active level;
- a current commune lacks a current province;
- expected source relationships cannot be represented;
- official and secondary current-unit data disagree beyond an explicitly
  reviewed allow-list;
- search fixtures or API contract tests regress.

Expected counts SHALL be versioned manifest evidence, not permanent constants.
Dataset publication SHALL never infer that today's counts can never change.
Ordinary source changes that remain within reviewed invariants MAY be prepared
for release only when a maintainer initiates the documented process. A new
source schema, unexplained relationship class, code reuse, or material semantic
disagreement SHALL fail closed until a manifest or allow-list change is reviewed
in the service repository.

### Decision 5: Model current units, aliases, and lineage explicitly

The generated SQLite schema SHALL be owned by the service and SHALL include at
least these logical records:

- `source_artifacts`: immutable raw-input references, checksums, retrieval
  metadata, parser/toolchain versions, and source terms;
- `dataset_metadata`: one active snapshot manifest and build provenance;
- `administrative_units`: stable internal identity for one continuous legal
  administrative entity;
- `administrative_unit_revisions`: immutable revision ID, unit identity,
  official code, administrative level, unit kind, names, parent revision,
  validity interval, source, and current/historical status;
- `administrative_aliases`: normalized alias, alias type, language, validity,
  source, and target revision;
- `administrative_relations`: predecessor revision, successor revision,
  relation type, effective date, source, and ambiguity metadata;
- `administrative_search`: denormalized current and historical search documents
  suitable for indexed prefix retrieval.

Current canonical addresses SHALL use province and commune-level units. Former
district names SHALL remain searchable context and lineage evidence but SHALL
NOT become a required parent in the current canonical model.

Lineage SHALL be many-to-many. `partial_merge`, split, and other ambiguous
relationships SHALL return multiple candidates and SHALL NOT be collapsed into
one guessed successor.

Official codes SHALL NOT be treated as timeless primary keys. Only one active
revision for a level/code pair may exist at a time, while historical revisions
MAY retain a reused code with distinct validity intervals and revision IDs.
Current lookup returns the active revision; legacy resolution returns all
matching historical evidence needed to disambiguate reuse.

### Decision 6: Use deterministic layered search

Search SHALL normalize case, Unicode, whitespace, punctuation, Vietnamese
diacritics, and `đ`/`d` equivalence. Ranking SHALL be deterministic:

1. exact official code;
2. exact current canonical name;
3. current canonical prefix match;
4. province-scoped current match;
5. exact or prefix historical alias;
6. bounded fuzzy fallback over a prefiltered candidate set.

SQLite FTS5 or equivalent indexed prefix retrieval SHALL produce the candidate
set for exact and prefix tiers. A generated normalized n-gram index or
equivalent bounded candidate structure SHALL provide candidates when a typo,
including an error in the first token or character, prevents a prefix match.
A bounded Go-side similarity step MAY rank those fallback candidates, but it
SHALL NOT scan the full dataset or change exact/prefix order.

Search responses SHALL identify the matched text, match type, current or
historical status, canonical path, dataset version, and successor candidates
when applicable. Current results SHALL rank before historical results unless
the query exactly matches a historical official code.

Ordering SHALL be total and reproducible. After match tier and similarity,
ties SHALL be resolved by current status, administrative level, normalized
canonical path, official code, and revision ID in a documented order. The same
request against the same service and dataset versions SHALL return the same
ordered results.

### Decision 7: Expose a narrow versioned read-only API

The initial API SHALL be versioned under `/v1` and include:

- `GET /health/live`;
- `GET /health/ready`;
- `GET /v1/meta/version`;
- `GET /v1/provinces`;
- `GET /v1/provinces/{code}/communes`;
- `GET /v1/units/{level}/{code}`;
- `GET /v1/addresses/search`;
- `GET /v1/legacy/resolve`.

List and search endpoints SHALL enforce query-length, result-limit, timeout, and
response-size bounds. Immutable responses SHOULD use representation-aware ETags
so consumers can cache safely. Error bodies SHALL use one stable structured
contract and SHALL NOT expose filesystem paths, SQL, source internals, or stack
traces.

The service SHALL not expose its SQLite schema as a consumer contract.

Cache validators SHALL include the API representation version, service version,
dataset version, route, and canonicalized request parameters. A service release
that changes ranking or representation SHALL therefore invalidate cached
responses even when the dataset is unchanged.

Within one API major version, consumers SHALL validate required known fields
and tolerate unknown additive response fields. Removing, renaming, or changing
the meaning or type of a required field requires a new API major version.

Address search accepts administrative query text only. Consumers SHALL NOT send
house numbers, street detail, organization names, complete client addresses, or
complete CCCD-scanned addresses to the service. Raw query values SHALL NOT be
recorded in LIMS, reverse-proxy, or service logs.

### Decision 8: Trust private networking without an application API key

Host-native same-host consumers MAY connect through loopback. The containerized
LIMS application and cross-host internal consumers SHALL connect to a host port
bound only to the home server's Tailscale address. The service SHALL NOT bind a
production host port on all interfaces and SHALL NOT receive a Cloudflare route.

There is no initial API key because the service contains public reference data
only and the user accepted the simpler network trust boundary. Compensating
controls SHALL include:

- server-to-server calls only;
- no permissive browser CORS;
- Tailscale ACL/firewall restrictions;
- read-only methods;
- bounded input, concurrency, and timeouts;
- metadata-only structured logs;
- resource limits and health checks.

This decision SHALL be revisited before exposing sensitive data, write
operations, or untrusted network access.

### Decision 9: Use infrequent operator-controlled updates

The service SHALL NOT poll upstream sources or deploy automatically. When an
administrative dataset update is actually needed, a maintainer SHALL:

1. select and retain the reviewed source revisions;
2. regenerate the snapshot and run deterministic dataset validation;
3. run `make verify` and the phase-specific dataset/API checks;
4. create an immutable tag or record an exact commit SHA;
5. update the home-server checkout to that exact revision;
6. build the CGO-free Go binary on the home server;
7. restart the systemd service and verify readiness, metadata, SQLite integrity,
   and representative searches.

The previous working checkout and binary SHALL remain available until the new
revision passes post-restart verification. On failure, the operator SHALL
restore the previous revision and restart the service. A brief interruption is
acceptable because autocomplete is optional and manual entry remains available.
No scheduled updater or external failure notification is required.
`/v1/meta/version` SHALL expose dataset age and revision without credentials or
internal failure details.

### Decision 10: Keep autocomplete reusable and non-blocking

LIMS SHALL call the service only from its server-side action layer and SHALL
wrap calls through `src/lib/api-client.ts` for client components. Browser code
SHALL NOT call the service's Tailscale endpoint directly.

Every same-origin address handler SHALL authenticate the current LIMS session,
authorize only roles already allowed to create or edit clients, apply
per-principal and aggregate request bounds, and reject unauthorized callers
before contacting the service. Disabled or non-allowlisted requests SHALL
produce zero upstream calls.

Production rollout SHALL use server-evaluated modes:

- `off`: no address-service request is permitted;
- `allowlist`: only explicitly configured authenticated principals may use
  autocomplete;
- `on`: all otherwise authorized client-entry principals may use it.

The allowlist SHALL remain in protected runtime configuration and SHALL NOT be
selectable or disclosed by browser code.

A shared address field SHALL separate:

- free-form detail such as house number, street, hamlet, or organization;
- administrative-only query text sent to the service;
- administrative selection from the service;
- the formatted human-readable address stored for existing consumers.

The field SHALL never derive a service query by forwarding the complete
free-form or CCCD-scanned address. The user enters or confirms an
administrative-only query, and raw query values remain excluded from LIMS,
proxy, and service logs.

The accession interaction SHALL preserve this source precedence:

1. when a supported CCCD scanner is available, the workflow offers and accepts
   scanning as the primary client-entry path while retaining an explicit manual
   entry choice;
2. a successful, validated scan auto-fills the existing client fields,
   including its address, without waiting for the address service;
3. the workflow assigns a new scan generation and visible scan-owned draft
   before starting duplicate-client lookup;
4. only duplicate lookup from the current scan generation may select an
   existing client or replace the provisional draft, and it SHALL NOT do so
   after a newer scan, form reset, explicit client selection, or user edit takes
   ownership;
5. autocomplete is used when scanning is unavailable or unsuccessful, when the
   user explicitly chooses manual entry, or when the user explicitly chooses
   to normalize/edit the scanned administrative address;
6. manual free-text entry remains available throughout.

An autocomplete response SHALL NOT race with, clear, or silently replace newer
scanner-prefilled or user-edited values. Normalizing a scanned address requires
an explicit user selection and preserves the original scanned text until the
owning LIMS mutation succeeds. Duplicate lookup SHALL use the same generation
and ownership fencing as autocomplete.

The field SHALL implement accessible combobox/listbox semantics, accessible
names, expanded and active-descendant state, loading/result/error live
announcements, Escape dismissal, and deterministic focus restoration in
addition to keyboard and mobile interaction. Current and historical result
labels, manual override, and unavailable states SHALL be Vietnamese. Timeout,
non-2xx response, invalid payload, no match, or ambiguous historical mapping
SHALL preserve manual entry and SHALL NOT block client creation or sample
accession.

Future consumers may use the same API contract without importing LIMS code.
Reusable TypeScript types may live in LIMS, but the normative contract remains
the versioned HTTP schema maintained by the service repository.

### Decision 11: Preserve LIMS address compatibility and auditability

LIMS SHALL retain `clients.address` as the formatted address snapshot consumed
by current screens and reports. A new forward-only migration SHALL add nullable
structured metadata such as:

- address detail;
- province code;
- commune-level code;
- dataset version;
- address input source (`manual`, `cccd`, or existing/imported data);
- administrative-selection source (`none`, `autocomplete`, or legacy
  resolution);
- original scanned address when normalization changes the formatted value.

Exact column names will be finalized during the LIMS schema phase, but the
semantics above are fixed. Existing rows SHALL remain valid with null structured
metadata. Manual and CCCD-only submissions SHALL remain valid without a matched
administrative code.

Client address mutations SHALL use an explicit intent:

- `preserve`: address fields are omitted and all existing address metadata
  remains unchanged;
- `manual`: formatted address and detail are replaced, structured codes and
  dataset provenance are cleared, and input source becomes manual;
- `cccd`: scanned text becomes the formatted address, incompatible structured
  selection metadata is cleared, and input source becomes CCCD;
- `structured`: formatted address, detail, codes, dataset version, and
  administrative-selection source are replaced atomically while preserving the
  originating manual or CCCD source and required original scanned text.

The server SHALL reject ambiguous partial payloads. Changing formatted address
text without `preserve` or a complete validated replacement SHALL clear or
revalidate incompatible structured metadata. Disabling autocomplete SHALL NOT
leave stale codes attached to newly edited free text.

The existing client mutation authorization, RLS, and audit trigger SHALL remain
the final controls. No service data SHALL be written into the LIMS database
outside an authenticated LIMS mutation.

This change SHALL NOT modify existing client delete policies. Current deletion
behavior is a separate compliance concern and SHALL NOT be described as
soft-delete behavior or widened by this change.

This change does not add an accession-time address snapshot to `samples`.
That provenance decision requires a separate capability because it affects
historical reports and CoA behavior beyond autocomplete.

### Decision 12: Use PR-sized cross-repository rollout phases

Implementation SHALL be split into independently reviewable phases with one
primary concern per PR. A phase SHALL have explicit prerequisites, scope
boundaries, tests, and an exit gate. Service phases SHALL deploy dark before
LIMS depends on them; LIMS integration SHALL remain feature-disabled until the
service contract and rollback path are verified.

The target is materially below 1,500 changed lines per PR. At approximately
1,000-1,200 changed lines, the implementer SHALL reassess whether the phase can
be split without weakening atomicity or reviewability. Generated SQLite data,
lockfiles, and intentionally atomic migration SQL are reported separately, but
do not justify combining unrelated production behavior.

Repository bootstrap and runtime hardening, historical ingestion and search,
manual release preparation and home-server deployment, LIMS network wiring and
adapter logic, and reusable field and accession integration SHALL be separate
PRs from the outset. The LIMS migration PR SHALL merge before its committed SQL
is applied to a persistent database, and the apply gate SHALL verify the exact
merged SHA before execution.

## Risks / Trade-offs

- **Upstream data can be wrong or structurally changed** → Validate
  against official and secondary sources, retain immutable raw inputs, require
  deterministic invariants and regression fixtures, and require a reviewed
  manifest change for material semantic drift.
- **No external alert can leave the active dataset stale** → Expose dataset age
  through metadata, retain release and operations logs, and document a periodic
  operational check; this is an accepted user-selected trade-off.
- **No API key trusts every permitted network peer** → Restrict loopback and
  Tailscale access, firewall bindings, methods, request bounds, and CORS; add
  application authentication before widening the trust boundary.
- **Historical conversion is sometimes ambiguous** → Preserve many-to-many
  relations and require consumer/user selection instead of guessing.
- **Service unavailability reduces entry speed** → Keep manual entry first-class,
  use short timeouts, and never make service readiness an accession prerequisite.
- **Autocomplete can regress the established scanner-first workflow** → Preserve
  scanner source precedence, avoid a service call on the successful scan path,
  establish scan-owned state before duplicate lookup, fence both lookup and
  autocomplete responses, and add focused scanner/autofill race tests before
  enabling the feature.
- **LIMS can become a public proxy to a private service** → Authenticate,
  authorize, rate-bound, and feature-gate every same-origin address action
  before any upstream request.
- **Full client addresses can leak through search URLs or logs** → Send only
  administrative query text and prohibit raw query logging at every layer.
- **Separate repositories create coordinated release work** → Version the HTTP
  contract, add consumer contract tests, and stage service changes before LIMS
  changes.
- **A manual build can use the wrong revision** → Require a clean checkout at an
  approved exact tag or commit, verify release evidence before build, and record
  the installed revision.
- **Deployment interruption can leave the active revision uncertain** → Keep the
  previous checkout and binary until verification passes, then use the runbook
  to finish the selected deployment or restore the previous revision.
- **Structured client fields can drift from free text** → Compose both in one
  intent-discriminated audited mutation and test preserve, clear, CCCD,
  structured, rollback-disabled, and contradictory metadata cases.
- **Tailscale binding may be misconfigured as public binding** → Add systemd
  configuration and deployment checks that reject wildcard host publication and
  Cloudflare routes.

## Migration Plan

1. Approve this coordinated OpenSpec contract without changing runtime behavior.
2. Bootstrap the separate service repository, then add runtime hardening in a
   separate PR.
3. Add the deterministic current dataset builder and immutable raw-source
   evidence.
4. Add historical revision/lineage ingestion, then deterministic search in a
   separate PR.
5. Add the versioned API and consumer compatibility tests.
6. Add manual release preparation and retained evidence, then add the
   home-server checkout, build, systemd, verification, and rollback runbook in a
   separate PR.
7. Deploy the service dark on the home server and verify private reachability,
   exact source revision, release checksums, service resources, interruption
   recovery, and manual rollback.
8. Add nullable structured client-address fields and intent semantics to LIMS
   in a forward-only migration PR without applying it to a persistent database.
9. Merge the migration PR, update `/opt/lims-lite` to the exact merged SHA, apply
   the committed migration through the approved Docker PostgreSQL path, run
   `run_security_tests()`, and verify existing rows, RLS, audit, and checksum.
10. Reconcile or archive the two active scanner OpenSpec changes.
11. Add LIMS private-network wiring and server configuration with rollout mode
    `off`, then add the authenticated service adapter in a separate PR.
12. Add the reusable address field/state machine, then integrate client
    creation/editing and scanner-first accession in a separate PR.
13. Enable `allowlist` for controlled principals, verify security, audit,
    scanner/lookup races, PII boundaries, and fallback behavior, then switch to
    `on`.
14. Future applications integrate against `/v1` without direct SQLite or LIMS
    database access.

Rollback never rewrites an applied LIMS migration. LIMS feature rollback disables
autocomplete and retains manual entry plus nullable structured columns. Service
rollback restores the previous checkout, binary, and immutable dataset snapshot.

## Open Questions

- Select the exact loopback and Tailscale bind addresses and host port during
  home-server deployment preparation.
- Select the systemd unit name, service user, install paths, and bounded release
  retention policy.
- Select the immutable raw-source artifact store and retention period.
- Finalize the LIMS structured-address column names after reviewing all current
  client query and CoA projections.
- Resolve whether the current client DELETE policy requires a separate
  compliance change; this proposal does not alter or endorse that behavior.
