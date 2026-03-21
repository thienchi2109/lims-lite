## 1. Proposal Validation

- [ ] 1.1 Review `add-coa-generation-and-access` for overlap and keep this change scoped to embedded preview behavior
- [ ] 1.2 Validate `update-coa-preview-dialog` with `openspec validate update-coa-preview-dialog --strict` when the CLI is available

## 2. Reusable Preview Component

- [ ] 2.1 Create `src/components/document-preview-dialog.tsx`
- [ ] 2.2 Create `src/components/coa-preview-dialog.tsx` as a CoA-specific wrapper over the shared document preview shell
- [ ] 2.3 Fetch CoA HTML on open and render it into an iframe inside the dialog
- [ ] 2.4 Add loading, error, retry, print, and open-in-new-tab fallback states in the shared shell
- [ ] 2.5 Add focused component tests for shell behavior plus CoA-specific success, failure, and unauthorized recovery

## 3. Public Portal Integration

- [ ] 3.1 Replace `window.open()` in `src/components/coa-access-form.tsx` with dialog state
- [ ] 3.2 Preserve authenticated sample-list context while preview is open
- [ ] 3.3 Add public portal tests for preview open, route failure, and expired-session recovery

## 4. Staff Workflow Integration

- [ ] 4.1 Replace desktop `window.open()` CoA view action in `src/components/assigned-tests-toolbar.tsx` with a preview callback
- [ ] 4.2 Add mobile overflow parity for ready CoA actions: preview full CoA and print result body
- [ ] 4.3 Add preview state and dialog wiring in `src/components/assigned-tests-panel.tsx`
- [ ] 4.4 Add toolbar and panel tests covering desktop and mobile CoA access paths

## 5. Verification

- [ ] 5.1 Run focused preview-related tests
- [ ] 5.2 Run `npm run typecheck`
- [ ] 5.3 Manual test: staff desktop preview
- [ ] 5.4 Manual test: staff mobile overflow preview
- [ ] 5.5 Manual test: public portal preview and expired-session recovery
