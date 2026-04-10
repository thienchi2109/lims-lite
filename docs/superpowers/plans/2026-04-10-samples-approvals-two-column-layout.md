# Samples and Approvals 2-Column Layout Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the desktop 2-row layouts on `/samples` and `/manager/approvals` with a consistent 65/35 2-column workspace, where the data grid stays on the left and a stacked inspector rail lives on the right.

**Architecture:** Follow strict TDD in page order, not abstraction order. First lock and migrate Samples with page-specific code until its tests are green. Then lock and migrate Approvals with page-specific code until its tests are green. Only after both pages are green may we extract a shared `DesktopMasterDetailShell`, and only if duplication is still meaningful. Shared detail/test panels keep owning their own internal scroll regions so their headers remain outside the scrolled content.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS, TanStack Query, Vitest, Testing Library

---

## TDD Rules For This Plan

- **No production code before a failing test exists for that exact behavior.**
- **Every task must follow `RED -> VERIFY RED -> GREEN -> VERIFY GREEN -> REFACTOR -> VERIFY GREEN`.**
- **Do not introduce the shared shell up front.** If it appears before both pages are green independently, the plan has drifted out of TDD.
- **If a test passes immediately, it is not testing the new behavior. Fix the test before touching production code.**
- **Only run refactors after the changed page is green.**

## File Map

**Create during page-specific work:**
- `src/components/sample-inspector-column.tsx`
- `src/components/approval-inspector-column.tsx`
- `src/components/__tests__/sample-inspector-column.test.tsx`
- `src/components/__tests__/approval-inspector-column.test.tsx`

**Create only in the final refactor chunk:**
- `src/components/desktop-master-detail-shell.tsx`
- `src/components/__tests__/desktop-master-detail-shell.test.tsx`

**Modify:**
- `src/components/samples-page-client.tsx`
- `src/components/approval-tabs-client.tsx`
- `src/components/__tests__/samples-page-read-path.test.tsx`
- `src/components/__tests__/samples-page-client-scope.test.tsx`
- `src/components/__tests__/approval-tabs-client.test.tsx`
- `src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx`

**Delete after each page-specific migration turns green:**
- `src/components/sample-bottom-row.tsx`
- `src/components/approval-bottom-row.tsx`
- `src/components/__tests__/sample-bottom-row.test.tsx`
- `src/components/__tests__/approval-bottom-row.test.tsx`

**Only touch if tests prove necessary:**
- `src/components/sample-detail-panel.tsx`
- `src/components/assigned-tests-panel.tsx`
- `src/components/approval-actions.tsx`

**Non-goals for this plan:**
- No mobile layout rewrite for Samples or Approvals
- No changes to sample/approval fetching, URL semantics, or action flows
- No redesign of filters, tabs, or server actions beyond what is needed to fit the new shell

## Chunk 1: Samples RED -> GREEN

### Task 1: Write failing page-level Samples workspace tests

**Files:**
- Modify: `src/components/__tests__/samples-page-read-path.test.tsx`
- Modify: `src/components/__tests__/samples-page-client-scope.test.tsx`

- [ ] **Step 1: RED - replace the old `SampleBottomRow` test double with a `SampleInspectorColumn` test double**

The tests must stop recognizing the legacy component name. If the page still renders `SampleBottomRow`, this chunk has not started correctly.

- [ ] **Step 2: RED - add failing assertions for the new desktop workspace contract**

Expect the page to render markers like:

```tsx
<div data-testid="samples-workspace" />
<section data-testid="samples-grid-column" />
<aside data-testid="samples-inspector-column" />
```

and no longer rely on the old top-row/bottom-row structure.

- [ ] **Step 3: RED - preserve the existing data-flow assertions**

Keep assertions that:
- URL `sampleId` still drives the selected sample
- doctor mode still forces completed-only reads
- selected sample data still flows into the new inspector

- [ ] **Step 4: VERIFY RED - run the Samples page tests and confirm they fail for the right reason**

Run:

```bash
npm run test:run -- src/components/__tests__/samples-page-read-path.test.tsx src/components/__tests__/samples-page-client-scope.test.tsx
```

Expected: FAIL because the new workspace markers and inspector component do not exist yet, not because of unrelated import or mock errors.

- [ ] **Step 5: Commit the red tests**

```bash
git add src/components/__tests__/samples-page-read-path.test.tsx src/components/__tests__/samples-page-client-scope.test.tsx
git commit -m "test: lock samples two-column desktop contract"
```

### Task 2: Write failing focused Samples inspector tests

**Files:**
- Create: `src/components/__tests__/sample-inspector-column.test.tsx`
- Delete later: `src/components/__tests__/sample-bottom-row.test.tsx`

- [ ] **Step 1: RED - add a failing inspector-layout test**

