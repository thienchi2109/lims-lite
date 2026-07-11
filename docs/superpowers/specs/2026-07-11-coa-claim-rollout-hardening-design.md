# CoA Claim Rollout Hardening Design

## Scope

Resolve GitHub Issues #74 and #75 without modifying applied migrations
`171-188`. The work stays on `feat/result-review-coa-draft-phase-4`, with one
commit per issue. The branch is pushed but no pull request is created and
`main` is not merged.

## Deployment Boundaries

Issue #74 protects databases still on schema 170. These databases may contain
legacy `coa_reports.status = 'pending'` rows without generation claim metadata,
so migration 171 cannot add its claim-state constraint. A read-only preflight
must detect those rows before migration 171 runs. The remediation runbook must
preserve artifacts and provenance, record an approved operator identity, and
capture before/after evidence.

Issue #75 protects databases that have started or completed the claim rollout.
A strict validator must fail closed when the four claim columns, constraints,
identity trigger, queue function contract, grants, or pending-row invariants
have drifted. A new forward-only migration validates the current baseline
before later schema changes proceed.

## Components

### Pre-deploy validator

`scripts/coa-claim-rollout-preflight.sql` is read-only and supports two valid
states:

- Schema 170: no claim columns. It succeeds only when no legacy pending report
  exists. Every pending row blocks migration 171; active versus stale
  classification happens only during remediation.
- Claim schema: all four claim columns exist with their exact types and
  nullability. It separately validates the claim foreign key, state check
  constraint, the immutable identity trigger's table, timing, events, enabled
  state and trigger function, the queue function's exhaustive behavior-bearing
  contract and security settings, exact execute grants, and both pending and
  non-pending row invariants.

Any partial state fails with an actionable exception.

Delivery is staged. Issue #74 implements the schema-170 pending-row gate and
partial-column rejection; when all four claim columns exist it reports that the
claim rollout has started. Issue #75 extends the same script with the strict
claim-schema validation described above.

### Legacy remediation runbook

`docs/coa-claim-rollout-remediation.md` provides Docker-only commands for:

- backup and dry-run evidence;
- classifying active versus stale pending generation;
- escalating active work instead of changing it;
- marking approved stale work as failed with a reason;
- setting `request.jwt.claim.sub` so the existing audit trigger records the
  approved operator;
- verifying artifact/provenance preservation, audit evidence, and security
  tests.

The runbook does not provide an automatic bulk mutation.

`scripts/coa-legacy-pending-remediation.sql` is an operator-driven,
single-report transaction template. It requires explicit report, operator, and
reason variables; sets the JWT subject for audit attribution; locks and
revalidates the target row; preserves artifact and provenance fields; and
changes only stale approved work from pending to failed. Active generation
must be escalated and cannot use this template.

### Forward-only validation

`189_validate_coa_claim_baseline.sql` validates the claim baseline in a `DO`
block before committing. It makes no corrective schema or data changes.
Actionable exceptions identify the missing or drifted contract element.

Migration 189 is reviewed, committed, rebased, tested, and pushed before the
exact pushed bytes are applied to the persistent local database. Once applied,
its hash is recorded and any defect must be corrected by migration 190 or
later.

## Testing

Issue #74 uses Docker-backed regressions that run the preflight and
single-report remediation template against transactional schema-170
simulations. They prove every legacy pending row blocks rollout and that
remediation records the operator, target row, old/new state and reason while
preserving artifact and provenance fields.

Issue #75 uses disposable databases cloned from the local Docker baseline. Each
case first proves the migration-172 generation-claim-only preflight accepts the
drift, then applies migration 189 and expects a specific failure. The matrix
covers each claim column definition and partial-column combination, the FK,
state constraint, the trigger's complete attachment definition, the queue
function's exhaustive behavior-bearing contract/security settings, grants, and
malformed rows. The valid baseline must accept migration 189 and continue to
pass `run_security_tests()`.

Disposable databases are created and dropped through
`docker exec ... lims-postgres psql`. Test cleanup drops every temporary
database even after assertion failures.

Runbook rollback means transaction rollback before an approved remediation is
committed. After commit, corrections are forward-only and auditable; operators
must not restore pending state, delete audit evidence, or rewrite history.

## Commit Boundaries

1. `chore: Add legacy CoA pending remediation runbook (#74)`
2. `chore: Enforce CoA claim baseline validation (#75)`
