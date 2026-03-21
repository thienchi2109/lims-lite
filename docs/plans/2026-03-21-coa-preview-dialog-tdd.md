# CoA Preview Dialog Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace primary CoA popup/new-tab viewing with an embedded preview dialog for the live staff and client entry points, while keeping existing auth, audit, and print behavior intact.

**Architecture:** Build one reusable client component that fetches CoA HTML only after the preview opens, stores the HTML in local state, and renders it into an iframe via `srcDoc`. This avoids the current blank/raw-JSON failure mode that would happen if a dialog iframe pointed directly at `/api/coa/view` or `/api/coa/download` and those routes returned JSON errors. Wire the dialog into `AssignedTestsPanel` and `CoAAccessForm`; leave `CoAActions` out of scope until that component is actually mounted again.

**Tech Stack:** Next.js 16 App Router, React 19, shadcn/ui `Dialog`, Tailwind CSS, Vitest, Testing Library, existing CoA routes `/api/coa/view` and `/api/coa/download`.

---

## Scope Decisions

- Do not start implementation until the OpenSpec change for this behavior is approved.
- Do not touch [src/components/coa-actions.tsx](E:/lims-lite/src/components/coa-actions.tsx). `gitnexus context CoAActions --file src/components/coa-actions.tsx` shows no incoming references, so changing it does not ship user-visible behavior.
- Do not add a separate mobile `Drawer` in v1. Use one responsive `Dialog` across breakpoints to reduce branching and test surface.
- Do not point the iframe directly at the route URL. Fetch first, then render `srcDoc`.
- Keep [src/hooks/use-print-handlers.ts](E:/lims-lite/src/hooks/use-print-handlers.ts) and its `handlePrintCoABody` flow unchanged.
- Make the dialog subtitle optional. Do not block this change on plumbing `sample_id_display` into the staff panel.

## Open Questions Closed By This Plan

- The preview component prop is `sampleLabel?: string`, not required `sampleIdDisplay`.
- The preview component owns loading, success, retry, and error UI.
- Public portal unauthorized preview failures should expose a `Đăng nhập lại` recovery path.
- Staff preview keeps `Chỉ in bảng kết quả` as a separate action; the dialog `In` button prints the full rendered CoA.

### Task 0: OpenSpec and Beads Gate

**Files:**
- Review: `openspec/changes/add-coa-generation-and-access/specs/client-management/spec.md`
- Review: `openspec/changes/add-coa-generation-and-access/specs/sample-management/spec.md`
- Create or modify: `openspec/changes/update-coa-preview-dialog/proposal.md`
- Create or modify: `openspec/changes/update-coa-preview-dialog/tasks.md`
- Create or modify: `openspec/changes/update-coa-preview-dialog/specs/client-management/spec.md`
- Create or modify: `openspec/changes/update-coa-preview-dialog/specs/sample-management/spec.md`

**Step 1: Confirm the spec path**

Run:

```bash
openspec list
openspec list --specs
```

Expected: clarity on whether preview-dialog behavior belongs in a new `update-coa-preview-dialog` change or an already-open CoA change.

**Step 2: Write the delta for public access**

Modify the client-management requirement so the primary client action no longer says "download in a new tab immediately". The updated requirement should say:

```markdown
#### Scenario: Client previews CoA report
- **WHEN** the client clicks "Tải Kết Quả"
- **THEN** the system SHALL open an embedded preview dialog
- **AND** preserve the authenticated sample list behind the dialog
- **AND** provide "In", "Mở trong tab mới", and "Đóng" actions
- **AND** render a recoverable Vietnamese error state if the preview request fails
```

**Step 3: Write the delta for staff sample detail**

Modify the sample-management requirement so the ready CoA action opens a preview dialog instead of directly opening a new tab, while keeping `Chỉ in bảng kết quả` as a separate staff action.

**Step 4: Validate the change**

Run:

```bash
openspec validate <change-id> --strict
```

Expected: PASS. If it fails, fix the delta before writing any production code.

**Step 5: Ingest execution into Beads**

Run:

```bash
bd ready
bd create "Build reusable CoA preview dialog"
bd create "Integrate CoA preview into public portal"
bd create "Integrate CoA preview into assigned tests panel"
bd create "Run focused CoA preview verification"
```

Expected: each implementation task exists in Beads before code work starts.

### Task 1: Build the Reusable Preview Dialog With TDD

**Files:**
- Create: [src/components/coa-preview-dialog.tsx](E:/lims-lite/src/components/coa-preview-dialog.tsx)
- Create: [src/components/__tests__/coa-preview-dialog.test.tsx](E:/lims-lite/src/components/__tests__/coa-preview-dialog.test.tsx)

**Step 1: Write the failing tests**

Create these tests first:

```tsx
it('shows a loading state while the CoA HTML is being fetched', async () => {})
it('renders fetched HTML into an iframe via srcDoc', async () => {})
it('shows a Vietnamese error message instead of raw JSON when the route fails', async () => {})
it('renders a rel-safe "Mở trong tab mới" fallback link', async () => {})
it('prints the iframe document when the user clicks "In"', async () => {})
it('renders a "Đăng nhập lại" recovery action when onUnauthorized is provided and fetch returns 401', async () => {})
```