Assert that the new component stacks two panels vertically and that both panel shells expose:

```tsx
flex min-h-0 flex-col overflow-hidden
```

- [ ] **Step 2: RED - add a failing loading-overlay test**

Assert that while switching samples:
- the currently visible detail content remains mounted
- the localized transition overlay appears on top

- [ ] **Step 3: RED - add a failing doctor-mode test**

Assert that doctor mode still swaps the lower panel to `DoctorCoAPanel`.

- [ ] **Step 4: VERIFY RED - run the new inspector test**

Run:

```bash
npm run test:run -- src/components/__tests__/sample-inspector-column.test.tsx
```

Expected: FAIL because `SampleInspectorColumn` does not exist yet.

- [ ] **Step 5: Commit the red inspector tests**

```bash
git add src/components/__tests__/sample-inspector-column.test.tsx
git commit -m "test: add failing samples inspector coverage"
```

### Task 3: Implement the minimal Samples production code to get green

**Files:**
- Create: `src/components/sample-inspector-column.tsx`
- Modify: `src/components/samples-page-client.tsx`
- Delete: `src/components/sample-bottom-row.tsx`
- Delete: `src/components/__tests__/sample-bottom-row.test.tsx`

- [ ] **Step 1: GREEN - create the minimal `SampleInspectorColumn`**

Move only the composition now owned by `SampleBottomRow` into a right-rail component that stacks:
- top: `SampleDetailPanel` or `DoctorSampleMetadataPanel`
- bottom: `AssignedTestsPanel` or `DoctorCoAPanel`

Do not refactor shared panel internals yet.

- [ ] **Step 2: GREEN - update `SamplesPageClient` to render a 65/35 page-specific shell**

Implement the new layout directly inside `SamplesPageClient` first. Use a page-local layout such as:

```tsx
<div
  data-testid="samples-workspace"
  className="flex min-h-0 flex-1 flex-col gap-2 lg:grid lg:grid-cols-[minmax(0,1.86fr)_minmax(22rem,1fr)]"
>
```

Keep the left column focused on filters + grid, and mount `SampleInspectorColumn` in the right column.

- [ ] **Step 3: GREEN - remove the old Samples 2-row composition**

Delete the current top `50vh` row and lower border-top detail row.

- [ ] **Step 4: VERIFY GREEN - run all Samples tests**

Run:

```bash
npm run test:run -- \
  src/components/__tests__/samples-page-read-path.test.tsx \
  src/components/__tests__/samples-page-client-scope.test.tsx \
  src/components/__tests__/sample-inspector-column.test.tsx
```

Expected: PASS.

- [ ] **Step 5: REFACTOR - clean up names and dead imports only after green**

Allowed refactors:
- remove the legacy `SampleBottomRow` file
- remove stale imports/mocks/tests
- tighten class names for clarity without changing behavior

- [ ] **Step 6: VERIFY GREEN - rerun the same Samples suite**

Run the same command again. Expected: still PASS.

- [ ] **Step 7: Commit the Samples green state**

```bash
git add src/components/sample-inspector-column.tsx src/components/samples-page-client.tsx src/components/__tests__/samples-page-read-path.test.tsx src/components/__tests__/samples-page-client-scope.test.tsx src/components/__tests__/sample-inspector-column.test.tsx
git rm src/components/sample-bottom-row.tsx src/components/__tests__/sample-bottom-row.test.tsx
git commit -m "feat: migrate samples to two-column desktop layout"
```

## Chunk 2: Approvals RED -> GREEN

### Task 4: Write failing page-level Approvals workspace tests

**Files:**
- Modify: `src/components/__tests__/approval-tabs-client.test.tsx`

- [ ] **Step 1: RED - replace the old `ApprovalBottomRow` test double with an `ApprovalInspectorColumn` test double**

Do not keep the legacy component name in the page-level test.

- [ ] **Step 2: RED - add failing assertions for the new desktop Approvals contract**

Expect:

```tsx
<div data-testid="approvals-workspace" />
<section data-testid="approvals-grid-column" />
<aside data-testid="approvals-inspector-column" />
```

and keep page header + tabs outside the workspace shell.

- [ ] **Step 3: RED - preserve the existing queue-selection contract**

Keep assertions that:
- row selection still updates URL state
- detail loading still handles async transitions
- tab switching still works

- [ ] **Step 4: VERIFY RED - run the Approvals page test and confirm expected failure**

Run:

```bash
npm run test:run -- src/components/__tests__/approval-tabs-client.test.tsx
```

Expected: FAIL because `ApprovalTabsClient` still renders the old top-grid/bottom-detail composition.

- [ ] **Step 5: Commit the red page-level Approvals tests**

```bash
git add src/components/__tests__/approval-tabs-client.test.tsx
git commit -m "test: lock approvals two-column desktop contract"
```

