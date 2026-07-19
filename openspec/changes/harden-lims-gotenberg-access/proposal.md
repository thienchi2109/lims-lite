## Why

Gotenberg is not published on the host, but it still shares the default Compose
network and exposes an unauthenticated conversion API to every sibling service.
The current need is to harden the LIMS conversion path before enabling any
cross-application or Tailscale access.

## What Changes

- Isolate the LIMS app, PDF gateway, and Gotenberg across dedicated client and
  upstream Docker bridges so unrelated services cannot reach either PDF API and
  the LIMS app cannot bypass the gateway to raw Gotenberg.
- Keep both the gateway and Gotenberg without host ports, host networking,
  Cloudflare routes, Tailscale exposure, or Funnel.
- Require a LIMS-specific bearer credential stored in Docker secrets rather
  than environment variables or the repository.
- Add request-size, timeout, rate, concurrency, and bounded queue limits.
- Restrict the gateway to the required HTML-to-PDF route and reject Gotenberg
  download, webhook, Chromium proxy, and host-resolution overrides.
- Emit security-focused JSON audit events without request bodies, document
  contents, filenames, or credentials.
- Preserve private-address protections and document the outbound asset policy.
- Add characterization, unit, and configuration tests plus Vietnamese
  deployment, rollback, and future-consumer integration instructions.
- Defer Tailscale publication, ACL/grants, credential issuance for a second app,
  and live cross-host validation to follow-up Issue #84, after a real consumer
  is confirmed.

## Capabilities

### New Capabilities

- `shared-pdf-conversion-gateway`: A private, authenticated, resource-bounded,
  and auditable LIMS-to-Gotenberg gateway that can be extended later for
  authorized tailnet consumers.

### Modified Capabilities

None.

## Impact

- Affects `docker-compose.yml`, `.env.example`, `ops/gotenberg/`, a new
  `ops/pdf-gateway/` service, infrastructure tests, and security/runbook and
  consumer integration documentation.
- Adds no UI, database, migration, RLS, or Phase 3 CoA behavior changes.
- Does not deploy, start containers, modify the production tailnet policy, or
  provision real credentials in this change.