Use real component behavior. Mock `fetch`, not the component internals.

**Step 2: Run the test and verify RED**

Run:

```bash
npm run test:run -- src/components/__tests__/coa-preview-dialog.test.tsx
```

Expected: FAIL because [src/components/coa-preview-dialog.tsx](E:/lims-lite/src/components/coa-preview-dialog.tsx) does not exist yet.

**Step 3: Write the minimal implementation**

Implement this surface:

```tsx
type CoAPreviewDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  documentUrl: string
  title?: string
  sampleLabel?: string
  onUnauthorized?: () => void
}
```

Implementation rules:

- Fetch on open with `fetch(documentUrl, { cache: 'no-store', credentials: 'same-origin' })`.
- On success, read `response.text()` and store HTML in state.
- On failure, prefer `response.json().error`, fall back to text, and render it in the dialog body.
- Render a responsive `Dialog` with `DialogTitle` always present.
- Render the fetched document with:

```tsx
<iframe
  ref={iframeRef}
  srcDoc={html}
  title="Phiếu kết quả phân tích"
  sandbox="allow-same-origin allow-modals"
/>
```

- Footer actions: `In`, `Mở trong tab mới`, `Đóng`.
- The external link must use `target="_blank"` and `rel="noopener noreferrer"`.

**Step 4: Run the test and verify GREEN**

Run:

```bash
npm run test:run -- src/components/__tests__/coa-preview-dialog.test.tsx
```

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add src/components/coa-preview-dialog.tsx src/components/__tests__/coa-preview-dialog.test.tsx
git commit -m "feat: add reusable CoA preview dialog"
```

### Task 2: Integrate the Public CoA Portal With TDD

**Files:**
- Modify: [src/components/coa-access-form.tsx](E:/lims-lite/src/components/coa-access-form.tsx)
- Create: [src/components/__tests__/coa-access-form-preview.test.tsx](E:/lims-lite/src/components/__tests__/coa-access-form-preview.test.tsx)

**Step 1: Write the failing tests**

Add tests for the real user-facing behavior:

```tsx
it('opens the preview dialog instead of calling window.open when the client clicks "Tải Kết Quả"', async () => {})
it('passes /api/coa/download?sample_id=... to the preview dialog', async () => {})
it('keeps the authenticated sample list mounted while the dialog is open', async () => {})
it('lets the client recover from a 401 preview response by logging in again', async () => {})
```

**Step 2: Run the test and verify RED**

Run:

```bash
npm run test:run -- src/components/__tests__/coa-access-form-preview.test.tsx
```

Expected: FAIL because [src/components/coa-access-form.tsx](E:/lims-lite/src/components/coa-access-form.tsx) still uses `window.open`.

**Step 3: Write the minimal implementation**

Change [src/components/coa-access-form.tsx](E:/lims-lite/src/components/coa-access-form.tsx) like this:

- Remove the `window.open` flow from `handleDownload`.
- Add `previewSample` state:

```tsx
const [previewSample, setPreviewSample] = useState<CoASampleInfo | null>(null)
```

- Open the dialog with:

```tsx
setPreviewSample(sample)
```

- Render:

```tsx
<CoAPreviewDialog
  open={previewSample !== null}
  onOpenChange={(open) => !open && setPreviewSample(null)}
  documentUrl={`/api/coa/download?sample_id=${previewSample?.id}`}
  sampleLabel={previewSample?.sample_id_display}
  onUnauthorized={handleLogout}
/>
```

- Keep the button label `Tải Kết Quả`.

**Step 4: Run the test and verify GREEN**

Run:

```bash
npm run test:run -- src/components/__tests__/coa-access-form-preview.test.tsx
```

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add src/components/coa-access-form.tsx src/components/__tests__/coa-access-form-preview.test.tsx
git commit -m "feat: preview CoA inside public access portal"
```

### Task 3: Integrate the Staff Assigned Tests Flow With TDD

**Files:**
- Modify: [src/components/assigned-tests-toolbar.tsx](E:/lims-lite/src/components/assigned-tests-toolbar.tsx)
- Modify: [src/components/assigned-tests-panel.tsx](E:/lims-lite/src/components/assigned-tests-panel.tsx)
- Create: [src/components/__tests__/assigned-tests-toolbar-coa-preview.test.tsx](E:/lims-lite/src/components/__tests__/assigned-tests-toolbar-coa-preview.test.tsx)
- Create: [src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx](E:/lims-lite/src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx)
- Verify unchanged regression: [src/components/__tests__/assigned-tests-toolbar-mobile.test.tsx](E:/lims-lite/src/components/__tests__/assigned-tests-toolbar-mobile.test.tsx)

**Step 1: Write the failing tests**

Create a toolbar test for the ready-state dropdown:

```tsx
it('calls onPreviewCoA instead of window.open when "Xem CoA đầy đủ" is selected', async () => {})
it('keeps "Chỉ in bảng kết quả" wired to onPrintCoABody', async () => {})
```

Create a panel integration test:

