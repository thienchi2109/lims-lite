## Context

`assay_definitions.normal_range` already exists and `fetchTestResults()` already maps it into `CoAData.results[].normal_range` for CoA rendering. The missing part is assay master-data maintenance: managers can create/edit assay names, specialties, method text, units, validation rules, and confidentiality, but there is no UI or payload path for reference range text.

Assay definition reads currently flow through `get_assay_definitions` and `get_assay_definition_by_id` RPCs, then through `src/app/actions/assay-queries.ts`. Writes flow from `AssayDefinitionDialog` through `useAssayDefinitionForm`, `src/lib/api-client.ts`, `/api/client-actions`, and `src/app/actions/assay-mutations.ts`.

## Goals / Non-Goals

**Goals:**

- Let managers add, edit, view, and clear an optional clinical reference range for an assay definition.
- Keep the MVP model as free-form multi-line text stored in `assay_definitions.normal_range`.
- Ensure future CoA generation and regeneration naturally use the current value through the existing CoA data flow.
- Preserve manager-only mutation authorization, RLS expectations, auditability, and Vietnamese UI copy.

**Non-Goals:**

- Do not backfill or mutate already generated CoA HTML files.
- Do not introduce structured reference-range rules by sex, age, specimen type, or method in this change.
- Do not change CoA template rendering beyond relying on the existing `normal_range` output.
- Do not create a separate reference-range management page or inline table editor.

## Decisions

### Use the existing assay definition dialog

Add a `Khoảng tham chiếu` textarea to the existing create/edit/view assay dialog. This keeps reference ranges with the assay master-data fields managers already maintain and avoids a separate workflow for an MVP text field.

Alternative considered: inline editing in the assay table. That would make quick edits easier but spreads validation and authorization across another surface. The dialog keeps create/edit/view behavior consistent.

### Store optional free-form text on `assay_definitions.normal_range`

Keep the Hybrid path: use the existing nullable `normal_range` column for now and treat it as display text. Preserve line breaks so entries like sex-specific ranges remain readable on CoA.

Alternative considered: introduce an `assay_reference_ranges` table now. That is better for future clinical rule selection but adds scope around method/sex/age precedence and CoA range selection that the current need does not require.

### Clear by saving blank text

Normalize textarea input with `trim()`. If the trimmed value is empty, persist `null`. Do not add a separate delete button for this MVP.

This keeps the UI simple and maps naturally to the nullable column. It also avoids implying that reference-range deletion is a separate destructive operation from editing assay metadata.

### Extend the existing assay CRUD path

Add `normalRange` to the form schema and client payload, translate it to `normal_range` in the client-action bridge, then parse and persist it in assay create/update server actions. Continue using the existing `requireRole('manager')` guard.

The read path must also be updated: both assay RPC return contracts and `assay-queries.ts` mapping need `normal_range`, otherwise edit dialogs cannot initialize with saved values.

### CoA remains generate-time snapshot behavior

Generated CoAs are stored HTML. New and regenerated CoAs will use the current assay `normal_range`; existing stored CoAs remain unchanged.

This matches the audit/compliance model where a generated CoA is an immutable historical record unless explicitly regenerated.

## Risks / Trade-offs

- **RPC contract omission hides saved data** -> Update both `get_assay_definitions` and `get_assay_definition_by_id`, plus TypeScript mapping tests.
- **Free-form text can be inconsistent** -> Use a clear Vietnamese placeholder and keep structured range rules as future scope.
- **Blank payload can be dropped by conditional append logic** -> Ensure the client action can distinguish “field omitted” from “clear this field” by appending `normal_range` when the property exists, including empty string.
- **Stored CoAs do not update after range edits** -> Document and test generate-time behavior; users must regenerate CoA when they intentionally need a new document.
- **Database migration touches SECURITY DEFINER RPCs** -> Preserve existing `search_path`, grants/revokes, and security-impact comments; run security tests after applying.

## Migration Plan

1. Add a migration that recreates the assay definition RPCs with `normal_range` included in the returned row shape.
2. Preserve current grants, revokes, role behavior, and `search_path` patterns.
3. Apply the migration through Docker-backed Postgres in the normal project workflow.
4. Run `SELECT * FROM run_security_tests();`, focused assay tests, typecheck, and relevant UI tests.

Rollback is a follow-up migration that removes `normal_range` from the RPC return contracts only. The underlying column already exists and should remain because CoA rendering depends on it.

## Open Questions

None. The chosen scope is Hybrid text-field management: manager-only, textarea in the assay dialog, blank saves as `NULL`, and no CoA backfill.
