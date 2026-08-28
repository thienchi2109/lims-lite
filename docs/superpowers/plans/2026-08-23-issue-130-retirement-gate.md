# Issue #130 - Irreversible Phase 6 Retirement Gate (tasks 6.10-6.14) Implementation Plan

> **Revision 2026-08-28:** Corrects the migration number, production baseline,
> application compatibility gap, persistent security coverage, TDD ordering,
> rollback-only SQL tests, and push-before-deploy sequence found during review.
>
> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Retire `clients_unique_identity UNIQUE (name, date_of_birth)` with
forward-only migration 230 only after the application can edit client profile
fields without directly updating identity columns. Block direct authenticated
updates to `id_card_num`, `name`, and `date_of_birth`, while preserving the
audited manager correction path and deterministic v2 resolution contracts.

**Architecture:** Deliver two ordered compatibility layers in one reviewed
source release. First, narrow normal client edits to profile-only fields and
keep identity correction behind `correct_client_identity_v1`. Second, add
migration 230 with strict baseline assertions, bounded lock/statement time,
the irreversible constraint drop, column-grant hardening, and replacement
persistent security coverage. Push the committed source before the home server
pulls it; deploy the compatible application before applying the migration.

**Tech Stack:** Next.js 16, React 19, TypeScript, PostgreSQL (self-hosted
Supabase in Docker on the home server), Vitest, rollback-only psql tests, and
OpenSpec change `add-deterministic-client-matching`.

