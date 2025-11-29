## Why
Assays currently store a single `method_id`, preventing labs from pairing one assay with multiple valid methods (e.g., Glucose via HPLC or Enzymatic). This misrepresents lab workflows and blocks assignment UIs from letting managers pick a method per assay.

## What Changes
- Introduce many-to-many assay-method relationship with junction table and default method constraint.
- Update manager UI/actions to add/remove methods per assay, set a single default, and prevent removing the last method.
- Require method selection during test assignment and surface method names in manager/analyst flows (using the selected result.method_id, not assay defaults).
- Refactor assay/test queries and types to return per-assay method lists (no direct method_id on assay) and update results/test fetchers to join method via results.method_id.

## Impact
- Affected specs: assay-management (new capability details)
- Affected code: Supabase migrations/RLS; server actions for assay management and test assignment; manager UI for assays and assignments; seeds/tests for assays/methods.
