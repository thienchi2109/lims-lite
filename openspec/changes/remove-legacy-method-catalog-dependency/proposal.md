## Why

`relax-assay-method-entry` moves manager assay setup to assay-owned method text, but downstream assignment/result code still carries legacy `methods` / `assay_methods` assumptions. Because the current environment contains test data only, we can plan a dedicated breaking cleanup that removes the old catalog dependency instead of preserving it indefinitely as fallback.

## What Changes

- **BREAKING**: Remove `methods` / `assay_methods` as required runtime dependencies for assay setup, assignment, result display, and result writes.
- Treat `assay_definitions.method_name` as the only configured method source for new and existing assay definitions.
- Migrate or backfill test/demo assay data into `assay_definitions.method_name` before removing legacy relationship usage.
- Remove manager-facing and downstream code paths that select, store, or require `method_id` for assay definitions or sample test assignment.
- Remove or retire legacy method catalog UI/actions/API surfaces after callers are moved away.
- Add database migration safeguards, security-impact notes, and verification for RLS/audit behavior.
- Keep Vietnamese UI labels using `Phương pháp` and avoid reintroducing method catalog management language.

## Capabilities

### New Capabilities

### Modified Capabilities

- `assay-management`: Assay management and downstream assignment/result flows shall no longer depend on the legacy method catalog or `method_id`; method text shall come from `assay_definitions.method_name`.

## Impact

- Affected database objects: `assay_definitions`, legacy `methods` / `assay_methods` references, RPCs that return assay/method data, sample assignment/result write paths, and any migrations needed to retire catalog dependencies.
- Affected app surfaces: manager assay table/dialog, test assignment catalog/grid, sample accession or assignment payloads, result entry/display, CoA/result helpers if they still expect `method_id`.
- Compliance/security: migrations must document security impact, preserve RLS, avoid hard-deleting operational records, and keep mutations auditable. If legacy tables are removed or retired, do so only after test/demo data is migrated and downstream code no longer references them.
- Testing: add focused regression tests for assignment/result flows without `method_id`, database/security tests around migration behavior, then run affected tests, `npm run typecheck`, `npm run lint`, `run_security_tests()`, and OpenSpec validation.