### Task 5: Write failing focused Approvals inspector tests

**Files:**
- Create: `src/components/__tests__/approval-inspector-column.test.tsx`
- Delete later: `src/components/__tests__/approval-bottom-row.test.tsx`

- [ ] **Step 1: RED - add a failing inspector-layout test**

Assert that the inspector stacks:
- top panel with `SampleDetailPanel`
- bottom panel with `AssignedTestsPanel`

- [ ] **Step 2: RED - add a failing action-zone test**

Assert that `ApprovalActions` remains visible inside the lower inspector panel and does not collapse into page-level scroll chrome.

- [ ] **Step 3: RED - add a failing constrained-scroll test**

Assert that the lower approval panel owns a constrained scroll chain instead of letting the full inspector rail scroll.

- [ ] **Step 4: VERIFY RED - run the focused Approvals inspector test**

Run:

```bash
npm run test:run -- src/components/__tests__/approval-inspector-column.test.tsx
```

Expected: FAIL because `ApprovalInspectorColumn` does not exist yet.

- [ ] **Step 5: Commit the red inspector tests**

```bash
git add src/components/__tests__/approval-inspector-column.test.tsx
git commit -m "test: add failing approvals inspector coverage"
```

### Task 6: Implement the minimal Approvals production code to get green

**Files:**
- Create: `src/components/approval-inspector-column.tsx`
- Modify: `src/components/approval-tabs-client.tsx`
- Delete: `src/components/approval-bottom-row.tsx`
- Delete: `src/components/__tests__/approval-bottom-row.test.tsx`

- [ ] **Step 1: GREEN - create the minimal `ApprovalInspectorColumn`**

Build a manager-specific inspector that stacks:
- top: `SampleDetailPanel`
- bottom: `AssignedTestsPanel` plus `ApprovalActions`

Keep action behavior identical; only the composition changes.

- [ ] **Step 2: GREEN - update `ApprovalTabsClient` to render a page-specific 65/35 shell**

Inside the active tab content, directly implement the 2-column shell first. Do not extract a shared component yet.

- [ ] **Step 3: GREEN - remove the old Approvals top-grid/bottom-detail composition**

Delete the current `ApprovalQueueContent` split that uses a fixed top queue height and a lower detail region.

- [ ] **Step 4: VERIFY GREEN - run all Approvals tests**

Run:

```bash
npm run test:run -- \
  src/components/__tests__/approval-tabs-client.test.tsx \
  src/components/__tests__/approval-inspector-column.test.tsx
```

Expected: PASS.

- [ ] **Step 5: REFACTOR - remove the legacy approval bottom-row component and dead test code**

Only cleanup after the page is green.

- [ ] **Step 6: VERIFY GREEN - rerun the same Approvals suite**

Run the same command again. Expected: still PASS.

- [ ] **Step 7: Commit the Approvals green state**

```bash
git add src/components/approval-inspector-column.tsx src/components/approval-tabs-client.tsx src/components/__tests__/approval-tabs-client.test.tsx src/components/__tests__/approval-inspector-column.test.tsx
git rm src/components/approval-bottom-row.tsx src/components/__tests__/approval-bottom-row.test.tsx
git commit -m "feat: migrate approvals to two-column desktop layout"
```

## Chunk 3: Shared Panel Hardening RED -> GREEN

### Task 7: Prove shared panel scroll ownership under the new inspector shells

**Files:**
- Modify: `src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx`
- Only if necessary: `src/components/sample-detail-panel.tsx`
- Only if necessary: `src/components/assigned-tests-panel.tsx`
- Only if necessary: `src/components/approval-actions.tsx`

- [ ] **Step 1: RED - extend the assigned-tests-panel test for nested inspector usage**

Add assertions that the results region still owns:

```tsx
flex-1 min-h-0 overflow-auto
```

when rendered inside the new stacked inspector shells.

- [ ] **Step 2: VERIFY RED - run the shared-panel test**

Run:

```bash
npm run test:run -- src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx
```

Expected: FAIL only if the new nesting actually broke the scroll chain.

- [ ] **Step 3: GREEN - apply the smallest possible class-level fix**

If the test fails, only add minimal layout classes such as:
- `min-h-0`
- `overflow-hidden`
- `sticky top-0 z-10`

Do not rewrite panel business logic.

- [ ] **Step 4: VERIFY GREEN - rerun the shared-panel test**

Expected: PASS.

- [ ] **Step 5: REFACTOR - clean up class naming only if needed**

Keep the shared panels behaviorally identical.

- [ ] **Step 6: VERIFY GREEN - rerun the shared-panel test once more**

Expected: still PASS.

- [ ] **Step 7: Commit the shared-panel hardening**

