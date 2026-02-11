# Plan: Body-Only CoA Print for Pre-Printed Letterhead

## Context

The lab uses **pre-printed letterhead paper** that already has the CDC header and footer. They need a print option that renders only the CoA body (patient info, results table, signatures, metadata) — skipping header, footer, and watermark — so the printed content aligns with the pre-printed paper.

## Approach: CSS Injection on Stored HTML

Fetch the already-generated CoA HTML from `/api/coa/view`, inject CSS overrides to hide `.header`, `.absolute-footer`, and `.watermark`, adjust padding, then open in a browser print window. **Zero server-side changes.**

## Changes

### 1. `src/components/assigned-tests-toolbar.tsx`

**Convert the CoA view button (line 168-186) into a dropdown menu with two options.**

- Add `onPrintCoABody: () => void` to `AssignedTestsToolbarProps`
- Import `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` from `@/components/ui/dropdown-menu`
- Replace the single `<Tooltip>` + `<Button>` for `coaStatus === 'ready'` with:
  - `<DropdownMenu>` wrapping a `<Tooltip>` trigger button (same styling, keeps `id="tour-coa-view"`)
  - Two `<DropdownMenuItem>`:
    1. `Xem CoA đầy đủ` — opens `/api/coa/view?sample_id=...` in new tab (current behavior)
    2. `Chỉ in bảng kết quả` — calls `onPrintCoABody` prop

### 2. `src/components/assigned-tests-panel.tsx`

**Add `handlePrintCoABody` function and wire it to the toolbar.**

- New async function `handlePrintCoABody`:
  1. **Open blank window FIRST** (`window.open('', '_blank')`) — must happen synchronously in click handler to avoid popup blocker. Show "Đang tải..." placeholder in the window while fetching.
  2. `fetch(`/api/coa/view?sample_id=${sampleId}`, { cache: 'no-store' })` — gets stored CoA HTML, bypasses browser cache
  3. Check `response.ok` before processing — API returns JSON for errors (401/403/404) but HTML for success
  4. Inject `<style>` before `</head>` that:
     - `.header { visibility: hidden !important; border-color: transparent !important; }` — hides header content and border, **preserves space** for letterhead alignment
     - `.absolute-footer { display: none !important; }` — hides footer
     - `.watermark { display: none !important; }` — hides watermark
     - `.content { padding-bottom: 32px !important; }` — removes footer clearance (was 120px)
  5. Defensive fallback: if `</head>` not found, prepend styles to HTML
  6. Write modified HTML to the already-opened window, then trigger `print()`
  7. On error: close the blank window and show `toast.error()`
- Pass `onPrintCoABody={handlePrintCoABody}` to `<AssignedTestsToolbar>`

## Files Modified

| File | Change |
|------|--------|
| `src/components/assigned-tests-toolbar.tsx` | Add prop, replace button with dropdown |
| `src/components/assigned-tests-panel.tsx` | Add `handlePrintCoABody`, wire prop |

## Files NOT Modified

- `src/lib/coa/template/*` — No template changes
- `src/app/api/coa/view/route.ts` — No server changes
- `src/components/walkthrough/tours/coa-tour.ts` — Tour update deferred
- No new files created

## Vietnamese Labels

- Dropdown trigger tooltip: `Phiếu kết quả (CoA)`
- Item 1: `Xem CoA đầy đủ` (View full CoA)
- Item 2: `Chỉ in bảng kết quả` (Print results table only)
- Error toast: `Không thể tải phiếu kết quả` / `Trình duyệt đã chặn cửa sổ in`

## Design Decisions

- **Metadata**: Remains hidden (`display: none` in template CSS at `styles.ts:97`). Machine/audit data for 21 CFR Part 11 — not for visual display.
- **Popup blocker**: Window opened synchronously in click handler (before async fetch).
- **Cache bypass**: `{ cache: 'no-store' }` on fetch ensures print always uses latest stored CoA.

## Verification

1. Navigate to a completed sample with `coaStatus === 'ready'`
2. Click the CoA button (ExternalLink icon) — should open dropdown
3. Click "Xem CoA đầy đủ" — should open full CoA in new tab (existing behavior preserved)
4. Click "Chỉ in bảng kết quả" — should:
   - Open a new window immediately (no popup blocker)
   - Show "Đang tải..." briefly while fetching
   - Then show print preview with:
     - No header content visible (but space preserved for letterhead alignment)
     - No header border visible
     - No footer (disclaimer, address hidden)
     - No watermark
     - Patient info, results table, signatures visible
     - Reduced bottom padding
5. Regenerate CoA, then immediately print body-only — should show latest version (cache bypass)

## Agent Mapping for Execution

| Task | Agent Type | Model | Rationale |
|------|------------|-------|-----------|
| Modify toolbar (dropdown) | frontend-developer | sonnet | React component with shadcn dropdown |
| Add print handler | frontend-developer | sonnet | Client-side fetch + DOM manipulation |
| Code review | superpowers:code-reviewer | sonnet | Quality gate |