**Spec:** `openspec/changes/add-deterministic-client-matching/{tasks.md,design.md}`
(Issue #130 owns tasks 6.10-6.14 only; no Phase 7).

## Verified Starting Point

Reconfirm these drift-prone facts immediately before implementation and again
before apply:

- Migration 229 is already committed and deployed as
  `229_restore_active_assay_availability.sql`; the retirement gate must be 230.
- Production checkout `/opt/lims-lite` was at `8ce56b8` during plan review.
- `clients_unique_identity UNIQUE (name, date_of_birth)` still exists.
- Production had 63 clients, zero canonical-projection drift, and zero
  same-name/DOB duplicate groups.
- Resolver signatures are exactly:
  - `resolve_client_identity_v2(text,text,text,date,text)`
  - `resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)`
- `authenticated` has no table-level UPDATE grant and has column UPDATE on:
  `id_card_num`, `name`, `date_of_birth`, `gender`, `phone`, `address`,
  `health_insurance_num`, and `expiry_date`.
- Production switches were:
  - `CLIENT_RESOLUTION_V2_CATEGORIES=manual,qr`
  - `CLIENT_RESOLUTION_LEGACY_UPSERT=off`
  - shadow categories `manual,qr,upsert`

## Global Constraints

- Applied migrations are byte-for-byte immutable. Do not edit migration 228 or
  any other applied migration; all database changes belong in migration 230.
- No client deletion, merging, UUID replacement, sample relinking, or historical
  mutation. Do not restore name/DOB uniqueness after valid duplicates can exist.
- Production DB access is only SSH to `khoa-xn-cdc@100.93.19.42`, then
  `sudo -n docker exec ... lims-postgres psql` from `/opt/lims-lite`.
- Do not use Supabase MCP, Supabase CLI, or Docker in this workspace.
- All production SQL behavior tests must use `\set ON_ERROR_STOP on`, an outer
  `BEGIN`, a rollback transaction boundary, deterministic fixture identifiers,
  and read-only post-rollback residue assertions. They must never commit data.
- Expected SQL failures must be caught and asserted independently. A single
  `ON_ERROR_STOP` failure is evidence for only that failing statement.
- Run `run_security_tests()` after applying migration 230.
- Keep UI text Vietnamese, use Zod and strict TypeScript, and send mutations
  through `src/lib/api-client.ts`.
- Work directly on `main` as explicitly authorized for this plan revision and
  Issue #130 implementation. Push source before any home-server pull.

---

### Task 1: Application compatibility tests (RED)

**Files:**
- Create: `src/app/actions/clients.update-profile.test.ts`
- Create: `src/components/__tests__/client-form-update.test.tsx`
- Modify: `tests/clients-update-allows-analyst.test.mjs`
- Modify: `tests/sample-edit-dialog-edits-client.test.mjs`

**Behavior under test:**

1. An analyst or manager can update only `gender`, `phone`, `address`,
   `health_insurance_num`, and `expiry_date` through normal client editing.
2. `ClientForm` update mode sends only those profile fields, even though the
   form loaded a complete `CreateClient` object.
3. Supplying `id_card_num`, `name`, or `date_of_birth` to the normal
   `updateClient` action is rejected before the Supabase `.update()` call.
4. The sample edit dialog still opens the linked client and saves profile
   changes, but no longer promises that normal editing changes full identity.
5. Manager identity corrections remain routed through the existing lifecycle
   workspace/API path backed by `correct_client_identity_v1`; tests must not
   introduce a second direct identity mutation path.

- [x] **Step 1:** Add focused server-action tests that mock the Supabase query
      chain and prove profile-only payloads reach `.update()`.
- [x] **Step 2:** Add a separate denial test for each protected identity field
      and assert `.from('clients').update(...)` is not called.
- [x] **Step 3:** Add a React test that submits `ClientForm` in update mode and
      asserts `updateClientClient()` receives no identity keys.
- [x] **Step 4:** Replace stale source-shape assertions in the two `.mjs` tests
      with the new contract: analyst profile edits remain allowed, identity
      edits use the audited manager lifecycle path.
- [x] **Step 5:** Run the focused tests and verify RED against the current code:

```bash
rtk npx vitest run \
  src/app/actions/clients.update-profile.test.ts \
  src/components/__tests__/client-form-update.test.tsx
rtk node tests/clients-update-allows-analyst.test.mjs
rtk node tests/sample-edit-dialog-edits-client.test.mjs
```

Expected: failures show that `ClientForm` sends the full payload and
`updateClient` accepts identity fields.

### Task 2: Application compatibility implementation (GREEN)

**Files:**
- Modify: `src/components/client-form.tsx`
- Modify: `src/app/actions/clients.ts`
- Modify if required by the narrowed payload contract:
  - `src/lib/api-client.ts`
  - `src/lib/client-actions/types.ts`
  - `src/app/api/client-actions/route.ts`

**Implementation requirements:**

- Define or reuse a schema/type for the five profile fields; do not duplicate
  field lists across the component, API boundary, and server action if a local
  shared schema is already available.
- In `ClientForm` update mode, keep identity data visible for context but do not
  submit `id_card_num`, `name`, or `date_of_birth` through `updateClientClient`.
- In `updateClient`, reject protected identity keys explicitly and construct the
  database update object from an allowlist of profile fields only.
- Remove the normal-update branch that manually rewrites
  `samples.client_name`; identity changes and snapshot/audit behavior remain
  owned by the audited lifecycle RPC and database trigger.
- Preserve analyst and manager access to normal profile edits.
- Do not alter the existing manager lifecycle workspace path that invokes
  `correct_client_identity_v1`.

- [x] **Step 1:** Implement the smallest schema, component, API, and action
      changes required by the RED tests.
- [x] **Step 2:** Run the Task 1 commands and verify GREEN.
- [x] **Step 3:** Run adjacent lifecycle and API route tests:

```bash
rtk npx vitest run \
  src/components/__tests__/client-lifecycle-workspace.test.tsx \
  src/app/api/client-actions/role-guard.client-characterization.test.ts \
  src/app/api/client-actions/route.test.ts
```

### Task 3: Static migration-shape contract (paired with Task 4)

**Files:**
- Create: `tests/client-retirement-gate-migration.test.ts`

This test requires only
`supabase/migrations/230_remove_clients_unique_identity.sql`. Author the
contract before migration 230, but deliver and execute it together with Task 4.
Do not create a standalone failing checkpoint merely because migration 230 is
absent. The test must not require the SQL behavior suite, so Tasks 3-4 can be
GREEN before Task 5 is authored.

Assertions:

1. Migration starts with `BEGIN;`, ends with `COMMIT;`, sets
   `lock_timeout = '5s'`, `statement_timeout = '60s'`, and a fixed local
   `search_path`.
2. Headers document security and historical-data impact.
3. Baseline requires the exact unique constraint definition and both exact v2
   resolver signatures listed above.
4. Baseline reuses migration 228's complete canonical projection checks for
   normalized name, normalized phone, government identity value, and government
   identity type.
5. Baseline verifies `sync_samples_client_name` by relation, name, `tgfoid`,
   `NOT tgisinternal`, enabled state, and trigger definition.
6. Baseline verifies no table-level authenticated UPDATE and the expected
   eight column-level UPDATE grants before retirement.
7. Gate drops `clients_unique_identity` and revokes authenticated UPDATE on
   `id_card_num`, `name`, and `date_of_birth`.
8. Postconditions verify the constraint is absent, all three protected columns
   are denied, and the five approved profile columns remain writable.
9. Migration `CREATE OR REPLACE`s
   `test_client_resolution_sample_cutover_security()` so it checks post-gate
   semantics instead of requiring the legacy constraint.
10. The security runner entry and function comment describe post-retirement
    protection, not reversible legacy-gate preservation.
11. Forbidden data-changing/reversal patterns are absent: client DELETE,
    TRUNCATE, client backfill UPDATE, `CREATE UNIQUE`, and `ADD CONSTRAINT`.

- [x] **Step 1:** Write the static contract before authoring migration 230.
- [x] **Step 2:** Keep the contract and migration in one changeset; skip the
      redundant missing-file RED checkpoint and verify GREEN under Task 4.

### Task 4: Migration 230 implementation (GREEN)

**Files:**
- Create: `supabase/migrations/230_remove_clients_unique_identity.sql`

**Migration structure:**

1. Document purpose, irreversible security impact, and zero intended row
   mutation.
2. Start transaction and set:

```sql
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SET LOCAL search_path TO public, extensions;
```

3. In `$baseline$`, assert:
   - exact `clients_unique_identity` definition;
   - exact resolver signatures;
   - migration 228 canonical projections have zero drift;
   - complete sample snapshot trigger identity and definition;
   - no table-level authenticated UPDATE;
   - all eight expected column UPDATE grants are present.
4. Drop only `clients_unique_identity`.
5. Revoke authenticated column UPDATE on `id_card_num`, `name`, and
   `date_of_birth`.
6. `CREATE OR REPLACE`
   `test_client_resolution_sample_cutover_security()` while preserving its
   signature, ownership/grants, `STABLE` property, and fixed `search_path`.
   Its post-retirement assertions must cover:
   - legacy constraint absent;
   - protected identity column updates denied;
   - five profile column updates retained;
   - transactional RPC signatures, grants, and fixed `search_path`;
   - sample snapshot trigger identity, state, and definition.
7. Update the existing `run_security_tests()` registration description and the
   security function comment to post-retirement semantics without dropping
   other registered tests.
8. In `$verify$`, repeat the critical postconditions and run the replacement
   security test before `COMMIT`.

- [x] **Step 1:** Implement migration 230 using nearby migration style and
      migration 228 baseline expressions verbatim where they remain valid.
- [x] **Step 2:** Run the Task 3 test and verify GREEN.
- [x] **Step 3:** Run existing static migration tests that protect the retained
      v2 and lifecycle contracts:

```bash
rtk vitest run \
  tests/client-canonical-foundation-migration.test.ts \
  tests/client-lifecycle-guard-migration.test.ts \
  tests/client-lifecycle-rpc-migration.test.ts \
  tests/client-resolution-phase6-migrations.test.ts \
  tests/client-retirement-gate-migration.test.ts
```

### Task 5: Rollback-only post-retirement SQL behavior suite

**Files:**
- Create: `tests/client-retirement-gate.test.sql`

**Test harness requirements:**

- Begin with `\set ON_ERROR_STOP on`.
- Use one outer `BEGIN` for all mutating fixtures and terminate it with
  `ROLLBACK`; never use `COMMIT`.
- Use an Issue #130-specific UUID/name/identity prefix that cannot collide with
  production data.
- Catch each expected `insufficient_privilege` or `unique_violation` inside its
  own PL/pgSQL sub-block and fail if the expected exception is not raised.
- Reset role after every role-switching case, including exception paths.
- After rollback, run read-only assertions proving no matching clients,
  samples, or audit rows remain.

**Behavior cases:**

1. `clients_unique_identity` is absent.
2. Two distinct clients with the same normalized name and DOB but different
   government identities can coexist with distinct UUIDs.
3. Direct authenticated UPDATE is denied independently for `id_card_num`,
   `name`, and `date_of_birth`.
4. Direct authenticated profile UPDATE succeeds for `gender`, `phone`,
   `address`, `health_insurance_num`, and `expiry_date`.
5. `resolve_or_create_client_v2(...)` handles a same-name/DOB distinct person
   without a unique violation.
6. `correct_client_identity_v1` remains manager-only, updates through the
   audited contract, and writes the expected audit evidence.
7. The sample snapshot trigger preserves `samples.client_name` behavior.
8. A scoped attempt to recreate name/DOB uniqueness fails while duplicate
   fixtures exist, proving forward-only recovery constraints.
9. Final residue checks find zero Issue #130 clients, samples, and audit rows.

- [ ] **Step 1:** Write the deterministic rollback-only suite.
- [ ] **Step 2:** Perform a static review for transaction boundaries, exception
      isolation, role reset, unique fixture prefixes, and residue assertions.
- [ ] **Step 3:** Do not run this post-retirement suite against production
      before migration 230. Pre-apply evidence is a separate task.

### Task 6: Pre-apply entry gate and baseline evidence

- [ ] **Step 1:** Search every mutation entry point, not only
      `src/app/actions/clients.ts`:
  - `src/app/api/client-actions/route.ts`
  - `src/app/api/client-actions/client-resolution-shadow-handlers.ts`
  - `src/lib/api-client.ts`
  - `src/lib/client-resolution/cutover.ts`
  - `src/components/client-form.tsx`
  - `src/components/sample-edit-dialog.tsx`
  - all raw `.upsert()` and direct client `.update()` callers
- [ ] **Step 2:** Prove no enabled manual/QR/raw upsert path depends on
      name/DOB uniqueness and record the three production switch values.
- [ ] **Step 3:** Through SSH and read-only psql queries, reconfirm:
  - exact resolver signatures;
  - constraint present with exact definition;
  - zero same-name/DOB duplicate groups;
  - zero canonical projection drift;
  - complete sample snapshot trigger baseline;
  - no table-level authenticated UPDATE;
  - all eight pre-gate column UPDATE grants;
  - current row count and `/opt/lims-lite` commit.
- [ ] **Step 4:** Capture baseline evidence showing the gate is not yet applied:
      constraint count is one and protected identity grants are still true.
      Do not run one failing `ON_ERROR_STOP` suite and claim it proves multiple
      RED cases.
- [ ] **Step 5:** Confirm the home-server checkout is clean and application
      health is green before source deployment.

### Task 7: Local review, commit, push, then deploy compatible application

- [ ] **Step 1:** Run focused tests from Tasks 1-4, then:

```bash
rtk npm run typecheck
rtk npm run lint
rtk npm run react-doctor
rtk openspec validate add-deterministic-client-matching --strict
rtk git diff --check
```

- [ ] **Step 2:** Review the full diff for Issue #130 scope. No Phase 7, no
      applied migration edits, and no unrelated refactor.
- [ ] **Step 3:** Commit application compatibility, migration, tests, and plan
      in reviewable Conventional Commit units.
- [ ] **Step 4:** Because direct `main` is authorized, synchronize and push:

```bash
rtk git pull --rebase origin main
rtk git push origin main
rtk git status --short --branch
rtk git rev-list --left-right --count main...origin/main
```

Expected: clean worktree and `0 0` divergence.

- [ ] **Step 5:** Only after push succeeds, update the home-server checkout:

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && git status --short && git pull --ff-only origin main"
```

- [ ] **Step 6:** Deploy/restart the application using the established
      home-server procedure without applying migration 230 yet.
- [ ] **Step 7:** With the legacy constraint still present, smoke-test a
      phone/address-only client edit and the existing manager identity correction
      flow. This proves the application compatibility slice precedes the
      irreversible database gate.

### Task 8: Apply migration 230 and verify post-retirement GREEN

- [ ] **Step 1:** Recheck migration checksum/content in `/opt/lims-lite` matches
      the pushed commit and rerun the Task 6 database baseline.
- [ ] **Step 2:** Apply the committed migration:

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker exec -i lims-postgres \
  psql -U postgres -d postgres -v ON_ERROR_STOP=1 \
  < supabase/migrations/230_remove_clients_unique_identity.sql"
```

- [ ] **Step 3:** Run the persistent security suite:

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-postgres psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1 -c 'SELECT * FROM run_security_tests();'"
```

- [ ] **Step 4:** Run the rollback-only post-retirement behavior suite:

```bash
rtk ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec -i lims-postgres psql -U postgres -d postgres \
  -v ON_ERROR_STOP=1" < tests/client-retirement-gate.test.sql
```

- [ ] **Step 5:** Capture postconditions: constraint absent, protected identity
      grants false, approved profile grants true, security runner description
      updated, trigger intact, and no Issue #130 fixture residue.

### Task 9: Immediate blast-radius verification (tasks 6.13-6.14)

- [ ] Re-run typecheck, lint, React Doctor, focused Vitest, and both updated
      `.mjs` regression tests against the pushed commit.
- [ ] Review shadow evidence after retirement; verify manual, QR, and legacy
      upsert observations contain no unexpected fallback or unique violation.
- [ ] Production browser smoke:
  - manual accession and QR accession;
  - client search and sample detail;
  - profile-only client edit;
  - manager audited identity correction;
  - sample linkage and snapshot naming;
  - statuses, results, audit history, and confidential/RLS behavior;
  - unrelated search and existing workflows named in OpenSpec task 6.13.
- [ ] Health check:

```bash
rtk curl -fsS https://cdclims.cloud/auth/v1/health
```

- [ ] Document the post-retirement recovery rehearsal: any correction requires
      a new forward-only application/database release; restoring name/DOB
      uniqueness is forbidden.

### Task 10: OpenSpec, issue, and repository closeout (task 6.11)

- [ ] Only after Tasks 8-9 pass, tick tasks 6.10-6.14 in
      `openspec/changes/add-deterministic-client-matching/tasks.md`.
- [ ] Add the rollback-boundary decision to `design.md`: switch rollback ends at
      migration 230, recovery is forward-only, and name/DOB uniqueness cannot be
      restored after valid duplicates may exist.
- [ ] Record code-search, pre/post database, security, test, browser-smoke,
      health, and recovery-rehearsal evidence on Issue #130.
- [ ] File follow-up issues for any non-blocking work outside 6.10-6.14; do not
      widen this change into Phase 7.
- [ ] Close Issue #130 only when all acceptance evidence is present.
- [ ] Commit closeout documentation, then land the plane:

```bash
rtk git pull --rebase origin main
rtk git push origin main
rtk git status --short --branch
rtk git rev-list --left-right --count main...origin/main
```

Expected: clean worktree, local `main` aligned with `origin/main`, and the home
server running the same committed source.

## Self-Review

- 6.10: Tasks 1-8 provide compatibility, entry-gate proof, migration 230, and
  direct identity UPDATE denial.
- 6.11: Tasks 9-10 document and rehearse the irreversible rollback boundary.
- 6.12: Tasks 1, 3, and 5 cover compatibility, duplicate identity, constraint
  removal, update denial, and forward-only behavior.
- 6.13: Task 9 covers sample linkage, snapshots, statuses, results, audit, RLS,
  search, and user flows.
- 6.14: Tasks 6-10 cover immediate blast radius, quality gates, shadow review,
  browser smoke, health, recovery rehearsal, evidence, and closeout.
- Migration naming is consistently
  `230_remove_clients_unique_identity.sql`.
- SQL behavior tests are deterministic and rollback-only; pre-apply baseline
  proof is separate from the post-retirement suite.
