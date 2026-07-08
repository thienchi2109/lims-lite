## Context

Assay management currently exposes create/edit/delete behavior for managers, with create mode requiring an initial method selected from existing `methods`. Edit mode renders `AssayMethodsList`, which lets managers manage catalog-linked method relationships for the assay. Both surfaces reinforce the catalog-bound model from the older `add-assay-method-m2m` proposal.

The desired workflow is narrower and simpler: while managing an assay, a manager can type any method name. Existing method names may help as autocomplete suggestions, but they must not constrain what can be saved. Existing data in this environment is demo data and does not need migration preservation.

There is also a UI gap: the assay table has edit/delete actions, but no action to open a detail modal. The detail modal must reuse the edit modal/form structure by extracting shared components, not by duplicating a second detail-only implementation.

## Goals / Non-Goals

**Goals:**

- Make `assay_definitions.method_name` the source of truth for the assay's configured method.
- Let managers create and edit assays with a free-form Vietnamese `Phương pháp` field.
- Provide autocomplete suggestions from existing assay method text and, optionally, existing catalog `methods.name`.
- Add a detail action in the manager assay table that opens the same dialog shell/form content in read-only mode.
- Keep manager writes role-gated, auditable, RLS-compliant, and localized.
- Keep touched files within the repo's focused-file size expectations by extracting shared form/detail components.

**Non-Goals:**

- Do not build a standalone UI for managing the `methods` catalog.
- Do not preserve or backfill demo data exactly.
- Do not implement multi-method-per-assay management in this change.
- Do not keep `method_id` as a required save-time dependency for new assay definitions.
- Do not create a separate detail modal with duplicated field markup.

## Decisions

### Decision 1: Store method text directly on assay definitions

Add `method_name text` to `assay_definitions` and update assay RPCs/actions/types to read and write that field. This makes the manager's typed value authoritative and removes the need to create or choose a catalog method before saving an assay.

The create dialog's current `methodId` select (`Phương pháp ban đầu`) and the edit dialog's current `AssayMethodsList` shall both be replaced by the same shared `Phương pháp` text field. Create mode writes the initial `assay_definitions.method_name`; edit mode updates `assay_definitions.method_name`; neither mode adds/removes rows in `assay_methods`.

Alternatives considered:

- **Keep `assay_methods` as the source of truth:** preserves multi-method semantics, but keeps the exact friction the manager wants to remove.
- **Create new `methods` records on the fly:** avoids missing catalog records, but silently turns every typo into managed catalog data and still implies a catalog-management workflow.

### Decision 2: Use autocomplete as convenience only

The method field shall be an input/combobox where suggestions can come from distinct `assay_definitions.method_name` values and legacy `methods.name` values. Selecting a suggestion only fills text; save behavior stores text and does not require `method_id`.

Alternatives considered:

- **Plain text input only:** simplest, but loses fast entry for common methods.
- **Select with "custom" option:** still frames the catalog as primary and adds unnecessary state.

### Decision 3: Migrate downstream method display away from required method FK

New assay assignment/result flows must not fail because no `method_id` exists. New rows that display a method should use the assay method text or a result-level method snapshot if the implementation adds one. Existing demo result rows can be reset or left best-effort during local migration.

Rationale:

- The schema should not contain a new free-text assay method while assignment still requires a catalog method FK.
- This keeps future CoA/result views interpretable without requiring catalog records.

### Decision 4: Reuse the edit dialog for details via shared form content

Extract the field body from `AssayDefinitionDialog` into one shared component used by create, edit, and view modes. The dialog shell owns mode-specific title, description, footer, submit behavior, and close behavior; the shared body owns field layout, method input/combobox rendering, validation-message placement, and read-only rendering.

The extracted shared component should own the method field so create, edit, and view modes display the same `Phương pháp` value consistently. Create and edit use the editable input/combobox; view uses the same field layout in read-only form. Any legacy `AssayMethodsList` UI stays out of this shared component for the new manager assay workflow.

Alternatives considered:

- **Separate create/edit/detail field markup:** faster initially, but duplicates field layout and will drift across modal modes.
- **Inline expandable row:** less modal work, but harder to reuse edit form fields and increases table complexity.

## Risks / Trade-offs

- **Risk: active OpenSpec `add-assay-method-m2m` conflicts with this direction** -> Treat this change as superseding the catalog-required parts of that proposal before implementation.
- **Risk: removing `method_id` assumptions breaks sample assignment/result display** -> Include focused backend and UI regression tests around assay create/edit, assigning tests, and displaying method text.
- **Risk: autocomplete suggestions imply catalog management** -> UI copy must frame suggestions as suggestions only; no separate method management actions.
- **Risk: component extraction grows already-large table/dialog files** -> Move shared form sections into focused files and keep `AssayDefinitionsTable` below the repo line-count target.

## Migration Plan

### Phase 1 - Dialog consolidation and detail action

- Extract shared assay field content from `AssayDefinitionDialog`.
- Add a `view` mode and `Xem chi tiết chỉ tiêu` row action.
- Keep current method persistence untouched in this phase to avoid schema/UI coupling.

### Phase 2 - Method text database/backend contract

- Add `method_name` to `assay_definitions` and update comments/RPCs to return it.
- Update schemas/actions/types to accept method text.
- Add method-name suggestion lookup from existing assay method text and optional legacy catalog values.
- Apply migration to the Docker-backed database and run `SELECT * FROM run_security_tests();`.

### Phase 3 - Free-form method UI

- Replace the create modal's catalog select and the edit modal's `AssayMethodsList` with the shared `Phương pháp` input/combobox.
- Keep `methods`/`assay_methods` out of the manager assay workflow except as suggestion/compatibility inputs.

### Phase 4 - Downstream cleanup and verification

- Stop requiring `method_id` in new assignment/result paths that use newly created assays.
- Surface assay method text in result-oriented displays.
- Run focused SQL/app tests, `npm run typecheck`, and `npm run lint`.

Rollback for local MVP/demo data can be forward-fix only: restore the prior migration snapshot or re-seed demo data if needed.

## Open Questions

- Should `method_name` be required for every assay immediately, or nullable for a short transition while demo records are reset? Recommended: require it at the form/action level, and make the database `NOT NULL` only if the local migration resets demo records cleanly.
