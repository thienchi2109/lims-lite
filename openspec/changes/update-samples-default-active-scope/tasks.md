## 1. URL and Query Contract
- [ ] 1.1 Extend sample list params/types to support `scope=active|all`.
- [ ] 1.2 Treat missing `scope` as the default active behavior for `/samples`.
- [ ] 1.3 Preserve explicit `status` filter precedence over `scope`, including `status=completed`.

## 2. Samples Workspace UX
- [ ] 2.1 Add a visible `Hiển thị tất cả` control to the samples toolbar.
- [ ] 2.2 Keep the scope control visible and URL-backed while a concrete `status` filter is active.
- [ ] 2.3 Add a clear indication in the active-filter row that completed samples are hidden by default in active scope.
- [ ] 2.4 Define reset behavior so the workspace removes `scope` and returns to the implicit active default while preserving sort and page size.

## 3. Server Query Behavior
- [ ] 3.1 Apply `status != 'completed'` only when no explicit status filter is selected and scope is active.
- [ ] 3.2 Preserve existing status-specific filtering and pagination behavior.
- [ ] 3.3 Add targeted regression coverage for default active scope, `scope=all`, and explicit status override behavior.

## 4. Verification
- [ ] 4.1 Run targeted tests covering default `/samples`, `scope=all`, `status=completed`, and reset behavior.
- [ ] 4.2 Run `npm run typecheck`.
- [ ] 4.3 Verify default `/samples` loads without completed samples.
- [ ] 4.4 Verify `Hiển thị tất cả` fetches the full dataset.
- [ ] 4.5 Verify `status=completed` still works and overrides the default active scope.
- [ ] 4.6 Verify refresh/share/bookmark behavior remains stable via URL state.
