## Context

The current CoA experience is split across popup-based entry points:

- Staff open `/api/coa/view?sample_id=...` in a new tab from the assigned tests toolbar.
- Clients open `/api/coa/download?sample_id=...` in a new tab from the public CoA portal.

This has three problems:

1. It breaks workflow context by pulling users away from the current screen.
2. It depends on popup/new-tab browser behavior.
3. It gives no structured recovery path if the backing route returns JSON errors such as expired authentication, missing CoA, or incomplete sample status.

The staff toolbar also has a mobile overflow menu that hides several actions on small screens. CoA actions are not represented there today, which makes ready CoA documents effectively desktop-only in that workspace.

## Goals / Non-Goals

- Goals:
  - Keep staff and client users on the current page while viewing a CoA
  - Reuse the existing authenticated CoA routes
  - Make preview behavior explicit on mobile, not desktop-only by omission
  - Define recoverable error handling for route failures
- Non-Goals:
  - Changing CoA generation, storage, or audit logging rules
  - Introducing a new public storage URL or bypassing current authorization routes
  - Reviving or redesigning `src/components/coa-actions.tsx`
  - Replacing the existing staff "Chỉ in bảng kết quả" print flow

## Decisions

- Decision: Split the UI into a generic preview shell and a CoA-specific wrapper.
  - Shape:
    - `document-preview-dialog.tsx`: shared shell
    - `coa-preview-dialog.tsx`: thin CoA wrapper
  - Why: The current feature scope is only CoA preview, but there is already a likely future use case for preview-first `In Phiếu chỉ định`. Extracting the shell now avoids a later refactor while still keeping the current behavior and spec scoped to CoA.

- Decision: Fetch document HTML first, then render it inside an iframe using `srcDoc`.
  - Why: The existing CoA routes return HTML on success but JSON on failure. Directly embedding the route URL in the iframe would produce poor failure UX. Fetch-first lets the component map failures into Vietnamese dialog states and still render the successful HTML document unchanged.

- Decision: Use a single responsive dialog instead of branching to a separate mobile drawer.
  - Why: The feature already spans multiple entry points. A responsive dialog keeps the behavior easier to test and avoids duplicate logic unless mobile-specific constraints later justify a drawer.

- Decision: Add ready-CoA actions to the staff mobile overflow menu.
  - Why: Mobile users need parity with desktop for viewing ready CoA documents. The preview entry and print-body entry should be available from the only menu that remains visible on small screens.

- Decision: Do not generalize the OpenSpec feature beyond CoA yet.
  - Why: The shell is reusable, but the approved behavior change in this proposal is still specifically about CoA preview. Future document types can adopt the shared shell without needing to widen the current product scope.

## Risks / Trade-offs

- Route responses may vary by failure mode.
  - Mitigation: The preview component must handle non-200 responses explicitly and prefer a returned JSON `error` message when present.

- Printing from an iframe can be browser-sensitive.
  - Mitigation: Keep an "Mở trong tab mới" fallback so users can still use native browser print flows if iframe print is limited.

- This change is stacked on another active CoA OpenSpec change.
  - Mitigation: Keep the capability narrow (`coa-preview`) and call out the dependency in the proposal instead of partially rewriting the parent change's unchecked-in current truth.

- The shared shell could become over-abstracted if it tries to model every future document flow now.
  - Mitigation: Keep the shell API minimal and only cover behavior that CoA already needs today: dialog framing, loading, iframe rendering, print, and fallback open-in-tab.

## Migration Plan

1. Approve this OpenSpec change before implementation.
2. Build the generic preview shell and the thin CoA wrapper.
3. Integrate the public portal.
4. Integrate the assigned tests workspace, including the mobile overflow menu.
5. Run focused tests and typecheck.

## Open Questions

- None blocking for proposal approval. The mobile overflow decision is explicit in this design: include ready-CoA preview and print-body actions there.
