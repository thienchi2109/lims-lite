## 1. Database & Security
- [ ] 1.1 Add junction table `assay_methods` with uniqueness + default constraint and updated_at trigger.
- [ ] 1.2 Add RLS policies for authenticated read and manager-only write on `assay_methods`.
- [ ] 1.3 Migrate existing `assay_definitions.method_id` data into junction rows, then drop column safely.

## 2. Backend Actions
- [ ] 2.1 Create server actions for listing, adding, removing, and setting default assay methods with validation and RLS-aware Supabase calls.
- [ ] 2.2 Update assay CRUD actions to remove single method dependency and ensure each assay retains at least one method.
- [ ] 2.3 Update test assignment action to require method selection (default pre-selected) and reject missing method_id.
- [ ] 2.4 Update both `getAssayDefinitions` helpers (assays.ts and samples.ts) and related types to return methods with default flags (no direct `method_id` on assay) and adapt search to many-to-many.
- [ ] 2.5 Update result/test fetchers (`getResultsBySample`, `getSampleTests`) to join method details via `results.method_id` instead of `assay_definitions.method_id`.

## 3. UI & UX
- [ ] 3.1 Update manager assay table to show expandable methods list with add/remove/set-default controls.
- [ ] 3.2 Update assay creation/edit dialogs to manage methods via the junction (no single method field).
- [ ] 3.3 Update test assignment UI to include method dropdown per assay with defaults and duplicate prevention.
- [ ] 3.4 Surface method names in relevant grids/approval views where assay is shown.

## 4. Testing & Data
- [ ] 4.1 Extend seeds/fixtures for assay-method relations (including defaults).
- [ ] 4.2 Update SQL and manual test plans to cover unique default, last-method protection, and assignment with method selection.
- [ ] 4.3 Run/record regression checks after migrations and UI changes.
