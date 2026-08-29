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
  coverage, and no authoritative legacy mutation callers.
- Validate and enforce trusted typed CCCD/CMND uniqueness across active and
  inactive clients, plus remaining normalized-phone and canonical candidate
  integrity guards without treating name/date-of-birth as a unique identity.
- Verify that hard DELETE and broad identity/lifecycle UPDATE remain denied while
  explicitly allowed profile updates continue to work for authorized callers.
- Add rollback-only SQL coverage for uniqueness, restore conflicts, concurrency,
  RLS, audit evidence, resolver outcomes, and unchanged sample/result history.
- Apply any database enforcement only through a new forward-only migration with
  baseline assertions, fixed `search_path`, explicit role checks, minimal
  grants, and documented security impact.
- **BREAKING**: After the Gate A migration is applied, invalid canonical writes
  must fail closed rather than creating or preserving conflicting projections.
- Keep migration 230 immutable and treat its post-retirement state as the
  baseline; do not restore the removed `(name, date_of_birth)` constraint.
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
  and a new forward-only migration after the immutable migration 230 baseline.
- Application: client create/update/lifecycle paths and resolver adapters may
  need contract tests or narrowly scoped changes if Gate A evidence identifies
  a remaining legacy mutation caller.
- Tests and operations: rollback-only SQL suites, `run_security_tests()`,
  client/accession regressions, production health/browser smoke, telemetry
  evidence, and Vietnamese outcome checks.
- Compliance: all mutations remain auditable, permissions remain enforced by
  Server Actions plus RLS, and no hard delete or historical sample/result
  rewrite is introduced.
- Non-scope: migration 230 edits or reapplication, restoration of legacy
  name/date-of-birth uniqueness, Phase 7 Gate B retirement, and unrelated bulk
  import/workbook behavior.
