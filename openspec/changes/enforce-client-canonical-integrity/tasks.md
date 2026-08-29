## 1. Baseline Evidence

- [ ] 1.1 Add failing SQL/application tests for unresolved typed-identity
  collisions, canonical projection drift, lifecycle audit coverage, grants,
  policies, and authoritative legacy mutation callers.
- [ ] 1.2 Capture non-PII aggregate evidence for active/inactive clients,
  trusted CCCD/CMND values, normalized phones, canonical candidates, and
  projection reconciliation.
- [ ] 1.3 Verify the exact post-230 catalog baseline and record migration 230's
  immutable checksum without editing or reapplying that migration.

## 2. Gate A Database Enforcement

- [ ] 2.1 Implement the smallest forward-only migration that asserts the
  approved baseline before changing database integrity behavior.
- [ ] 2.2 Add trusted typed CCCD/CMND uniqueness and approved normalized-phone
  and canonical candidate guards without restoring name/date-of-birth
  uniqueness.
- [ ] 2.3 Verify RLS policies, explicit role checks, fixed `search_path`,
  minimal grants, profile-only updates, hard-delete denial, and audited
  lifecycle/correction paths.
- [ ] 2.4 Add deterministic failure handling for conflicting create, restore,
  correction, and concurrent writes without partial history changes.

## 3. Verification And Deployment

- [ ] 3.1 Add rollback-only SQL coverage for uniqueness, restore conflicts,
  concurrency, RLS, audit evidence, resolver outcomes, and unchanged
  sample/result history.
- [ ] 3.2 Run `run_security_tests()` and focused client/accession plus
  immediate-blast-radius regressions against the approved Docker database.
- [ ] 3.3 Run typecheck, lint, React Doctor, production health, browser smoke,
  Vietnamese outcome checks, catalog/grant/policy verification, and the
  forward-only rollback rehearsal.
- [ ] 3.4 Apply only the committed migration in the approved deployment
  environment and record the Gate A evidence and release boundary.

## 4. Observation Handoff

- [ ] 4.1 Monitor the agreed post-enforcement observation window for successful
  legacy lookup, upsert, hard-delete, and compatibility-adapter usage.
- [ ] 4.2 Publish PII-free aggregate and code-search evidence for the Gate B
  decision without changing legacy branches in this change.
- [ ] 4.3 Create a separate approved proposal before removing proven-unused
  legacy paths, obsolete RPC grants, or application compatibility branches.
