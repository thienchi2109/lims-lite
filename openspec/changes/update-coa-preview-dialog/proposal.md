## Why

- Current CoA viewing relies on popup/new-tab behavior in both the staff workflow and the public portal, which breaks page context and is vulnerable to popup blocking.
- The staff toolbar already collapses actions into a mobile overflow menu, but CoA view/print actions are desktop-only today. On small screens that leaves no direct way to open a ready CoA from the assigned tests workspace.
- The existing CoA routes return HTML on success and JSON on failure. A preview change needs an explicit UX contract for loading, expired-session recovery, and route failures instead of embedding those routes blindly in an iframe.

## What Changes

- Add a reusable embedded document preview dialog shell that can render authorized HTML documents inside the current page.
- Implement the current CoA feature as a thin CoA-specific wrapper on top of that shared document preview shell.
- Use the preview dialog as the primary CoA viewing experience for:
  - Staff in the assigned tests workspace
  - Clients in the public `/coa/access` portal
- Preserve existing route-level authorization and audit behavior by continuing to use the current CoA endpoints instead of introducing new storage access paths.
- Add explicit mobile parity for staff: when desktop CoA actions are hidden, the mobile overflow menu SHALL expose "Xem CoA đầy đủ" and "Chỉ in bảng kết quả" for ready CoA documents.
- Add explicit preview states: loading, recoverable error, print, and open-in-new-tab fallback.
- Keep `src/components/coa-actions.tsx` out of scope for this change because it is not currently wired into any live route.
- Keep non-CoA document previews out of current feature scope, but shape the shared shell so future preview-first document flows can reuse it without a major refactor.

## Impact

- **Affected specs:** `coa-preview`
- **Affected code:**
  - `src/components/assigned-tests-toolbar.tsx`
  - `src/components/assigned-tests-panel.tsx`
  - `src/components/coa-access-form.tsx`
  - `src/components/document-preview-dialog.tsx` (new)
  - `src/components/coa-preview-dialog.tsx` (new thin wrapper)
  - `src/components/__tests__/*.test.tsx`
- **Dependencies:**
  - Relies on the existing CoA access/generation routes introduced by `add-coa-generation-and-access`
  - Must preserve the current CoA document format, including template enrichment from `update-coa-template-enrichment`
- **Security:** No new API surface or storage permissions. Existing session/JWT authorization remains the gate; the preview only changes how authorized HTML is presented.
- **UX:** Staff and clients keep their surrounding context while viewing CoA documents, and mobile staff users gain a first-class CoA access path.
- **Maintainability:** The reusable preview shell is introduced now so future preview-first document flows can reuse the same loading, iframe, print, and fallback behavior instead of cloning CoA-specific code.
- **OpenSpec coordination:** `add-coa-generation-and-access` is still an active checked-in change. This proposal introduces a dedicated `coa-preview` capability to avoid partially overwriting unarchived CoA access deltas while that parent change remains open.
