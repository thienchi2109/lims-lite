## 1. Proposal Validation

- [x] 1.1 Review `add-coa-generation-and-access` for overlap and keep this change scoped to embedded preview behavior
- [x] 1.2 Validate `update-coa-preview-dialog` with `openspec validate update-coa-preview-dialog --strict` when the CLI is available

## 2. Reusable Preview Component

- [x] 2.1 Create `src/components/coa-preview-dialog.tsx`
- [x] 2.2 Fetch CoA HTML on open and render it into an iframe inside the dialog
- [x] 2.3 Add loading, error, retry, print, and open-in-new-tab fallback states
- [x] 2.4 Add focused component tests for success, failure, and unauthorized recovery

## 3. Public Portal Integration

- [x] 3.1 Replace `window.open()` in `src/components/coa-access-form.tsx` with dialog state
- [x] 3.2 Preserve authenticated sample-list context while preview is open
- [x] 3.3 Add public portal tests for preview open, route failure, and expired-session recovery

## 4. Staff Workflow Integration

- [x] 4.1 Replace desktop `window.open()` CoA view action in `src/components/assigned-tests-toolbar.tsx` with a preview callback
- [x] 4.2 Add mobile overflow parity for ready CoA actions: preview full CoA and print result body
- [x] 4.3 Add preview state and dialog wiring in `src/components/assigned-tests-panel.tsx`
- [x] 4.4 Add toolbar and panel tests covering desktop and mobile CoA access paths

## 5. Verification

- [x] 5.1 Run focused preview-related tests
- [x] 5.2 Run `npm run typecheck`
- [x] 5.3 Manual test: staff desktop preview
- [x] 5.4 Manual test: staff mobile overflow preview
- [x] 5.5 Manual test: public portal preview and expired-session recovery
