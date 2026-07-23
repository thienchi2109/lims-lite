# User Action Column Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use `superpowers:test-driven-development` during implementation and `superpowers:verification-before-completion` before committing. Keep each RED-GREEN-REFACTOR cycle observable in command output.

**Goal:** Simplify the user-management action column while preserving all existing permissions and replace browser confirmation/alert APIs with an accessible shadcn confirmation dialog and Sonner toasts.

**Architecture:** Extract row-level presentation into a user-specific action component and place the asynchronous soft-delete workflow in a controlled delete dialog. `UserListTable` continues to calculate permissions, own selected-user state and retain the originating overflow trigger so focus can be restored after the dialog closes; existing client API calls and backend behavior remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, shadcn/Radix Dropdown Menu, Tooltip and Alert Dialog, Sonner, Vitest, Testing Library.

---

## Locked Scope

- UI/client changes only.
- Do not modify `src/lib/api-client.ts`, `src/app/actions/users.ts`, Supabase migrations, RLS, database functions, or schemas.
- Preserve the current soft-delete and Auth-ban behavior behind `deleteUserClient`.
- Preserve the current `isRestrictedManagerRow` and `canConfigureOtpEmail` rules.
- Keep the existing edit, OTP and delete API contracts unchanged.
- Do not redesign the add/edit user dialogs or OTP dialog.

## Final UI Contract

### Action column

- Use a fixed `104px` action column containing:
  - A directly visible `32x32` edit icon button.
  - A `32x32` overflow button using `MoreHorizontal`.
- Use neutral colors for utility actions. Red appears only on the destructive menu item.
- The header and body cells are sticky on the right with a left divider and row-hover-compatible background.
- Remove the repeated manager restriction paragraph from table rows.

### Overflow menu

- Trigger accessible name: `Mở menu thao tác cho <username>`.
- Menu width: approximately `224px`, aligned to the right edge of the trigger.
- Show `Cấu hình email OTP` only when the existing `canConfigureOtpEmail` condition is true.
- Show a separator after OTP only when OTP is present.
- Always show `Xóa người dùng`; use the destructive menu-item variant.
- For a protected manager row:
  - Keep OTP available according to the existing rule.
  - Disable `Xóa người dùng`.
  - Show `Tài khoản quản lý khác được bảo vệ.` as compact, non-interactive menu text.

### Restricted edit action

- Accessible name remains `Sửa người dùng <username>`.
- Use `aria-disabled="true"` instead of native `disabled` so the control remains focusable.
- Guard the click handler so mouse, Enter and Space cannot open the edit dialog.
- Add `aria-disabled:cursor-not-allowed aria-disabled:opacity-50`; do not use `pointer-events-none`, because hover and focus must continue to trigger the tooltip.
- Tooltip text: `Không thể sửa tài khoản quản lý khác.`
- Normal rows use tooltip text `Sửa người dùng`.

### Delete confirmation

- Selecting `Xóa người dùng` opens a controlled shadcn `AlertDialog`.
- Title: `Xác nhận xóa người dùng`.
- Description:
  - `Tài khoản <full_name> (<username>) sẽ bị vô hiệu hóa, không thể đăng nhập và dữ liệu lịch sử vẫn được giữ lại.`
- Buttons: `Hủy` and `Xóa người dùng`.
- Render `Hủy` with `AlertDialogCancel` so Radix identifies the safe initial focus target.
- During submission:
  - Disable both buttons.
  - Show a spinner and `Đang xóa...` on the destructive button.
  - Ignore overlay, Escape or controlled close attempts until the request settles.
- Use a regular destructive `Button` inside `AlertDialogFooter`, not the Radix action that closes immediately.
- Pass the originating overflow button to the dialog and use `AlertDialogContent.onCloseAutoFocus` to return focus after cancel, success or an allowed close.
- Success:
  - Show `Đã xóa người dùng <username>` with `toast.success`.
  - Close the dialog.
  - Call `router.refresh()`.
- API result error or rejected promise:
  - Show the original error when available, otherwise `Không thể xóa người dùng`.
  - Keep the dialog open for retry.
- Remove all `window.confirm` and `window.alert` usage from this flow.

## Task 1: RED - Lock the compact action contract

**Create:**
- `src/components/__tests__/user-list-table-actions.test.tsx`

**Modify:**
- `src/components/__tests__/user-management-manager-permissions.test.tsx` to move the existing protected-manager row test into the focused action test file.

