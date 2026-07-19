## ADDED Requirements

### Requirement: Segmented LIMS conversion path
The Compose topology SHALL isolate the LIMS app, PDF gateway, and raw Gotenberg
so unrelated services cannot reach either PDF API and the LIMS app cannot
connect directly to raw Gotenberg.

#### Scenario: Client-side PDF network
- **WHEN** the Compose configuration is rendered
- **THEN** only `app` and `pdf-gateway` are attached to the PDF client bridge

#### Scenario: Upstream PDF network
- **WHEN** the Compose configuration is rendered
- **THEN** only `pdf-gateway` and `gotenberg` are attached to the PDF upstream bridge
- **THEN** `gotenberg` is not attached to the default or PDF client bridge

### Requirement: No host or tailnet exposure
The PDF gateway and Gotenberg MUST NOT publish host ports or use host networking.
The repository MUST NOT add Cloudflare Tunnel routes, Tailscale listeners,
grants, or Funnel configuration in this change.

#### Scenario: PDF services remain private
- **WHEN** the rendered service configuration is inspected
- **THEN** neither PDF service has a published port or host network mode

#### Scenario: No public or tailnet route
- **WHEN** deployment and edge configuration are inspected
- **THEN** no Tunnel, Tailscale, or Funnel route targets either PDF service

### Requirement: LIMS application authentication
The gateway SHALL require a LIMS-specific bearer credential stored through
Docker secrets and SHALL validate only its stored digest. Network access alone
MUST NOT authorize a conversion.

#### Scenario: Valid LIMS credential
- **WHEN** the LIMS app submits its valid bearer credential
- **THEN** the gateway identifies the LIMS client and evaluates its configured limits

#### Scenario: Missing or invalid credential
- **WHEN** a request has no credential, an unknown client ID, or a mismatched secret
- **THEN** the gateway rejects the request without contacting Gotenberg

#### Scenario: Invalid client policy
- **WHEN** the mounted client-policy secret is missing, malformed, empty, contains duplicate client IDs, contains a malformed digest, or has a non-positive, non-integer, or above-hard-cap limit
- **THEN** the gateway fails closed during startup

#### Scenario: Weak bearer token
- **WHEN** a presented token does not contain a valid client ID and a base64url secret segment that decodes to at least 32 bytes
- **THEN** the gateway rejects the request without contacting Gotenberg

### Requirement: Bounded gateway resources
The gateway SHALL enforce request-size, total-timeout, request rate, burst,
concurrency, queue, and upstream response-size limits before forwarding or
returning work. It MUST bound HTTP header bytes, multipart part count, per-part
header bytes, multipart delimiter scanning, aggregate configured buffer memory,
and slow uploads. Client disconnects and deadlines MUST cancel queued or
upstream work and release concurrency slots. The gateway and Gotenberg
containers MUST declare runtime resource limits.

#### Scenario: Request exceeds a configured limit
- **WHEN** a request exceeds its size, rate, concurrency, queue, or timeout limit
- **THEN** the gateway rejects or aborts it with a bounded error response
- **THEN** the gateway records the limit outcome in audit metadata

#### Scenario: Runtime resources are bounded
- **WHEN** the rendered Compose configuration is inspected
- **THEN** the gateway and Gotenberg declare CPU, memory, and process or queue boundaries
- **THEN** the gateway runs as non-root with a read-only filesystem, all capabilities dropped, and no-new-privileges enabled

#### Scenario: Client disconnects
- **WHEN** a queued, uploading, or converting client disconnects
- **THEN** the gateway cancels remaining work
- **THEN** any queue position or concurrency slot is released

### Requirement: Narrow conversion surface
The gateway SHALL expose only `POST /v1/convert/html` and SHALL proxy accepted
requests only to Gotenberg's fixed HTML-to-PDF route. It MUST allow exactly one
`index.html` file plus the explicit Phase 3 conversion fields and values. It
MUST reject unknown, missing, or duplicate multipart parts and MUST prevent
download, webhook, Chromium proxy, host-resolution, allow-list, and deny-list
overrides. It MUST NOT follow upstream redirects.

