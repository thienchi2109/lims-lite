## 1. Caller Audit and Test Planning

- [ ] 1.1 Audit all `method_id`, `methods`, `assay_methods`, `getMethods`, and method catalog UI/action references across assignment, result entry, result display, CoA/report helpers, tests, and migrations.
- [ ] 1.2 Identify which references are still runtime dependencies versus historical migrations or compatibility-only tests.
- [ ] 1.3 Define the minimal TDD test set for assignment/result flows that must work with `assay_definitions.method_name` and no catalog method relationship.

## 2. Downstream Method Text Contract

- [ ] 2.1 Add failing focused tests proving sample assignment succeeds when an assay has `method_name` and no `assay_methods` row.
- [ ] 2.2 Add failing focused tests proving result save/display flows show method text without requiring `method_id`.
- [ ] 2.3 Update assignment/result read models, payloads, and UI labels to use method text from assay definitions.
- [ ] 2.4 Remove `methodId` / `method_id` requirements from client-action bridge and downstream write contracts where they only support legacy catalog behavior.

## 3. Legacy Catalog Surface Removal

- [ ] 3.1 Remove or retire dead manager/downstream method catalog UI components and actions after downstream callers no longer use them.
- [ ] 3.2 Remove or update API client functions and server actions that only manage legacy assay-method catalog relationships.
- [ ] 3.3 Update tests and fixtures so new assay/sample/result paths do not create `methods` or `assay_methods` rows unless explicitly testing historical migration behavior.

## 4. Database Migration and Security

- [ ] 4.1 Add a migration that backfills missing `assay_definitions.method_name` from the default or first legacy method relationship, documenting test/demo data assumptions and security impact.
- [ ] 4.2 Remove, deprecate, or isolate legacy method catalog DB dependencies only after app callers are proven removed; document any table left in place as intentionally unused.
- [ ] 4.3 Apply the migration against the Docker-backed database and reload PostgREST schema.
- [ ] 4.4 Run `SELECT * FROM run_security_tests();` and verify affected RPC return shapes no longer require legacy catalog method identifiers.

## 5. Verification and Closeout

- [ ] 5.1 Run focused assignment/result/server-action tests added or affected by this change.
- [ ] 5.2 Run `npm run typecheck`.
- [ ] 5.3 Run `npm run lint`.
- [ ] 5.4 Run `openspec validate remove-legacy-method-catalog-dependency --strict`.
- [ ] 5.5 Commit and push the proposal or implementation branch according to the current workflow.
