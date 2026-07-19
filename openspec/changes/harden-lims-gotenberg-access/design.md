## Context

The current Compose stack runs Gotenberg without published ports, but
Gotenberg and every sibling service share the default bridge. The LIMS app is
configured with `GOTENBERG_URL=http://gotenberg:3000`; Phase 3 conversion
behavior has not been implemented and is outside this change.

There is no confirmed second application consuming PDF conversion. The secure
sequence is therefore to harden the LIMS path now and defer any host or
Tailscale exposure until a real consumer provides authentication, throughput,
payload-size, asset, and availability requirements.

The source workspace may edit and validate configuration, but it must not start
containers, operate the production tailnet, deploy, or provision real secrets.

## Goals / Non-Goals

**Goals:**

- Prevent unrelated Compose services from reaching the PDF gateway or raw
  Gotenberg.
- Prevent the LIMS app from bypassing the gateway to raw Gotenberg.
- Require a LIMS-specific credential before accepting conversion work.
- Enforce route, method, request, rate, queue, concurrency, timeout, and
  container resource boundaries.
- Produce security audit metadata without retaining documents or credentials.
- Provide tests, a Vietnamese operations runbook, and a Vietnamese future
  consumer guide.

**Non-Goals:**

- Publishing the gateway on loopback, LAN, Tailscale, or the public Internet.
- Applying tailnet tags, ACLs, or grants.
- Onboarding or validating a second consumer.
- Deploying or starting Docker services.
- Database, migration, RLS, UI, Cloudflare Tunnel, Funnel, or Phase 3 CoA work.

## Decisions

### 1. Split the PDF path across two dedicated bridges

`app` joins the existing default network plus `pdf-client`. `pdf-gateway` joins
`pdf-client` and `pdf-upstream`. `gotenberg` joins only `pdf-upstream`.

This topology prevents default-network siblings from reaching either PDF
service and prevents the LIMS app from resolving or connecting directly to
Gotenberg. A single shared PDF bridge was rejected because the app could bypass
gateway authentication and limits.

### 2. Keep the gateway fully private

Neither `pdf-gateway` nor `gotenberg` publishes a host port. No host networking,
Cloudflare route, Tailscale binding, `tailscale serve`, or Funnel configuration
is added.

Tailscale access and grants are tracked in Issue #84 and are triggered by a
confirmed consumer. The consumer guide documents prerequisites without implying
that access is currently enabled.

### 3. Use a small dependency-free Node gateway

The gateway uses Node's HTTP, crypto, and fetch APIs. It accepts only
`POST /v1/convert/html`, validates a bounded multipart body, and proxies it to
the fixed upstream path `/forms/chromium/convert/html`.

A generic reverse proxy was rejected because request-body option validation,
credential-aware limits, bounded queueing, and safe audit metadata would
otherwise require extra modules or expose a broader proxy surface.

### 4. Store client policy and the LIMS token in Docker secrets

The LIMS bearer token uses `<client-id>.<secret>`. The gateway's mounted JSON
policy stores only the SHA-256 digest of the complete token plus request-size,
response-size, timeout, rate, burst, concurrency, and queue limits. The secret
portion is base64url without padding and must decode to at least 32 bytes. The
runbook generates those bytes with a cryptographically secure random source.
The LIMS app receives the plaintext token through a separate mounted secret
file for the future server-only conversion client.

Authentication compares fixed-length digest buffers with a timing-safe
comparison. The gateway fails closed when policy is missing, malformed, empty,
contains duplicate client IDs, has a malformed digest, or configures a
non-integer, non-positive, or above-hard-cap limit. Credentials and digests are
not committed.

### 5. Bound work before reading or proxying documents

Authentication and rate checks happen before request-body ingestion. A client
must acquire a concurrency slot or a bounded queue position. The gateway rejects
oversized declared or streamed bodies and applies one deadline across queue
wait, upload, conversion, and response. It also caps HTTP header bytes,
multipart part count, per-part header bytes, and streamed upstream response
bytes. Multipart boundaries are scanned with a delimiter cap rather than an
unbounded split. Client disconnects and deadlines abort upstream work, remove
queued requests, and release concurrency slots.

