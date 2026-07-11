# CoA Claim Rollout Hardening Implementation Plan

> **For agentic workers:** REQUIRED: Use
> superpowers:subagent-driven-development (if subagents are available) or
> superpowers:executing-plans to implement this plan. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Prevent legacy pending CoA rows and partial claim schemas from
blocking or silently weakening the CoA claim rollout.

**Architecture:** Issue #74 adds the schema-170 checks and partial-column
rejection to a read-only pre-deploy SQL script. Issue #75 extends that script
for strict post-171 validation, while migration 189 independently fails closed
on drifted post-171 baselines. A compliance runbook defines approved data
remediation for schema 170.

**Tech Stack:** PostgreSQL/PLpgSQL, Node.js test runner, self-hosted Supabase in
Docker, Markdown runbooks.

---

## Chunk 1: Issue #74 Legacy Pending Remediation

### Task 1: Lock schema-170 preflight behavior

**Files:**
- Create: `tests/coa-claim-rollout-preflight.test.mjs`
- Create: `scripts/coa-claim-rollout-preflight.sql`

- [ ] Write a Node regression that loads the preflight script and runs it
  through `docker exec ... lims-postgres psql`.
- [ ] Simulate schema 170 inside a transaction by hiding all four claim columns.
- [ ] Verify a clean schema-170 state passes.
- [ ] Add any legacy pending report and verify preflight exits non-zero with an
  actionable remediation message.
- [ ] Run
  `node --test tests/coa-claim-rollout-preflight.test.mjs` and confirm RED
  because the preflight script does not exist.
- [ ] Implement the minimal read-only schema-170 checks.
- [ ] Re-run the focused test and confirm GREEN.

### Task 2: Lock auditable remediation

**Files:**
- Modify: `tests/coa-claim-rollout-preflight.test.mjs`
- Create: `scripts/coa-legacy-pending-remediation.sql`
- Create: `docs/coa-claim-rollout-remediation.md`

- [ ] Add a Docker-backed regression that creates a transactional schema-170
  simulation and invokes the remediation template.
- [ ] Assert the audit row contains the operator, target report, old pending
  state, new failed state, and approved failure reason.
- [ ] Assert file path, file hash, source submission, sample, and version remain
  unchanged.
- [ ] Run the focused Node regression and confirm RED because the remediation
  template does not exist.
- [ ] Implement the minimal single-report transaction template with explicit
  report ID, operator ID, and reason variables.
- [ ] Write the runbook with backup, dry-run, classification, escalation,
  remediation, transaction rollback, forward-only post-commit correction,
  before/after evidence, and `run_security_tests()`.
- [ ] Re-run the regression and focused preflight test.
- [ ] Run
  `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`.
- [ ] Commit:
  `chore: Add legacy CoA pending remediation runbook (#74)`.

## Chunk 2: Issue #75 Strict Claim Baseline

### Task 3: Lock drift detection

**Files:**
- Modify: `tests/coa-claim-rollout-preflight.test.mjs`
- Create: `supabase/migrations/189_validate_coa_claim_baseline.sql`

- [ ] Add disposable-database cases for a missing claim column, state
  constraint, identity trigger, queue function grant, queue function
  definition/search path, and malformed pending row.
- [ ] Cover all four claim column definitions, a partial baseline containing
  only `generation_claim_id`, the claim FK, check constraint, trigger enabled
  state, table, timing, events and function, queue
  `SECURITY DEFINER`/`search_path` plus its exhaustive behavior-bearing
  contract, authenticated grant, anon/service-role revocation, malformed
  pending rows, and non-pending rows retaining claim metadata.
- [ ] For each migration-172 gap, first run the legacy
  generation-claim-only check and prove it incorrectly accepts the drift.
- [ ] Add a valid-baseline case that applies migration 189 successfully.
- [ ] Run the focused Node regression and confirm each negative case lacks a
  strict validator or is incorrectly accepted.
- [ ] Implement migration 189 as validation-only, with one actionable exception
  per contract element.
- [ ] Extend the pre-deploy script with the same post-171 checks.
- [ ] Re-run the focused Node regression and confirm GREEN.

### Task 4: Verify and land

- [ ] Run the existing CoA claim, provenance, confidentiality, and wall-clock
  SQL regressions.
- [ ] Run `npm run typecheck`.
- [ ] Review migration `171-188` hashes and verify they are unchanged.
- [ ] Commit:
  `chore: Enforce CoA claim baseline validation (#75)`.
- [ ] Request code review and resolve Critical or Important findings.
- [ ] Amend review corrections into the #75 commit instead of creating fixup
  commits.
- [ ] Verify exactly two new commits exist after the starting SHA: one for #74
  and one for #75.
- [ ] Pull with rebase before persistent application and resolve any conflicts.
- [ ] Re-run focused tests and migration `171-188` hash checks after rebase.
- [ ] Push `feat/result-review-coa-draft-phase-4`, verify it is up to date, and
  verify local and remote migration 189 hashes match.
- [ ] Apply the exact pushed migration 189 to the persistent local Docker
  database using `docker exec -i lims-postgres psql`.
- [ ] Record the applied migration 189 hash. Any later correction must use
  migration 190 or higher.
- [ ] Run
  `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`.
- [ ] Re-run the focused regressions after persistent application.
- [ ] Update both issues with verification evidence.
- [ ] Do not create a pull request and do not merge `main`.
