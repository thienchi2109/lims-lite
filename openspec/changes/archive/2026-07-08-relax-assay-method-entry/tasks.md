## 1. Phase 1 - Dialog Consolidation and Detail Action

- [x] 1.1 Extract the current assay dialog field body into a shared component used by create, edit, and view modes.
- [x] 1.2 Make the shared component own field layout and read-only rendering for name, specialty, units, confidentiality, validation rules, and existing method display.
- [x] 1.3 Add a `view`/detail mode to the existing assay dialog shell instead of creating a separate detail modal.
- [x] 1.4 Add a row action button with an accessible Vietnamese label such as `Xem chi tiết chỉ tiêu` that opens the shared dialog in read-only mode.
- [x] 1.5 Add focused component tests proving create/edit/detail share the field component and detail mode exposes no submit controls.

## 2. Phase 2 - Method Text Database and Backend Contract

- [x] 2.1 Add a Supabase migration for `assay_definitions.method_name` with comments documenting that method text is assay-owned and manager-managed.
- [x] 2.2 Update `get_assay_definitions` and `get_assay_definition_by_id` RPCs to return `method_name` and remove required dependence on `assay_methods` for new assay management.
- [x] 2.3 Update Zod schemas and TypeScript assay types to use `methodName`/`method_name` instead of required `methodId` for assay create/edit.
- [x] 2.4 Update `createAssayDefinition` and `updateAssayDefinition` to validate and persist method text under manager-only authorization.
- [x] 2.5 Add or update a lookup action that returns distinct method-name suggestions from assay definitions and optionally legacy method catalog names.
- [x] 2.6 Apply the migration against the Docker-backed database and run `SELECT * FROM run_security_tests();`.

## 3. Phase 3 - Free-Form Method UI

- [x] 3.1 Replace the create dialog's current `Phương pháp ban đầu` select with the shared free-text `Phương pháp` input/combobox that accepts arbitrary text and shows suggestions.
- [x] 3.2 Replace the edit dialog's catalog method management area with the same shared editable `Phương pháp` input/combobox and route saves through `assay_definitions.method_name`.
- [x] 3.3 Show method text consistently in the manager assay table, create/edit/detail dialogs, and validation errors using Vietnamese labels.
- [x] 3.4 Remove edit-mode `AssayMethodsList` from the manager assay dialog for this workflow.
- [x] 3.5 Add focused component tests for arbitrary method text entry, suggestion selection, and persisted table display.

## 4. Phase 4 - Downstream Cleanup and Verification

- [x] 4.1 Update sample assignment/result read and write paths that assume a required `method_id` so new assay data with method text remains usable.
- [x] 4.2 Add focused server/action tests for creating and updating assay method text without `method_id`.
- [x] 4.3 Add focused downstream tests proving newly created assays display method text in assignment/result-oriented UI.
- [x] 4.4 Run focused affected tests, `npm run typecheck`, and `npm run lint`.
- [x] 4.5 Validate the OpenSpec change with `openspec validate relax-assay-method-entry --strict`.
