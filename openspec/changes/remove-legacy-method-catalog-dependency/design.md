## Context

`relax-assay-method-entry` introduces assay-owned `assay_definitions.method_name` and removes catalog-bound method controls from the manager create/edit workflow. The remaining risk is downstream code that still treats `method_id`, `methods`, or `assay_methods` as required for assignment, result entry, or result display.

The local environment currently contains test/demo data only, so this change can plan a breaking cleanup instead of preserving legacy catalog compatibility forever. The cleanup still needs to be deploy-safe within the repo: all callers must move first, database changes must be auditable and RLS-safe, and schema cache reload/security tests must run after migration.

## Goals / Non-Goals

**Goals:**

- Make `assay_definitions.method_name` the only configured assay method value used by manager assay management and downstream assignment/result flows.
- Remove application code that requires `method_id` for assay definition create/edit, sample test assignment, result entry, result display, or CoA/result helper output.
- Retire legacy method catalog UI/actions/API surfaces after all callers are moved away.
- Migrate test/demo data from legacy relationships into `assay_definitions.method_name` before removing or ignoring legacy dependencies.
- Keep all UI copy Vietnamese and use `Phương pháp` for method text.
- Preserve audit/RLS posture and run mandatory Docker-backed security verification after DB changes.

**Non-Goals:**

- Do not preserve historical production method catalog data; current data is test/demo only.
- Do not introduce multi-method-per-assay management.
- Do not add a new standalone method catalog replacement.
- Do not bypass existing Server Action / API client mutation boundaries.

## Decisions

### Decision 1: Remove dependency, not just fallback

Downstream flows should read method text from `assay_definitions.method_name` directly and stop requiring `method_id`. Assignment payloads and result-oriented view models should carry method text, not a catalog method identifier.

Alternatives considered:

- **Keep fallback indefinitely:** lower migration risk, but keeps the old model alive and makes future cleanup harder.
- **Drop tables first:** faster schema cleanup, but risks runtime failures before all callers are moved.

### Decision 2: Data migration before caller removal

Before removing legacy assumptions, add a migration step that backfills any missing `assay_definitions.method_name` from the current default/first legacy method relationship. Because data is test/demo only, exact historical preservation is not required, but the migration should keep the app usable after deploy.

Alternatives considered:

- **No backfill:** simpler, but existing test fixtures may become blank and hide regressions.
- **Full preservation of all method catalog rows:** unnecessary because multi-method semantics are out of scope.

### Decision 3: Retire legacy surfaces in phases inside the change

Implementation should first prove assignment/result tests pass without `method_id`, then remove dead UI/actions/client methods and finally remove or deprecate DB objects if no caller remains. If a table cannot be dropped safely due to migration dependencies, keep it unused and document the follow-up instead of forcing a risky drop.

Alternatives considered:

- **Single migration drop:** clean end state, but too brittle without caller proof.
- **App-only cleanup:** avoids SQL risk, but leaves misleading catalog surfaces in the data model.

## Risks / Trade-offs

- **Risk: hidden callers still require `method_id`** -> Use code graph/search plus focused tests around accession, assignment, result entry/display, and CoA helpers before removing DB objects.
- **Risk: migration breaks RLS or audit expectations** -> Document security impact in migration, avoid hard-deleting operational records, run `run_security_tests()`, and reload PostgREST schema.
- **Risk: current `relax-assay-method-entry` Phase 4 overlaps this cleanup** -> Finish or coordinate Phase 4 first so this change starts from a known method-text downstream baseline.
- **Risk: dropping legacy tables is more disruptive than expected** -> Treat table drops as conditional on proving there are no runtime references; otherwise mark catalog tables deprecated/unused in this change and file a narrower drop follow-up.

## Migration Plan

1. Audit all `method_id`, `methods`, and `assay_methods` references in assignment/result/codegen/test fixtures.
2. Add failing tests showing assignment/result flows work with assay definitions that have `method_name` and no catalog method relationship.
3. Move read/write contracts to method text.
4. Backfill `assay_definitions.method_name` from legacy relationships where missing.
5. Remove dead catalog UI/actions/client functions and update fixtures.
6. Remove, deprecate, or isolate legacy DB objects only after caller removal is verified.
7. Run focused tests, `npm run typecheck`, `npm run lint`, Docker-backed migration/security tests, PostgREST schema reload, and OpenSpec validation.

## Open Questions

- Should implementation drop `methods` / `assay_methods` tables in the same change if caller audit is clean, or leave them deprecated for one more release boundary?
- Should sample assignment records store a method text snapshot, or always resolve method text through the linked assay definition at display time?
