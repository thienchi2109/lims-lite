## Why

Assay definitions already store `normal_range` and CoA generation already renders it, but managers do not have a UI to maintain that value. This blocks new CoAs from showing current clinical reference ranges unless data is changed directly in the database.

## What Changes

- Add manager-only create/edit support for assay reference range text in the existing assay definition dialog.
- Show the reference range in assay view/detail context so managers can verify what will print on future CoAs.
- Treat the reference range as optional free-form multi-line text for this MVP; blank input clears the stored value.
- Extend assay create/update payloads, server actions, types, and assay-definition RPC read contracts to carry `normal_range`.
- Preserve existing CoA rendering behavior: only newly generated or regenerated CoAs use the current reference range; existing stored CoA HTML is not backfilled.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `assay-management`: managers can maintain optional assay reference range text used by future CoA generation.

## Impact

- Affected specs: `assay-management`.
- Affected UI: manager assay definition dialog and assay detail/view surfaces; all new copy must be Vietnamese.
- Affected code: assay form hook/types, assay dialog fields, client action bridge, `src/lib/api-client.ts`, assay mutation/query actions, and tests.
- Affected database: migration to update `get_assay_definitions` and `get_assay_definition_by_id` RPC return contracts with `normal_range`; preserve existing RLS/security-definer/search-path patterns and document security impact.
- Compliance/audit impact: manager-only assay master-data mutation remains behind existing authorization and database audit behavior; no hard deletes and no mutation of historical CoA HTML.
