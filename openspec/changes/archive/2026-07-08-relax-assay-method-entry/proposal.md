## Why

Managers cannot freely update the testing method for an assay because assay management currently treats methods as catalog records selected through `method_id`/`assay_methods`. This blocks the desired workflow where the manager edits the method text directly while managing the assay.

## What Changes

- Split implementation into small deployable phases: first consolidate the assay dialog/detail UI, then introduce the text-based method contract, then remove legacy catalog-bound UI paths and verify downstream usage.
- **BREAKING**: Treat the assay method as editable text owned by `assay_definitions`, not as a required FK relationship to `methods`.
- Add a `method_name` field to assay definitions and use it in manager assay create/edit/detail flows.
- Replace the required create-mode method select and the edit-mode method management list with one Vietnamese free-text `Phương pháp` field that can show suggestions from existing method names, but saves the typed value as text.
- Keep the existing `methods` catalog only as an optional suggestion source; do not add a separate UI for managing method catalog records.
- Add a manager action button to view assay details.
- Consolidate create, edit, and detail modal field logic by extracting a shared assay form/detail component; render it editable for create/edit and read-only for detail instead of maintaining separate modal field implementations.
- Update assay queries, mutations, assignment, and display surfaces that currently depend on `method_id`/`assay_methods` so new assay data remains usable end-to-end.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `assay-management`: Manager assay management shall support free-form method text with autocomplete suggestions and a shared read-only detail dialog action.

## Impact

- Affected specs: `assay-management`.
- Affected database: Supabase migration for `assay_definitions.method_name`, related RPCs, and any new/changed RLS-safe access paths. Existing demo data does not need preservation, but migration must remain auditable and pass `run_security_tests()`.
- Affected code: assay schemas/types, `assay-queries`, `assay-mutations`, assay lookup suggestions, sample test assignment/read models, result method display, `AssayDefinitionDialog`, `AssayMethodsList` removal from this workflow, `AssayDefinitionsTable`, and focused component/action tests.
- UI localization: all labels, placeholders, tooltips, buttons, and validation messages remain Vietnamese.
- Compliance: manager writes remain role-gated; mutation audit/RLS behavior must not be weakened.

## Suggested Phasing

1. **Phase 1 - Dialog consolidation and detail action:** extract shared assay field content, add read-only `view` mode, and add `Xem chi tiết chỉ tiêu` action without changing the database contract.
2. **Phase 2 - Method text database/backend contract:** add `assay_definitions.method_name`, update RPCs/actions/types/suggestion lookup, and keep legacy method fields only as compatibility input.
3. **Phase 3 - Free-form method UI:** switch create/edit from catalog controls to the shared `Phương pháp` input/combobox and remove `AssayMethodsList` from this workflow.
4. **Phase 4 - Downstream cleanup and verification:** update sample assignment/result display paths that require `method_id`, run security checks, focused tests, typecheck, and lint.
