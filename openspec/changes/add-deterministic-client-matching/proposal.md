## Why

Client lookup currently relies on inconsistent raw comparisons and an upsert path
that can overwrite CCCD, phone, and other identity fields when name and date of
birth match. Production also contains legacy placeholder values and duplicate
untrusted identifiers, so bulk accession cannot safely reuse clients until one
deterministic, fail-closed identity contract replaces the ambiguous behavior.

## What Changes

- Add an audited active/inactive client lifecycle that prohibits hard deletion,
  automatic revival, identity replacement, and unreviewed identity reuse.
- Define typed CCCD and CMND identifiers, accent-preserving Vietnamese name
  normalization, exact date-of-birth matching, normalized Vietnamese phone
  conflict guards, and an explicit untrusted representation for legacy values.
- Add one shared server-side resolver for client upsert, QR/manual accession,
  and later bulk-accession callers. The resolver returns stable machine outcomes
  and reason codes without merging, filling, or overwriting identity fields.
- Map resolver outcomes to clear Vietnamese user-facing labels and actionable
  messages: `Đã khớp`, `Không tìm thấy khách hàng`,
  `Không thể xác định duy nhất`, and `Xung đột thông tin`.
- Add manager-only, reason-required, audited adjudication, correction,
  deactivation, and restoration paths while analysts remain unable to override
  ambiguous or conflicting matches.
- Clean legacy placeholder and collision state with forward-only migrations,
  baseline assertions, and cleanup-gated partial uniqueness enforcement.
- Roll out resolver/RPC v2 additively with shadow comparison and
  workflow-by-workflow adoption. Preserve existing routes, scanner transports,
  request/response compatibility, CoA phone authentication, allowed profile
  edits, sample/result workflows, authorization, RLS, and audit behavior except
  for the explicit replacement of unsafe identity overwrite and hard deletion
  with fail-closed matching and audited lifecycle contracts.
- Keep workbook schema/parsing, atomic preview/confirmation/provenance, capacity
  limits, and final bulk-import partitioning outside this change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `client-management`: Replace ambiguous raw matching and hard-delete semantics
  with deterministic typed identity resolution, soft lifecycle, Vietnamese
  outcomes, cleanup gates, and audited manager adjudication.
- `sample-management`: Require existing accession callers to adopt the shared
  versioned resolver through a non-regressive additive rollout.

## Impact

- Database: forward-only client lifecycle, normalized identity representation,
  resolver/RPC v2, cleanup checkpoints, partial uniqueness, RLS, grants,
  fixed `search_path`, and immutable audit evidence.
- Application: client action schemas, client API bridge handlers, QR/manual
  accession identity lookup, upsert behavior, Vietnamese error mapping, and
  manager maintenance workflows.
- Verification: SQL security and concurrency regressions, existing accession
  regression tests, caller contract tests, shadow-comparison evidence, smoke
  tests, rollback rehearsal, and production cleanup verification.
- Compliance: no hard deletion, no silent identity mutation, manager-only
  adjudication, auditable reasons, minimized PII in errors/audit payloads, and
  fail-closed behavior under ambiguity or security/audit failures.

## Wayfinder Traceability

- Map: #107
- Source decision: #111
- Decision status: Resolved
- Promoted on: 2026-08-22