- [ ] Keep the existing form and signature tests in `user-management-manager-permissions.test.tsx`; do not expand that file with the new menu/dialog matrix.
- [ ] Add a local render helper to create `UserListTable` with stable defaults.
- [ ] Use `userEvent` and the real dropdown/tooltip primitives.
- [ ] Add local JSDOM support used by Radix: `ResizeObserver`, `Element.prototype.hasPointerCapture`, `setPointerCapture` and `releasePointerCapture`.
- [ ] Use raw DOM assertions such as `hasAttribute`, `textContent`, `document.activeElement` and the native `disabled` property; do not assume global `jest-dom` matchers.
- [ ] Make the `UserDialog` and `ManagerOtpEmailDialog` test mocks expose the selected username so callbacks can be verified through visible behavior.
- [ ] Add a test for a normal analyst:
  - Direct edit and overflow buttons exist.
  - Direct OTP and delete buttons do not exist before opening the menu.
  - Opening the menu reveals OTP and delete.
  - Selecting OTP opens the existing OTP dialog for the correct user.
- [ ] Add a test for a role that cannot configure OTP:
  - Menu contains delete.
  - Menu does not contain OTP.
- [ ] Update the protected-manager test:
  - The old inline warning is absent.
  - Edit has `aria-disabled="true"`.
  - Activating edit does not open `UserDialog`.
  - Focusing or hovering edit reveals the restriction tooltip.
  - Delete is disabled in the menu.
  - The compact protection note is visible after opening the menu.

Run:

```bash
rtk npm run test:run -- \
  src/components/__tests__/user-management-manager-permissions.test.tsx \
  src/components/__tests__/user-list-table-actions.test.tsx
```

Expected RED:

- No overflow trigger exists.
- OTP and delete are still rendered directly.
- The old manager warning is still rendered inline.
- Restricted edit uses native `disabled` and has no tooltip.

## Task 2: GREEN - Extract and wire row actions

**Create:**
- `src/components/user-row-actions.tsx`

**Modify:**
- `src/components/user-list-table.tsx`

- [ ] Add an internal `UserRowActions` component with these props:
  - `user`
  - `isRestrictedManagerRow`
  - `canConfigureOtpEmail`
  - `onEdit`
  - `onConfigureOtpEmail`
  - `onRequestDelete(user, returnFocusTarget)`
- [ ] Implement the direct edit button, tooltip and overflow menu exactly as defined in the final UI contract.
- [ ] Keep a ref to the row's overflow trigger and pass its current button element when delete is requested.
- [ ] Keep this component presentation-only; it must not import `deleteUserClient` or own dialog state.
- [ ] Replace the existing three-button block and inline warning in `UserListTable`.
- [ ] Pass the existing permission booleans and state setters into `UserRowActions`.
- [ ] Run the Task 1 test until GREEN.

## Task 3: RED - Lock the confirmation and toast workflow

**Create:**
- `src/components/__tests__/user-list-table-delete-dialog.test.tsx`

- [ ] Test through the existing `UserListTable` export so the test file can be written before `DeleteUserDialog` exists; RED must be assertion failures, never a missing-import or test-setup error.
- [ ] Add the same local Radix/JSDOM polyfills and raw DOM assertion policy used by the action test.
- [ ] Mock `deleteUserClient`, `toast.success`, `toast.error`, `router.refresh` and `router.replace` with inspectable functions.
- [ ] In `beforeEach`, set `deleteUserClient` to `mockResolvedValue({ success: true })` so the legacy `.catch()` path returns a Promise; override this default only in deferred, API-error and rejection scenarios.
- [ ] Before each RED test, stub `window.confirm` to return `true` and `window.alert` as a no-op so the legacy code reaches its API/error branches; restore the globals after each test.
- [ ] Add a test proving that selecting delete opens the confirmation dialog without calling the API.
- [ ] Add a cancel test proving that the dialog closes without calling the API.
- [ ] Add a successful deletion test:
  - Confirm calls `deleteUserClient` once with the selected user ID.
  - Pending controls are disabled and show `Đang xóa...`.
  - Success toast contains the username.
  - Dialog closes and `router.refresh()` runs.
- [ ] Use a deferred API promise to prove that while pending:
  - Escape and outside interaction do not close the dialog.
  - A second activation cannot submit again.
  - The API remains called exactly once.
- [ ] Add an API-result-error test:
  - Error toast displays the returned error.
  - Dialog remains open.
  - `router.refresh()` does not run.
- [ ] Add a rejected-promise test:
  - Error toast uses the thrown message or fallback.
  - Dialog remains open for retry.
- [ ] Capture the overflow trigger before opening the menu and verify focus returns to it after cancel and successful deletion.
- [ ] Assert that neither stubbed `window.confirm` nor `window.alert` is invoked by the final UI; this assertion is expected to fail against the legacy implementation during RED.

Run:

```bash
rtk npm run test:run -- src/components/__tests__/user-list-table-delete-dialog.test.tsx
```

