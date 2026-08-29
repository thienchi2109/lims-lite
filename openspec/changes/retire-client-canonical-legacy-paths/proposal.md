## Why

Gate A is complete on `main` at commit `b9e0247`, and migration 231 is
applied. The canonical resolver contract is now enforced, but compatibility
entry points, shadow telemetry, and legacy database objects remain by design.
They need a separate, evidence-gated retirement so that unused paths can be
removed without confusing rollout rollback with irreversible cleanup.

The current evidence does not authorize retirement yet: migration 231 was
applied at `2026-08-29 09:03:33 UTC`, while the latest shadow event is
`2026-08-28 08:57:02 UTC`; the running `lims-app` image was created on
`2026-08-23`, before Gate A reached `main`.

## What Changes

- Define and review a post-Gate-A observation window before any compatibility
  path or legacy RPC is removed. The proposal is for seven complete UTC days,
  starting only after a healthy deployment of a revision at or after
  `b9e0247`.
- Record PII-free telemetry aggregates, static caller search, runtime image
  identity, feature flags, migration hashes, and normal client/accession
  activity in a committed evidence artifact.
- Retire only the application compatibility branches, shadow adapter, obsolete
  RPC contracts, and grants proven unused by the approved evidence.
- Add regression tests before production code or SQL changes. Preserve direct
  v2 resolver behavior, Vietnamese error mapping, RLS, auditability, sample
  history, and the fail-closed legacy-upsert switch.
- Use a new forward-only migration for any database retirement. Migration 230
  and migration 231 remain immutable and are never reapplied.
- **BREAKING**: callers that still depend on the compatibility action names or
  obsolete RPC contracts will have to move to the reviewed v2 contracts before
  retirement is approved.

## Capabilities

### New Capabilities

- `client-legacy-retirement`: Observation-gated retirement of proven-unused
  client compatibility paths and obsolete database contracts.

### Modified Capabilities

None. Gate B adds a retirement contract; it does not rewrite the existing
client-management requirements.

## Impact

- Application surfaces: `src/app/api/client-actions/route.ts`,
  `src/app/api/client-actions/client-resolution-shadow-handlers.ts`,
  `src/lib/client-resolution/cutover.ts`,
  `src/lib/client-resolution/shadow.ts`, `src/lib/api-client.ts`, and their
  client form/selector callers.
- Database surfaces: the shadow telemetry table and RPC, resolver helper
  functions, exact function ACLs, and any new forward-only migration selected
  only after implementation-time baseline checks.
- Verification: focused Vitest/API boundary tests, SQL regression and security
  suites through the approved home-server Docker/psql path, typecheck, lint,
  React Doctor, strict OpenSpec validation, health checks, and browser smoke.
- Compliance: no hard delete, client merge, UUID replacement, sample/result
  relink, historical rewrite, audit bypass, or RLS weakening is permitted.
