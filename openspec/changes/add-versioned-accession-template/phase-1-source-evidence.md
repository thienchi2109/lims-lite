# Phase 1 source evidence — 2026-11-02 UTC

TASK-8/#136 **In Progress**; Phase 1 source gate **PASS**, SQL/runtime gate **NOT RUN**. Only tasks 1.1–1.4 are checked. Phase 2–4 remain unchecked. No generator, descriptor, route, UI, parser, preview or confirmation implementation.

## Baseline and migration boundary

- Source checkout at dispatch: `main`, `a981954b2c7063595857d145c231a3b40ad448e3`; direct-main work was explicitly requested.
- Source baseline: migrations 203/205 own immutable unique import codes; 206 owns revision/review/pair tables and lifecycle generations; 207 keeps internal-table RLS/service-role inspection; 208 owns legacy published reader and manager publication; 210 permits reviewed draft hashes. Last numbered source migration was 231; 232 was unused.
- Added [232_add_accession_template_snapshot.sql](../../../supabase/migrations/232_add_accession_template_snapshot.sql). Historical migrations remain unchanged; unknown applied status is treated as applied. No persistent database was inspected or operated. Runtime baseline remains unverified; the new migration validates required schema, uniqueness and closed catalog grants/RLS before creation and verifies resulting function security afterward.
- New RPC is read-only `STABLE SECURITY DEFINER`, owned by postgres, with `search_path = public, pg_temp`. Only authenticated receives EXECUTE; PUBLIC/anon/service_role are explicitly revoked. Current profile must be active and role analyst; manager/doctor/missing/deleted profiles fail closed. `get_user_role()` itself remains unchanged.
- Catalog/publication APIs, tables, policies, business data and audit triggers remain unchanged. The RPC emits neither business mutations nor fake audit events, and returns no client PII. No service-role application path was added.

## RED → GREEN source checks

1. At 06:37 UTC, before migration implementation:
   `rtk npm run test:run -- tests/accession-template-snapshot-migration.test.ts` → exit **1**, **6 failed / 1 passed**. Missing 232/RPC caused expected baseline, authorization, single-statement authority, generation, shape and readiness failures; historical migration hashes passed.
2. At 06:41 UTC, active-profile regression added before its guard:
   same command → exit **1**, **1 failed / 7 passed**, because no `public.users` active-caller predicate existed. This guards the existing helper's ability to return analyst for a soft-deleted profile.
3. After the narrow guard, focused source contracts:
   `rtk npm run test:run -- tests/accession-template-snapshot-migration.test.ts tests/assay-sample-type-catalog-rpc-migration.test.ts tests/assay-sample-type-catalog-stale-state-migration.test.ts tests/assay-sample-type-catalog-review-hash-migration.test.ts tests/assay-sample-type-enforcement-migration.test.ts` → exit **0**, **30/30 PASS, 5 files**.
4. `rtk npm run lint -- tests/accession-template-snapshot-migration.test.ts` → exit **0**.
5. `rtk npm run typecheck` → exit **0**.
6. `rtk proxy openspec validate add-versioned-accession-template --strict` → exit **0**, valid.

These Vitest checks inspect SQL source and historical hashes; they do **not** execute PostgreSQL or prove deployed authorization/RLS/concurrency.

Root independently reviewed the migration, regression fixture and tracking diff, then reran the same five suites (**30/30 PASS**), scoped ESLint, typecheck, strict OpenSpec with `--no-interactive`, and `git diff --check`; all exited **0**. Separate spec and code-quality review found no remaining issues. The active-profile guard came from source review of the existing soft-delete/Auth-ban boundary; no shared auth helper was changed.

## Phase 2 snapshot interface

Zero-argument RPC: `public.get_accession_template_snapshot() RETURNS JSONB`.

```ts
{
  revisionId: string // canonical revision UUID
  revisionNumber: string // positive ASCII decimal BIGINT, no leading zero
  sampleTypes: Array<{
    id: string // canonical UUID
    importCode: string // LM-000001 format
    name: string
    compatibilityGeneration: string // positive decimal BIGINT
  }>
  assays: Array<{
    id: string // canonical UUID
    importCode: string // CT-000001 format
    name: string
    methodName: string | null
    compatibilityGeneration: string // positive decimal BIGINT
  }>
  pairs: Array<{ sampleTypeId: string; assayDefinitionId: string }>
}
```

All revision/entities/pairs come from one SQL statement with materialized published-revision/eligible-pair CTEs. Pairs require active entities, configured review, no removal, and matching current review/assay/sample-type lifecycle generations. Candidate observations never confer authority. Arrays contain only referenced entities; unique codes are schema-owned, pairs deduplicated. Entity arrays sort by import code; pairs by sample-type UUID then assay UUID. Phase 2 must canonicalize its signed digest schema explicitly rather than depending on object property order. Keep BIGINT strings lossless; do not coerce them to JS Number.

Names/method text are the current published reader's display values at that same snapshot. Independent display-label changes remain separate from generation/revision authority. Labels and method text belong in `catalogDigest`; UUID/code/generation/pair/revision authority belongs in `authorityDigest` per approved design.

Authorization failure is SQLSTATE `42501` / `ACCESSION_TEMPLATE_ANALYST_REQUIRED`. Missing published revision or no eligible pair is SQLSTATE `P0001` / `ACCESSION_TEMPLATE_CATALOG_UNAVAILABLE`. Later server download code must translate these to safe Vietnamese messages before returning them to users. No deployed-readiness claim or TS application adapter is introduced in Phase 1.

## Runtime handoff — NOT RUN

[Rollback-only SQL fixture](../../../tests/accession-template-snapshot.test.sql) requires an existing published eligible catalog. It invokes the real RPC using synthetic analyst/manager/doctor/missing/deleted profiles; checks SQL-role grants, internal-table denial, observed catalog/code/UUID/generation/label/method/pair unions and no business/audit writes; injects reversible method-generation drift, sample-type retirement, empty eligible-pair state and no published revision. It never disables triggers or RLS and rolls back fixture changes.

The fixture is **authored, not executed**. It does not seed the complete removed/not-assignable/stale-review/duplicate/orphan matrix or run concurrent publication sessions. Phase 4 must run the fixture, complete that runtime matrix as appropriate and verify concurrency with separate sessions, then run `SELECT * FROM run_security_tests();`. Do not label observed-catalog or source checks as those runtime proofs.

After explicit operation-specific authorization, use the home-server checkout `/opt/lims-lite` via `ssh -o BatchMode=yes khoa-xn-cdc@100.93.19.42` and `sudo -n docker exec ... lims-postgres psql -v ON_ERROR_STOP=1` to apply the committed new migration and execute the fixture/security tests. Migration 232 is **unapplied** by this session. No SSH/DB/container/deploy operation occurred, and signing configuration/deployed download/restart/no-retention checks remain Phase 4 gates.
