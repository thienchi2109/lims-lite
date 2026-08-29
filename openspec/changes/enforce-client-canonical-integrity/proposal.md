## Why

Phase 6 removed the legacy `(name, date_of_birth)` uniqueness gate and
completed the deterministic resolver cutover, but canonical identity integrity
is not yet enforced as its own deploy gate. The system now needs
evidence-backed forward-only guards for trusted identity and normalized
projections so future client writes cannot reintroduce ambiguous canonical
state.

## What Changes

- Add a Gate A evidence and enforcement contract for canonical client identity:
  clean collision aggregates, reconciled projections, complete lifecycle audit
  coverage, and no successful direct legacy mutation callers.
- Validate and preserve the existing `clients_unique_trusted_government_identity`
  unique index across active and inactive clients, and define the remaining
  normalized-phone and canonical-candidate guards without treating phone or
  name/date-of-birth as a unique identity.
- Require every creation-capable caller to use the transactional resolver
  contract. The existing `upsertClient()` compatibility entry point must either
  delegate to resolver v2 or be disabled before Gate A; deleting the obsolete
  branch remains outside this change.
- Verify that hard DELETE and broad identity/lifecycle UPDATE remain denied while
  explicitly allowed profile updates continue to work for authorized callers.
- Add rollback-only SQL coverage for uniqueness, restore conflicts, concurrency,
  RLS, audit evidence, resolver outcomes, and unchanged sample/result history.
- Add a named read-only preflight and PII-free evidence artifact before any
  migration is attempted. Apply database enforcement only through the next
  forward-only migration after verifying that migration 231 is still available,
  with baseline assertions, fixed `search_path`, explicit role checks, minimal
  grants, and documented security impact.
- **BREAKING**: After the Gate A migration is applied, invalid canonical writes
  must fail closed rather than creating or preserving conflicting projections.
- Keep migration 230 immutable and treat its post-retirement state as the
  baseline. Its SHA-256 is
  `2cd5448f6be5ee19825f31b4d23e956f9ecd611bea3c2f378f1e1e9b1bbbcbcb`; do not
  restore the removed `(name, date_of_birth)` constraint.
- Keep Gate B legacy-path retirement, obsolete RPC removal, and application
  branch deletion outside this change until a separate observation-gate decision
  is approved.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `client-management`: Require post-Phase-6 canonical identity and projection
  integrity enforcement, fail-closed invalid writes, and preservation of the
  constrained profile-update and audited lifecycle contracts.

## Impact

- Database: `public.clients` canonical columns, typed identity uniqueness,
  normalized-phone/candidate guards, RLS policies, grants, audit verification,
  and a new forward-only migration 231 after the immutable migration 230
  baseline, subject to confirming no newer migration exists.
- Application: `src/app/actions/clients.ts`,
  `src/app/api/client-actions/route.ts`,
  `src/app/api/client-actions/client-resolution-shadow-handlers.ts`, and
  `src/lib/api-client.ts` must have no successful direct client-table upsert
  path at the Gate A boundary.
- Tests and operations: `tests/client-canonical-integrity-preflight.sql`,
  `tests/client-canonical-integrity-gate-migration.test.ts`,
  `tests/client-canonical-integrity-gate.test.sql`, existing resolver cutover
  and concurrency suites, `run_security_tests()`, client/accession regressions,
  production health/browser smoke, telemetry evidence, and Vietnamese outcome
  checks.
- Compliance: all mutations remain auditable, permissions remain enforced by
  Server Actions plus RLS, and no hard delete or historical sample/result
  rewrite is introduced.
- Non-scope: migration 230 edits or reapplication, restoration of legacy
  name/date-of-birth uniqueness, deleting the compatibility entry point,
  Phase 7 Gate B retirement, and unrelated bulk import/workbook behavior.
