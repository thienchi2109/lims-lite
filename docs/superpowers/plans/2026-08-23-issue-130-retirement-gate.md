# Issue #130 — Irreversible Phase 6 Retirement Gate (tasks 6.10–6.14) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the irreversible forward-only gate migration 229 that removes
`clients_unique_identity UNIQUE (name, date_of_birth)` and blocks direct
identity-column UPDATE, with red-green TDD coverage before and after apply.

**Architecture:** One additive forward-only SQL migration (baseline assert →
drop constraint → revoke column grants → postcondition verify), covered by a
vitest static-shape test (runs locally without DB) and a behavior `.test.sql`
suite (runs on the home-server production postgres via SSH + docker psql).
App code is untouched; only DB contracts and docs change.

**Tech Stack:** PostgreSQL (self-hosted Supabase, docker `lims-postgres`),
Vitest static migration tests, OpenSpec change `add-deterministic-client-matching`.

**Spec:** openspec/changes/add-deterministic-client-matching/{tasks.md,design.md}
(issue #130 owns tasks 6.10–6.14 ONLY; no Phase 7)

## Global Constraints

- Applied migrations are byte-for-byte immutable; fixes go in new forward-only migrations.
- No DELETE of client/sample/result/audit data; no merges, UUID replacement, or relinking.
- Never restore name/DOB uniqueness after valid same-name/DOB rows exist.
- DB access ONLY: `ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42`, then from
  `/opt/lims-lite`:
  `sudo -n docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1`.
- No Supabase MCP / Supabase CLI. This workspace never runs Docker DB.
- Every migration: role checks where relevant, document security impact,
  run `run_security_tests()` after apply.
- All UI copy Vietnamese; Zod + strict TS for any TS changes.
- Conventional Commits, imperative mood, under 100 characters.

---

### Task 1: Static migration-shape test (RED)

**Files:**
- Create: `tests/client-retirement-gate-migration.test.ts`

**Interfaces:**
- Consumes: none (reads repo files)
- Produces: failing test expecting
  `supabase/migrations/229_remove_clients_unique_identity.sql` and
  `tests/client-retirement-gate.test.sql` to exist with required content markers.

- [ ] **Step 1: Write the failing test**

Mirror `tests/client-resolution-phase6-migrations.test.ts` (`readFileSync` +
`normalizeSql`). Assertions:

1. Both files exist.
2. Migration normalized starts `BEGIN;` ends `COMMIT;`, contains headers
   `Security impact:` and `Historical data impact:`.
3. Baseline guard present: normalized contains `clients_unique_identity` inside a
   `$baseline$` DO block requiring `pg_constraint` match `contype = 'u'` AND
   `pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (name, date_of_birth)'`;
   requires `to_regprocedure('public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)')`
   IS NOT NULL; requires trigger `sync_samples_client_name` enabled `'O'`.
4. Gate actions present:
   `ALTER TABLE public.clients DROP CONSTRAINT clients_unique_identity;`
   and `REVOKE UPDATE (name, date_of_birth) ON public.clients FROM authenticated;`
5. Postcondition block asserts the constraint is gone and
   `has_column_privilege('authenticated','public.clients','name','UPDATE')` is false,
   while profile columns (`gender`,`phone`,`address`,`health_insurance_num`,`expiry_date`)
   retain UPDATE privilege.
6. Forbidden patterns absent (case-insensitive): `DELETE FROM`, `TRUNCATE`,
   `CREATE UNIQUE`, `ADD CONSTRAINT`, `UPDATE public.clients SET`.

- [ ] **Step 2: Run test, verify RED**

Run: `npx vitest run tests/client-retirement-gate-migration.test.ts`
Expected: FAIL — migration file does not exist.

- [ ] **Step 3: Commit**

```bash
git add tests/client-retirement-gate-migration.test.ts
git commit -m "test: add retirement gate migration shape expectations"
```

### Task 2: Migration 229 (GREEN Task 1)

**Files:**
- Create: `supabase/migrations/229_remove_clients_unique_identity.sql`

**Interfaces:**
- Consumes: baseline left by 228 (constraint present, v2 RPCs live).
- Produces: DB state consumed by Task 3 tests — constraint removed;
  `authenticated` loses UPDATE on `name`,`date_of_birth`; profile grants intact.

- [ ] **Step 1: Write migration** — structure (full statements, comments in style of 218/228):

```sql
-- Purpose: Irreversible Phase 6 retirement gate (issue #130, OpenSpec tasks 6.10-6.14):
-- remove legacy UNIQUE(name,date_of_birth) and block direct identity UPDATE.
-- Security impact: Authenticated callers lose column UPDATE on name and date_of_birth;
--   identity changes remain possible only through audited manager lifecycle RPCs and
--   resolve_or_create_client_v2 contracts. Profile edits (gender, phone, address,
--   health_insurance_num, expiry_date) stay allowed.
-- Historical data impact: Legacy uniqueness removed so valid same-name/DOB distinct
--   clients can exist. No rows are inserted, updated, or deleted by this migration.
BEGIN;
SET LOCAL search_path TO public, extensions;

DO $baseline$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint AS constraint_record
        WHERE constraint_record.conrelid = 'public.clients'::REGCLASS
          AND constraint_record.conname = 'clients_unique_identity'
          AND constraint_record.contype = 'u'
          AND pg_get_constraintdef(constraint_record.oid) = 'UNIQUE (name, date_of_birth)'
    ) THEN RAISE EXCEPTION 'Migration 229 requires the reversible legacy identity gate'; END IF;

    IF to_regprocedure('public.resolve_or_create_client_v2(text,text,text,date,text,text,text,text,date)') IS NULL
       OR to_regprocedure('public.resolve_client_identity_v2(boolean,text,text,text,date,text,text,text,text,date)') IS NULL THEN
        RAISE EXCEPTION 'Migration 229 requires deterministic resolver v2 contracts'; END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgrelid = 'public.samples'::REGCLASS
          AND tgname = 'sync_samples_client_name'
          AND tgenabled = 'O'
    ) THEN RAISE EXCEPTION 'Migration 229 requires sample snapshot baseline'; END IF;

    IF EXISTS (
        SELECT 1 FROM public.clients
        WHERE identity_trust_level IS NULL
           OR normalized_name IS DISTINCT FROM public.normalize_client_name_v1(name)
    ) THEN RAISE EXCEPTION 'Migration 229 requires fully classified canonical clients'; END IF;
END
$baseline$;

ALTER TABLE public.clients
    DROP CONSTRAINT clients_unique_identity;

REVOKE UPDATE (name, date_of_birth) ON TABLE public.clients FROM authenticated;

DO $verify$
DECLARE v_column TEXT;
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conrelid = 'public.clients'::REGCLASS
          AND conname = 'clients_unique_identity'
    ) THEN RAISE EXCEPTION 'Migration 229 left legacy identity constraint'; END IF;

    FOREACH v_column IN ARRAY ARRAY['name','date_of_birth'] LOOP
        IF has_column_privilege('authenticated','public.clients',v_column,'UPDATE') THEN
            RAISE EXCEPTION 'Migration 229 left direct identity UPDATE on %', v_column;
        END IF;
    END LOOP;

    FOREACH v_column IN ARRAY ARRAY['gender','phone','address',
                                    'health_insurance_num','expiry_date'] LOOP
        IF NOT has_column_privilege('authenticated','public.clients',v_column,'UPDATE') THEN
            RAISE EXCEPTION 'Migration 229 dropped allowed profile UPDATE on %', v_column;
        END IF;
    END LOOP;
END
$verify$;

COMMIT;
```

NOTE before writing: verify exact signatures of `resolve_or_create_client_v2` /
`resolve_client_identity_v2` on the home server (`\df+`) and align with the
baseline assertions used by migration 228.

- [ ] **Step 2: Run Task 1 test, verify GREEN**

Run: `npx vitest run tests/client-retirement-gate-migration.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/229_remove_clients_unique_identity.sql
git commit -m "feat: remove legacy client identity uniqueness gate"
```

### Task 3: DB behavior tests (RED on server, pre-apply)

**Files:**
- Create: `tests/client-retirement-gate.test.sql`

Self-verifying DO blocks (RAISE EXCEPTION on failure), each wrapped in its own
transaction with cleanup limited to rows it created (or use ROLLBACK-per-case
pattern used by `tests/client-lifecycle-guard.test.sql`). Cases:

1. Constraint absent: `pg_constraint` lookup returns 0 rows.
2. Same-name/DOB distinct persons: INSERT two clients, identical
   `name`+`date_of_birth`, different `government_identity_value` → both succeed,
   distinct UUIDs.
3. Direct identity UPDATE denied: `SET ROLE authenticated;` then
   `UPDATE public.clients SET name = ...` → expect `insufficient_privilege`;
   same for `date_of_birth`. Reset role after each case.
4. Profile edit compatibility: `SET ROLE authenticated; UPDATE ... SET phone/gender`
   → succeeds.
5. v2 contract intact: `SELECT public.resolve_or_create_client_v2(...)` creates/resolves
   a same-name/DOB client without unique violation (use distinct fixture values).
6. Manager lifecycle RPC path intact + audit row written (mirror assertions in
   `client-lifecycle-rpc.test.sql`).
7. Snapshot naming intact: insert sample linked to new client →
   `samples.client_name` matches trigger expectation.
8. Forward-only recovery guard: with two same-name/DOB rows present, attempt
   `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE (name,date_of_birth)` inside a DO block
   expecting failure — proves uniqueness cannot return post-gate.

- [ ] **Step 1:** Write file.
- [ ] **Step 2:** Execute on home server BEFORE applying 229 to confirm RED:

```bash
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1" \
  < tests/client-retirement-gate.test.sql
```

Expected: FAIL at case 1/3/8 (constraint still present) = true RED.

- [ ] **Step 3: Commit**

```bash
git add tests/client-retirement-gate.test.sql
git commit -m "test: cover retirement gate same-name dob and denial behavior"
```

### Task 4: Rehearse + apply 229, verify GREEN + security suite

- [ ] **Step 1:** Confirm entry criteria on server: `/opt/lims-lite` git status clean,
      health OK, deployed env has `CLIENT_RESOLUTION_V2_CATEGORIES=manual,qr` and
      `CLIENT_RESOLUTION_LEGACY_UPSERT=off`; reconfirm code search shows no raw
      name/DOB upsert caller remains in `src/app/actions/clients.ts`.
- [ ] **Step 2:** Push workspace → `ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 "cd /opt/lims-lite && git pull --ff-only"`
- [ ] **Step 3:** Rehearsal note: switch rollback ENDS at this gate; capture pre-apply
      `\d clients` output into issue evidence.
- [ ] **Step 4:** Apply:

```bash
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "cd /opt/lims-lite && sudo -n docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1 < supabase/migrations/229_remove_clients_unique_identity.sql"
```

- [ ] **Step 5:** MANDATORY security suite + behavior GREEN:

```bash
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec lims-postgres psql -U postgres -d postgres -c 'SELECT * FROM run_security_tests();'"
ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42 \
  "sudo -n docker exec -i lims-postgres psql -U postgres -d postgres -v ON_ERROR_STOP=1" \
  < tests/client-retirement-gate.test.sql
```

Expected: all pass.

- [ ] **Step 6:** Evidence queries (constraint absent from `pg_constraint`,
      `has_column_privilege` matrix) pasted into issue #130.

### Task 5: Blast-radius verification (tasks 6.13–6.14)

- [ ] `npm run typecheck && npm run lint && npm run react-doctor`
- [ ] Focused vitest:
      `npx vitest run tests/client-canonical-foundation-migration.test.ts tests/client-lifecycle-guard-migration.test.ts tests/client-resolution-phase6-migrations.test.ts tests/client-retirement-gate-migration.test.ts`
      plus `npx vitest run src/lib/client-resolution`
- [ ] Review & update stale expectations: `tests/clients-update-allows-analyst.test.mjs`
      and `tests/sample-edit-dialog-edits-client.test.mjs` — analyst profile edits
      still allowed; identity edits now deny (intentional; adjust fixtures only if
      they mutate name/DOB directly).
- [ ] Production browser smoke: manual accession flow, QR flow, client search,
      sample detail panel, client edit dialog (phone/address editable;
      name/DOB readonly/denied).
- [ ] Health check: `curl -fsS https://cdclims.cloud/auth/v1/health`
- [ ] Forward-only recovery rehearsal documented (no rollback switch beyond this gate).

### Task 6: Docs + closeout (task 6.11)

- [ ] Tick 6.10–6.14 in `openspec/changes/add-deterministic-client-matching/tasks.md`.
- [ ] Add "Rollback boundary" subsection to design.md: switch rollback ends at
      migration 229; recovery = new forward-only application/database release;
      restoring name/DOB uniqueness is forbidden.
- [ ] Comment evidence on issue #130, close it.
- [ ] Land the plane: `git pull --rebase && git push && git status` clean/up-to-date.

## Self-Review

- Spec coverage: 6.10→T2/T4; 6.11→T6; 6.12→T1/T3; 6.13→T5; 6.14→T4/T5. No gaps.
- Placeholders: RPC signature literals carry a deliberate NOTE-verify step at
  execution start (Task 2 Step 1).
- Naming consistency: migration filename `229_remove_clients_unique_identity.sql`
  used across Tasks 1, 2, and 4; test filename `tests/client-retirement-gate.test.sql`
  used across Tasks 1, 3, and 4.
