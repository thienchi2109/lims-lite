# Restore Active Assay Availability Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development
> (if subagents available) or superpowers:executing-plans to implement this
> plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish compatibility revision 2 so every active assay is assignable
for the active `Máu` sample type while all soft-deleted assays remain hidden.

**Architecture:** Add one test-first, forward-only data migration. The migration
will impersonate the existing system manager only within its transaction and
reuse the established clone, update-review, review-hash, and publish RPCs. It
will abort on production-baseline drift and verify lifecycle boundaries before
commit.

**Tech Stack:** PostgreSQL PL/pgSQL, existing Supabase compatibility catalog
RPCs, Vitest migration contract tests, OpenSpec.

---

## Chunk 1: Contract And Migration

### Task 1: Lock The Recovery Contract

**Files:**
- Create: `tests/restore-active-assay-availability-migration.test.ts`
- Reference:
  `tests/assay-sample-type-catalog-rpc-migration.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Add assertions that migration 229:

- exists and leaves migrations 206-213 unchanged;
- uses `BEGIN`, fixed `search_path`, and an explicit rollback strategy comment;
- validates revision 1, no open draft, `LM-000001`, system actor, 84 active
  assays, 25 configured assays, and 59 active `not_assignable` assays;
- sets transaction-local JWT claims for the all-zero system manager;
- calls the existing clone, update-review, review, and publish RPCs;
- updates only active `not_assignable` assays;
- requires exactly 59 recovered assays;
- verifies revision 2 has 84 configured current mappings and no mapping for
  soft-deleted assays.

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
rtk npm run test:run -- \
  tests/restore-active-assay-availability-migration.test.ts
```

Expected: FAIL because
`supabase/migrations/229_restore_active_assay_availability.sql` does not exist.

### Task 2: Implement The Forward-Only Recovery

**Files:**
- Create:
  `supabase/migrations/229_restore_active_assay_availability.sql`
- Test:
  `tests/restore-active-assay-availability-migration.test.ts`

- [ ] **Step 1: Add migration header and baseline assertions**

The migration must:

```sql
BEGIN;
SET LOCAL search_path TO public, extensions;
```

It must acquire advisory lock `208110`, verify required tables/functions, and
abort unless the production state matches the reviewed 84/25/59 baseline.

- [ ] **Step 2: Establish the audited system actor**

Verify the all-zero user is an active manager, then set transaction-local
`request.jwt.claims`:

```sql
PERFORM set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000000","role":"authenticated"}',
  TRUE
);
```

Assert `auth.uid()` and `get_user_role()` resolve to that system manager.

- [ ] **Step 3: Clone and correct the draft**

Call `clone_assay_sample_type_catalog_revision(1, reason)`. Iterate only over
active assays whose cloned review is `not_assignable`. For each assay:

- build candidate decision JSON for every cloned candidate;
- accept the `LM-000001` candidate;
- call `update_assay_sample_type_catalog_review` with `configured`,
  `[blood_sample_type_id]`, explicit correction reason, and the current
  optimistic `updatedAt`;
- count recovered assays and require exactly 59.

- [ ] **Step 4: Review and publish revision 2**

Call:

```sql
review_assay_sample_type_catalog_revision(...)
publish_assay_sample_type_catalog_revision(...)
```

Use explicit reasons identifying the authorized active-assay availability
recovery.

- [ ] **Step 5: Verify postconditions before COMMIT**

Require:

- revision 1 is `superseded`;
- revision 2 is the only `published` revision;
- no draft exists;
- 84 active reviews are `configured`;
- 84 generation-current `Máu` compatibility rows exist;
- zero active reviews are `not_assignable`;
- zero compatibility rows reference a soft-deleted assay;
- `CT-000260`, `CT-000261`, `CT-000277`, and `CT-000278` are mapped.

- [ ] **Step 6: Run the focused test to verify GREEN**

Run:

```bash
rtk npm run test:run -- \
  tests/restore-active-assay-availability-migration.test.ts
```

Expected: PASS.

## Chunk 2: Verification And Delivery

### Task 3: Run Source Quality Gates

**Files:**
- Verify all files changed in Chunk 1.

- [ ] **Step 1: Run related migration tests**

```bash
rtk npm run test:run -- \
  tests/restore-active-assay-availability-migration.test.ts \
  tests/assay-sample-type-compatibility-revision-migration.test.ts \
  tests/assay-sample-type-catalog-rpc-migration.test.ts \
  tests/assay-sample-type-catalog-review-hash-migration.test.ts \
  tests/assay-sample-type-enforcement-migration.test.ts
```

Expected: all files and tests pass.

- [ ] **Step 2: Validate OpenSpec and TypeScript**

```bash
rtk openspec validate restore-active-assay-availability --strict
rtk npm run typecheck
```

Expected: both commands exit 0.

- [ ] **Step 3: Review the final diff**

Confirm:

- no applied migration changed;
- no RLS, grant, RPC, or frontend code changed;
- every production-data mutation is inside migration 229;
- baseline mismatch aborts before catalog creation;
- soft-deleted assays cannot enter the new allowlist.

### Task 4: Deliver And Apply

**Files:**
- Commit all change artifacts, test, plan, and migration.

- [ ] **Step 1: Commit and push**

```bash
rtk git add \
  openspec/changes/restore-active-assay-availability \
  docs/superpowers/plans/2026-08-23-restore-active-assay-availability.md \
  tests/restore-active-assay-availability-migration.test.ts \
  supabase/migrations/229_restore_active_assay_availability.sql
rtk git commit -m "fix: Restore active assay availability"
rtk git pull --rebase
rtk git push -u origin fix/restore-active-assay-catalog
```

- [ ] **Step 2: Fast-forward `main` without a PR**

After review and required checks pass, verify the branch descends from the
current remote `main`, then push it as a fast-forward update:

```bash
rtk git fetch origin main
rtk git merge-base --is-ancestor origin/main HEAD
rtk git push origin HEAD:main
```

- [ ] **Step 3: Sync the home-server checkout**

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && git pull --ff-only"
```

- [ ] **Step 4: Apply migration 229**

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker exec -i lims-postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/229_restore_active_assay_availability.sql"
```

- [ ] **Step 5: Run security and production verification**

Run `run_security_tests()`, query revision and mapping postconditions, verify the
four reported assay codes, and check application health. Then ping the user to
smoke the accession UI as analyst.