```tsx
it('opens CoAPreviewDialog when the toolbar requests preview', async () => {})
it('passes /api/coa/view?sample_id=... to the preview dialog', async () => {})
```

**Step 2: Run the tests and verify RED**

Run:

```bash
npm run test:run -- src/components/__tests__/assigned-tests-toolbar-coa-preview.test.tsx src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx
```

Expected: FAIL because [src/components/assigned-tests-toolbar.tsx](E:/lims-lite/src/components/assigned-tests-toolbar.tsx) still calls `window.open` directly and [src/components/assigned-tests-panel.tsx](E:/lims-lite/src/components/assigned-tests-panel.tsx) has no preview state.

**Step 3: Write the minimal implementation**

In [src/components/assigned-tests-toolbar.tsx](E:/lims-lite/src/components/assigned-tests-toolbar.tsx):

- Add prop:

```tsx
onPreviewCoA: () => void
```

- Replace:

```tsx
window.open(`/api/coa/view?sample_id=${sampleId}`, '_blank')
```

with:

```tsx
onPreviewCoA()
```

In [src/components/assigned-tests-panel.tsx](E:/lims-lite/src/components/assigned-tests-panel.tsx):

- Add:

```tsx
const [previewOpen, setPreviewOpen] = useState(false)
```

- Pass:

```tsx
onPreviewCoA={() => setPreviewOpen(true)}
```

- Render:

```tsx
<CoAPreviewDialog
  open={previewOpen}
  onOpenChange={setPreviewOpen}
  documentUrl={`/api/coa/view?sample_id=${sampleId}`}
  sampleLabel={undefined}
/>
```

- Do not change `onPrintCoABody`.

**Step 4: Run the tests and verify GREEN**

Run:

```bash
npm run test:run -- src/components/__tests__/assigned-tests-toolbar-coa-preview.test.tsx src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx src/components/__tests__/assigned-tests-toolbar-mobile.test.tsx
```

Expected: PASS.

**Step 5: Commit**

Run:

```bash
git add src/components/assigned-tests-toolbar.tsx src/components/assigned-tests-panel.tsx src/components/__tests__/assigned-tests-toolbar-coa-preview.test.tsx src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx
git commit -m "feat: preview CoA from assigned tests panel"
```

### Task 4: Focused Verification, Manual Smoke, and Handoff

**Files:**
- Verify: [src/components/coa-preview-dialog.tsx](E:/lims-lite/src/components/coa-preview-dialog.tsx)
- Verify: [src/components/coa-access-form.tsx](E:/lims-lite/src/components/coa-access-form.tsx)
- Verify: [src/components/assigned-tests-toolbar.tsx](E:/lims-lite/src/components/assigned-tests-toolbar.tsx)
- Verify: [src/components/assigned-tests-panel.tsx](E:/lims-lite/src/components/assigned-tests-panel.tsx)
- Regression check: [src/hooks/__tests__/use-print-handlers.test.ts](E:/lims-lite/src/hooks/__tests__/use-print-handlers.test.ts)

**Step 1: Run the focused automated suite**

Run:

```bash
npm run test:run -- src/components/__tests__/coa-preview-dialog.test.tsx src/components/__tests__/coa-access-form-preview.test.tsx src/components/__tests__/assigned-tests-toolbar-coa-preview.test.tsx src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx src/components/__tests__/assigned-tests-toolbar-mobile.test.tsx src/hooks/__tests__/use-print-handlers.test.ts
```

Expected: PASS.

**Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

**Step 3: Run manual smoke checks**

Verify all of these in the browser:

1. Staff manager flow: open a completed sample, click `Xem CoA đầy đủ`, confirm preview dialog opens, document scrolls, `Mở trong tab mới` works, and `Chỉ in bảng kết quả` still works.
2. Public flow: authenticate on `/coa/access`, click `Tải Kết Quả`, confirm preview opens without leaving the page.
3. Expired-session flow: invalidate the client cookie, click `Tải Kết Quả`, confirm dialog shows the Vietnamese expiry error and the `Đăng nhập lại` recovery path.
4. Mobile flow: test under `sm`, confirm the dialog fills the screen comfortably and the footer actions remain reachable.

**Step 4: Record progress in Beads**

Run:

```bash
bd update <id> --notes "CoA preview dialog shipped with public and staff entry points, targeted tests passing"
bd update <id> --status closed
```

Expected: the next session starts with accurate state.

**Step 5: Final commit and push**

Run:

```bash
git add .
git commit -m "feat: embed CoA preview dialog for staff and clients"
git pull --rebase
bd sync
git push
git status
```

Expected: branch is up to date with origin and working tree is clean or only contains intentional follow-up work.

## Contingency Rule

If the new component tests reveal that either CoA route returns non-JSON error bodies that prevent clean UI recovery, add a small follow-up RED/GREEN task before Task 2:

- Create: `src/app/api/coa/view/route.test.ts`
- Create: `src/app/api/coa/download/route.test.ts`
- Modify the route(s) only enough to guarantee:
  - success returns HTML
  - failure returns `{ error: string }` JSON with the existing Vietnamese message
  - 401 failures remain distinguishable for the public portal recovery CTA