#### Scenario: Allowed conversion request
- **WHEN** the authenticated LIMS client submits a bounded multipart request to the allowed route
- **THEN** the gateway forwards it to `/forms/chromium/convert/html`
- **THEN** the request contains exactly `index.html`, `emulatedMediaType=print`, `printBackground=true`, `preferCssPageSize=true`, `skipNetworkIdleEvent=false`, `failOnResourceLoadingFailed=true`, and `failOnResourceHttpStatusCodes=[400,599]`
- **THEN** inbound credentials and Gotenberg control headers are not forwarded

#### Scenario: Disallowed route or method
- **WHEN** a client requests another route or uses a method other than `POST`
- **THEN** the gateway rejects the request without contacting Gotenberg

#### Scenario: Unexpected conversion part
- **WHEN** request headers or multipart parts are unknown, missing, duplicated, or attempt download, webhook, proxy, host-resolution, allow-list, or deny-list overrides
- **THEN** the gateway rejects the request without contacting Gotenberg

### Requirement: Private-address and outbound safeguards
Gotenberg SHALL preserve private-address denial and SHALL disable dynamic
`downloadFrom` retrieval. The outbound asset policy MUST be documented before
the upstream bridge is changed to `internal: true`.

#### Scenario: Private-address protections remain enabled
- **WHEN** the rendered Gotenberg environment and executable image configuration are inspected
- **THEN** `CHROMIUM_DENY_PRIVATE_IPS` is enabled
- **THEN** proxy and host-resolution overrides are absent
- **THEN** dynamic `downloadFrom` retrieval is disabled

#### Scenario: External asset compatibility remains explicit
- **WHEN** the PDF upstream bridge is inspected in this change
- **THEN** it is not marked `internal: true`
- **THEN** the threat model identifies embedded or uploaded assets as the preferred future contract

### Requirement: Security audit metadata
The gateway SHALL emit structured request audit events without retaining
document content, multipart filenames, credentials, credential digests, or raw
query strings. Log-controlled strings MUST be sanitized and length bounded.

#### Scenario: Authenticated request completes
- **WHEN** an authenticated request succeeds or fails after authentication
- **THEN** one JSON audit event records request ID, client ID, source IP, method, route, status, byte counts, duration, and outcome

#### Scenario: Credential is rejected
- **WHEN** authentication fails
- **THEN** the audit event contains no bearer token, authorization header, credential digest, request body, response body, or multipart filename

### Requirement: Deployment and rollback guidance
The repository SHALL provide Vietnamese instructions for secret creation,
deployment, verification, credential rotation, audit inspection, and rollback
without database changes.

#### Scenario: Operator prepares deployment
- **WHEN** an operator follows the runbook
- **THEN** it generates the LIMS secret from at least 32 bytes produced by a cryptographically secure random source
- **THEN** production credentials remain outside the repository
- **THEN** no host, Funnel, Tailscale, or Cloudflare route is introduced

#### Scenario: Operator rolls back
- **WHEN** gateway deployment must be reversed
- **THEN** the runbook restores the previous LIMS-to-Gotenberg topology without a database rollback

### Requirement: Future consumer integration instructions
The repository SHALL provide Vietnamese instructions that allow another
application team to prepare a future integration without assuming the gateway
is currently exposed through Tailscale.

#### Scenario: Consumer prepares an access request
- **WHEN** an application team reads the consumer guide
- **THEN** it can provide its authentication, throughput, payload-size, asset, and availability requirements
- **THEN** it understands that follow-up Issue #84 must add the Tailscale listener and grants

#### Scenario: Consumer prepares client code
- **WHEN** an application follows the guide
- **THEN** it has placeholder-only `curl` and Node examples for the endpoint, bearer authentication, and multipart contract
- **THEN** it can handle authentication, size, rate, queue, timeout, and upstream errors
- **THEN** it can correlate failures with the gateway request ID and rotate credentials without committing secrets