Expected RED:

- The browser confirm runs instead of an accessible dialog.
- Errors use `window.alert`.
- There is no success toast or pending dialog state.

## Task 4: GREEN - Add the controlled delete dialog

**Create:**
- `src/components/delete-user-dialog.tsx`

**Modify:**
- `src/components/user-list-table.tsx`

- [ ] Add a selected-delete state to `UserListTable` containing both `user` and `returnFocusTarget: HTMLButtonElement | null`.
- [ ] Make `onRequestDelete` populate that state; render `DeleteUserDialog` only when a user is selected.
- [ ] Give `DeleteUserDialog` controlled `open`, `user`, `returnFocusTarget` and `onOpenChange` props.
- [ ] Move `deleteUserClient`, result-error extraction, toast handling and refresh behavior out of `UserListTable` into the dialog.
- [ ] Use `useTransition` for pending state, matching existing destructive-dialog patterns in the repo.
- [ ] Route `AlertDialog` open changes through a pending guard so Escape/outside close requests are ignored until the request settles.
- [ ] Use `AlertDialogCancel` for cancel and `AlertDialogContent.onCloseAutoFocus` with `event.preventDefault()` plus `returnFocusTarget?.focus()`.
- [ ] Close and clear the selected user only after cancel or successful deletion.
- [ ] Keep the dialog open after all failure paths.
- [ ] Run the Task 3 tests until GREEN.

## Task 5: REFACTOR - Stabilize layout and ownership

**Modify:**
- `src/components/user-list-table.tsx`
- `src/components/user-row-actions.tsx`

- [ ] Apply `group` to data rows so the sticky cell preserves row hover feedback.
- [ ] Apply sticky header/body classes:
  - Header: right-sticky, `104px`, left border, `bg-background`, higher z-index.
  - Cell: right-sticky, `104px`, left border, `bg-background`, group hover background.
- [ ] Keep action buttons in `justify-end` layout with stable `32x32` dimensions.
- [ ] Remove obsolete action icon imports and `handleDelete`.
- [ ] Keep all application files below approximately 350 lines.
- [ ] Do not introduce a generic shared action-menu abstraction; the behavior is user-management-specific.

## Task 6: Verification and Closeout

- [ ] Run focused behavior and immediate blast-radius tests:

```bash
rtk npm run test:run -- \
  src/components/__tests__/user-management-manager-permissions.test.tsx \
  src/components/__tests__/user-list-table-actions.test.tsx \
  src/components/__tests__/user-list-table-delete-dialog.test.tsx \
  src/components/__tests__/user-list-table-role-label.test.tsx
```

- [ ] Run static quality gates:

```bash
rtk npm run typecheck
rtk npm run lint -- \
  src/components/user-list-table.tsx \
  src/components/user-row-actions.tsx \
  src/components/delete-user-dialog.tsx \
  src/components/__tests__/user-management-manager-permissions.test.tsx \
  src/components/__tests__/user-list-table-actions.test.tsx \
  src/components/__tests__/user-list-table-delete-dialog.test.tsx
```

- [ ] Confirm no tracked files outside the three UI files, three focused test files and this plan changed.
- [ ] Stage the exact allowlist before React Doctor and whitespace validation so both tools include new files:

```bash
rtk git add docs/plan/2026-07-23-user-action-column-tdd.md \
  src/components/user-list-table.tsx \
  src/components/user-row-actions.tsx \
  src/components/delete-user-dialog.tsx \
  src/components/__tests__/user-management-manager-permissions.test.tsx \
  src/components/__tests__/user-list-table-actions.test.tsx \
  src/components/__tests__/user-list-table-delete-dialog.test.tsx
rtk git diff --cached --check
rtk git diff --cached --name-only
rtk npm run react-doctor:diff
```

- [ ] Verify the staged file list matches the allowlist exactly.
- [ ] If React Doctor requires a fix, apply it, rerun the affected tests/typecheck/lint, restage the allowlist, then rerun `git diff --cached --check` and `react-doctor:diff`.
- [ ] Verify in a browser at desktop and narrow viewports:
  - Row heights are uniform.
  - The sticky column remains visible while scrolling horizontally.
  - Dropdown content is not clipped.
  - Keyboard focus can reach edit and overflow actions.
  - The restricted tooltip is available on focus.
  - Alert Dialog traps focus and restores focus to the menu trigger after closing.
  - Error toast leaves the dialog open.
- [ ] Commit:

```bash
rtk git commit -m "feat: Simplify user management actions"
```

- [ ] Pull, push and verify synchronization:

```bash
rtk git pull --rebase
rtk git push
rtk git status --short --branch
```

Expected final status: the branch is clean and up to date with its remote.