Policy validation also rejects configurations whose aggregate worst-case
request and response buffers exceed 128 MiB across all configured clients. This
leaves headroom inside the gateway's 256 MiB container limit for Node, multipart
parsing, socket buffers, and audit metadata.

The gateway container has Compose CPU, memory, PID, read-only filesystem,
capability, and no-new-privileges limits. Gotenberg retains its existing
resource limits and gains explicit Chromium concurrency and queue limits.

### 6. Expose a narrow conversion contract

The gateway rejects non-multipart bodies, all routes except the versioned HTML
conversion route, and all methods except `POST`. It forwards only content type,
content length, and a generated request ID, so inbound authorization, webhook,
download, proxy, and other Gotenberg control headers cannot reach upstream.
It also disables redirect following so Gotenberg cannot redirect an accepted
conversion request outside the fixed upstream endpoint.

The multipart contract is an allow-list: exactly one `files` part named
`index.html`, plus one occurrence of each Phase 3 conversion field
`emulatedMediaType=print`, `printBackground=true`,
`preferCssPageSize=true`, `skipNetworkIdleEvent=false`,
`failOnResourceLoadingFailed=true`, and
`failOnResourceHttpStatusCodes=[400,599]`. Unknown, missing, or duplicate parts
are rejected. Global Chromium proxy, host-resolver, allow-list, and deny-list
settings remain Compose-level prohibitions rather than request fields.
Gotenberg also keeps `CHROMIUM_DENY_PRIVATE_IPS=true` and disables the
`downloadFrom` feature.

### 7. Keep the upstream bridge non-internal until assets are characterized

`pdf-upstream` is not marked `internal: true`. Future HTML may reference public
logos or QR assets, and no real consumer asset model is confirmed. Embedded or
uploaded assets are the preferred future contract; changing the bridge to
`internal: true` remains a later hardening step after compatibility is proven.

### 8. Log metadata only

Each completed or rejected request emits one JSON line with timestamp, request
ID, client ID when authenticated, source IP, route, method, status, request and
response byte counts, duration, and outcome. The gateway never logs request
bodies, response bodies, authorization headers, tokens, token digests, or
multipart filenames. Route values are canonical identifiers without query
strings, and all log-controlled strings are sanitized and length bounded.

### 9. Publish future-consumer instructions without enabling access

`docs/security/pdf-gateway-consumer-guide.md` documents the information an app
team must provide, the future Tailscale tag and grant prerequisites, bearer
token handling, endpoint and multipart contract, examples, response handling,
request-ID correlation, and rotation. It explicitly states that the gateway has
no host or Tailscale listener until a separate reviewed change enables one.

## Risks / Trade-offs

- [A compromised LIMS app can submit malicious HTML] -> Keep private-address
  denial, disable `downloadFrom`, reject proxy and webhook overrides, and bound
  gateway and Chromium resources.
- [Bearer tokens can be read by a compromised LIMS container] -> Mount a unique
  token as a read-only secret, avoid logs and environment variables, and
  document rotation.
- [In-memory request buffering consumes gateway memory] -> Enforce size limits
  before and during reads, cap concurrency and queue depth, and set a container
  memory limit.
- [The non-internal upstream bridge permits Gotenberg Internet egress] -> Deny
  private destinations and dynamic download controls now; revisit
  `internal: true` after asset requirements are confirmed.
- [No live conversion exists yet] -> Characterize the infrastructure and gateway
  contract now; Phase 3 must consume the secret-backed gateway rather than raw
  Gotenberg.

## Migration Plan

1. Create the gateway client-policy secret and matching LIMS token outside the
   repository.
2. Render and inspect Compose without starting services.
3. Deploy through the normal home-server workflow in a later session.
4. Recreate only `app`, `pdf-gateway`, and `gotenberg`.
5. Verify network membership, absence of host ports, authentication failures,
   limits, successful LIMS conversion, and audit metadata.

Rollback removes `pdf-gateway`, restores `app` and `gotenberg` to the default
network, restores the prior `GOTENBERG_URL`, and recreates only affected
services. No data or database rollback is required.

## Open Questions

- Which application will be the first remote consumer?
- What sustained and burst rate, maximum payload, timeout, and availability
  target will it require for Issue #84?
- Are all future logos and QR assets uploaded or embedded, allowing
  `pdf-upstream` to become `internal: true`?
