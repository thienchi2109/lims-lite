## Context

Migration 230 is the immutable Phase 6 boundary. It removed the legacy
`clients_unique_identity` constraint without rewriting rows, revoked direct
authenticated updates to identity columns, and preserved the deterministic
resolver, audited lifecycle RPCs, profile updates, RLS, and sample name
snapshots.

The remaining Phase 7 work is a separate Gate A: prove that canonical client
state is clean and that all authoritative callers use the guarded contracts,
then add integrity enforcement. Gate B legacy-path retirement must remain
independently deferrable until a post-enforcement observation window is
complete.

## Goals / Non-Goals

**Goals:**

- Establish a reproducible pre-migration evidence gate for collisions,
  canonical projection drift, lifecycle audit coverage, grants, policies, and
  remaining legacy mutation callers.
- Enforce trusted typed CCCD/CMND uniqueness and the approved normalized-phone
  and canonical candidate invariants without restoring name/date-of-birth
  uniqueness.
- Preserve fail-closed resolver outcomes, authorized profile-only updates,
  audited manager lifecycle/correction behavior, RLS, and historical
  sample/result truth.
- Provide rollback-only SQL coverage and a forward-only database rollback
  rehearsal.

**Non-Goals:**

- Editing, reapplying, renaming, or restoring migration 230.
- Deleting, merging, relinking, or rewriting existing client, sample, result,
  or audit rows.
- Retiring legacy application branches or obsolete RPC grants. Those actions
  require a later observation-gated proposal.
- Bulk workbook parsing, import partitioning, scanner transport, or unrelated
  client search behavior.

## Decisions

### Use a two-stage Gate A

First run read-only aggregate and code-search assertions against the exact
post-230 baseline. Only a clean result permits the enforcement migration to be
applied. This makes the irreversible identity model observable and reviewable
before constraints can reject writes.

Alternative rejected: applying constraints first and discovering unresolved
collisions afterward. That would make remediation harder and could force
unsafe data changes.

### Enforce typed identity, not name/date-of-birth

Use the existing typed government-identity classification and canonical
projection functions as the source of truth. Uniqueness must distinguish
trusted typed CCCD/CMND values and must not treat a shared Vietnamese name and
date of birth as proof of identity.

Alternative rejected: restoring `UNIQUE (name, date_of_birth)`, because valid
distinct people may now share those fields after migration 230.

### Prefer database-maintained guards

Canonical projections and uniqueness are protected in the database, with
baseline assertions, minimal grants, fixed `search_path`, explicit role checks,
and auditable mutation paths. Application validation remains useful for
localized feedback but is not the integrity boundary.

Alternative rejected: client-only validation, which cannot protect concurrent
callers or direct SQL paths allowed by the database contract.

### Keep Gate B separate

The enforcement proposal records evidence and adds the Gate A contract only.
Successful observation after deployment is a prerequisite for a later proposal
that removes proven-unused legacy branches or RPC grants.

Alternative rejected: combining enforcement and retirement in one deployment,
which would make rollback and regression attribution ambiguous.

## Risks / Trade-offs

- [Risk] Existing unresolved collisions block the migration. → Produce
  non-PII aggregate evidence and require adjudication or an explicit reviewed
  exception before implementation proceeds.
- [Risk] A concurrent create or restore can race with a uniqueness guard. →
  Cover sorted locking, constraint failures, retry behavior, and atomic
  resolver outcomes in rollback-only SQL tests.
- [Risk] A policy or grant change can widen access accidentally. → Use
  `DROP POLICY IF EXISTS`, explicit role checks, fixed `search_path`, minimal
  grants, and `run_security_tests()` in the deployment checklist.
- [Risk] Legacy callers remain hidden behind adapters. → Combine static code
  search, runtime telemetry, aggregate evidence, and focused browser smoke
  before applying enforcement.

## Migration Plan

1. Review and approve this proposal, design, delta spec, and implementation
   tasks.
2. Add failing SQL/application tests for Gate A evidence and the intended
   integrity contract.
3. Implement and review one new forward-only migration with exact baseline
   assertions. Do not edit or rerun migration 230.
4. Run rollback-only SQL coverage, `run_security_tests()`, focused
   client/accession regressions, typecheck, lint, React Doctor, health checks,
   browser smoke, and Vietnamese outcome checks.
5. Apply only the committed migration in the approved Docker environment and
   verify catalog, grants, policies, audit evidence, and unchanged history.
6. Observe production usage for the agreed window. Open a separate Gate B
   proposal only after the observation evidence proves legacy paths unused.

Before Gate A enforcement, rollback disables only application selection or
adapter behavior and leaves additive schema in place. After the new guard is
applied, recovery uses a new forward-only migration; migration 230 remains
immutable and the removed name/date-of-birth constraint is never restored.

## Open Questions

- Which exact observation window and telemetry retention period will reviewers
  approve for the later Gate B proposal?
- Are any normalized-phone or trusted typed-identity exceptions still present
  in the post-230 database baseline?
- Which next migration number is available at implementation time after the
  current repository and approved deployment checkout are compared?