```bash
git add src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx src/components/sample-detail-panel.tsx src/components/assigned-tests-panel.tsx src/components/approval-actions.tsx
git commit -m "test: harden inspector panel scroll ownership"
```

## Chunk 4: Optional Shared-Shell Refactor, Only After Both Pages Are Green

### Task 8: Extract a shared desktop shell only if duplication is still meaningful

**Files:**
- Create: `src/components/desktop-master-detail-shell.tsx`
- Create: `src/components/__tests__/desktop-master-detail-shell.test.tsx`
- Modify: `src/components/samples-page-client.tsx`
- Modify: `src/components/approval-tabs-client.tsx`

- [ ] **Step 1: RED - write a failing shared-shell test**

Assert that the extracted shell:
- stacks on smaller breakpoints
- switches to the desktop 65/35 grid at the chosen breakpoint
- gives both columns `min-h-0`

- [ ] **Step 2: VERIFY RED - run the shared-shell test**

Run:

```bash
npm run test:run -- src/components/__tests__/desktop-master-detail-shell.test.tsx
```

Expected: FAIL because the shared shell does not exist yet.

- [ ] **Step 3: GREEN - extract `DesktopMasterDetailShell`**

Only extract markup already proven green in both pages. No new behavior is allowed in this step.

- [ ] **Step 4: VERIFY GREEN - run page-level tests for both pages plus the shell**

Run:

```bash
npm run test:run -- \
  src/components/__tests__/desktop-master-detail-shell.test.tsx \
  src/components/__tests__/samples-page-read-path.test.tsx \
  src/components/__tests__/samples-page-client-scope.test.tsx \
  src/components/__tests__/approval-tabs-client.test.tsx
```

Expected: PASS.

- [ ] **Step 5: REFACTOR - remove duplicated page-local class strings**

No behavior changes.

- [ ] **Step 6: VERIFY GREEN - rerun the same suite**

Expected: still PASS.

- [ ] **Step 7: Commit the shared-shell extraction**

```bash
git add src/components/desktop-master-detail-shell.tsx src/components/__tests__/desktop-master-detail-shell.test.tsx src/components/samples-page-client.tsx src/components/approval-tabs-client.tsx
git commit -m "refactor: extract shared desktop master-detail shell"
```

## Chunk 5: Final Verification

### Task 9: Run the complete verification matrix

**Files:**
- No new files

- [ ] **Step 1: Run the full targeted component suite**

Run:

```bash
npm run test:run -- \
  src/components/__tests__/samples-page-read-path.test.tsx \
  src/components/__tests__/samples-page-client-scope.test.tsx \
  src/components/__tests__/sample-inspector-column.test.tsx \
  src/components/__tests__/approval-tabs-client.test.tsx \
  src/components/__tests__/approval-inspector-column.test.tsx \
  src/components/__tests__/assigned-tests-panel-coa-preview.test.tsx \
  src/components/__tests__/desktop-master-detail-shell.test.tsx
```

Expected: PASS, 0 failed.

- [ ] **Step 2: Run type safety checks**

Run:

```bash
npm run typecheck
```

Expected: exit code `0`.

- [ ] **Step 3: Run React-specific hygiene checks**

Run:

```bash
npm run react-doctor:diff
```

Expected: no newly introduced React anti-patterns in the changed files.

- [ ] **Step 4: Manually verify `/samples` on desktop**

Manual QA checklist:
- desktop shows a 65/35 workspace
- left grid remains the dominant scan surface
- right rail stacks `Thông tin mẫu` above `Xét nghiệm & Kết quả`
- both panels keep headers outside their scrollable content
- selecting another sample preserves current content until the transition overlay resolves

- [ ] **Step 5: Manually verify `/manager/approvals` on desktop**

Manual QA checklist:
- page header and tabs stay above the workspace
- left queue grid remains the dominant scan surface
- right rail stacks `Thông tin mẫu` above `Xét nghiệm & Kết quả`
- approval actions remain easy to reach inside the lower inspector
- switching queue rows updates the inspector without layout jumps

- [ ] **Step 6: Manually verify the fallback below desktop breakpoint**

Manual QA checklist:
- both pages fall back to a vertical stack instead of squeezing the right rail
- no mobile-only drawer behavior is broken

- [ ] **Step 7: Commit the verification pass**

```bash
git add -A
git commit -m "test: verify two-column samples and approvals rollout"
```

## Follow-up Notes

- If the shared-shell refactor does not remove meaningful duplication, skip Chunk 4 entirely. TDD prefers two duplicated green pages over one speculative abstraction.
- If the lower Approvals inspector needs a sticky action footer after real QA, treat that as a separate red/green cycle.

Plan complete and saved to `docs/superpowers/plans/2026-04-10-samples-approvals-two-column-layout.md`. Ready to execute?
