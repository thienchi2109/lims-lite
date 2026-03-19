## 1. URL and Query Contract
- [ ] 1.1 Extend sample list params/types to support `scope=active|all`.
- [ ] 1.2 Define default URL behavior for `/samples` when `scope` is absent.
- [ ] 1.3 Preserve explicit `status` filter precedence over `scope`.

## 2. Samples Workspace UX
- [ ] 2.1 Add a visible `Hiển thị tất cả` control to the samples toolbar.
- [ ] 2.2 Add a clear indication that completed samples are hidden by default in active scope.
- [ ] 2.3 Define reset behavior so the workspace returns to the active default.

## 3. Server Query Behavior
- [ ] 3.1 Apply `status != 'completed'` only when no explicit status filter is selected and scope is active.
- [ ] 3.2 Preserve existing status-specific filtering and pagination behavior.

## 4. Verification
- [ ] 4.1 Verify default `/samples` loads without completed samples.
- [ ] 4.2 Verify `Hiển thị tất cả` fetches the full dataset.
- [ ] 4.3 Verify `status=completed` still works and overrides the default active scope.
- [ ] 4.4 Verify refresh/share/bookmark behavior remains stable via URL state.
