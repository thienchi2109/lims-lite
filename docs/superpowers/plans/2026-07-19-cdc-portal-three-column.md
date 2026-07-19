# CDC Portal Three-Column Implementation Plan

> **For Codex:** Execute this plan with test-driven development and focused
> review. Keep the change limited to the public portal page and its regression
> test.

**Goal:** Replace the four-item two-column Welcome portal with the approved
three-item desktop row and mobile stacked layout.

**Architecture:** Keep `src/app/page.tsx` as a static React Server Component.
Represent destinations as module-level data, use `next/link` for `/login`, and
use secure anchor elements for absolute URLs. Load `Be Vietnam Pro` with
`next/font/google` at page scope. Tailwind responsive utilities define one
column by default and three columns at `lg`.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Lucide React,
Vitest.

---

## Task 1: Lock the portal contract with a failing regression test

**Files:**

- Modify: `src/__tests__/portal-root-route.test.ts`

- [ ] **Step 1: Add exact destination assertions**

Extract the `apps` array source and require exactly three `title` records in
this order. Assert each record's exact title, description, URL, and
`external` value:

1. `CDC LIMS`, `Hệ thống quản lý thông tin xét nghiệm`, `/login`, `false`
2. `Quản lý TBYT CDC`, `Quản lý thiết bị y tế CDC`,
   `https://quan-ly-tbyt.pages.dev/`, `true`
3. `Cổng tra cứu kết quả xét nghiệm`,
   `Tra cứu và xác thực phiếu kết quả xét nghiệm`,
   `https://cdclims.cloud/coa/access`, `true`

Require it not to contain:

- `CVMEMS`
- `Đào tạo nhân lực y tế`
- `Cổng dịch vụ công`

- [ ] **Step 2: Add responsive layout assertions**

Require the portal grid's class string to contain the exact mobile-first
contract:

- `min-h-dvh`
- `grid-cols-1 lg:grid-cols-3`
- `max-w-[1360px]`

Require the page not to contain `sm:grid-cols-2`, `md:grid-cols-2`, or
`overflow-hidden`.

- [ ] **Step 3: Verify RED**

```bash
rtk npm run test:run -- src/__tests__/portal-root-route.test.ts
```

Expected: FAIL because the current page still contains the removed destinations
and does not contain the approved layout/content contract.

## Task 2: Implement the approved portal layout

**Files:**

- Modify: `src/app/page.tsx`

- [ ] **Step 1: Replace the portal destination data**

Keep exactly the three approved destinations, descriptions, URLs, and these
Lucide icons:

- `FlaskConical` for CDC LIMS;
- `Package` for Quản lý TBYT CDC;
- `FileSearch` for Cổng tra cứu kết quả xét nghiệm.

Use `Truy cập hệ thống` as the shared action label. Preserve secure
`target="_blank"` and `rel="noopener noreferrer"` attributes for both absolute
URLs.

- [ ] **Step 2: Replace the page composition**

Implement:

- compact CDC identity header;
- wide `max-w-[1360px]` content area;
- `grid-cols-1 lg:grid-cols-3`;
- equal-height cards using a vertical flex layout;
- bottom-aligned action rows;
- left-aligned card content with one-line action labels;
- targeted hover, focus-visible, and active states with reduced-motion
  fallbacks;
- `min-h-dvh` with normal mobile document scrolling;
- quiet footer.

Remove the old decorative gradients, glassmorphism, and root
`overflow-hidden`.

- [ ] **Step 3: Verify GREEN**

```bash
rtk npm run test:run -- src/__tests__/portal-root-route.test.ts
```

Expected: PASS.

- [ ] **Step 4: Refactor without changing behavior**

Check naming, repeated class structure, semantic elements, accessible labels,
focus states, and file length. Keep the page under 350 lines.

## Task 3: Verify quality and rendered behavior

**Files:**

- Verify: `src/app/page.tsx`
- Verify: `src/__tests__/portal-root-route.test.ts`

- [ ] **Step 1: Run focused and static checks**

```bash
rtk npm run test:run -- src/__tests__/portal-root-route.test.ts
rtk npm run typecheck
rtk npm run lint
rtk npm run react-doctor:diff
```

Expected: PASS with no relevant new diagnostics.

- [ ] **Step 2: Run browser QA**

Start the local Next.js dev server:

```bash
rtk npm run dev -- --hostname 127.0.0.1 --port 3100
```

Use the available browser automation path and verify `/` at:

- desktop viewport around `1440x900`;
- mobile viewport around `390x844`.

Confirm:

- page URL and title identify the root CDC portal;
- no framework overlay or relevant console error;
- desktop cards share the same top coordinate, width, and row;
- mobile cards appear in approved order in one column;
- mobile `scrollWidth` does not exceed `clientWidth`;
- the third card and footer are reachable after document scrolling;
- `/login` is internal and the two absolute links retain secure external-link
  attributes;
- `Cổng dịch vụ công` is absent.

Save screenshots and temporary browser scripts outside the repository. Stop
the dev server/browser session after verification.

- [ ] **Step 3: Review the final diff and blast radius**

Run:

```bash
rtk git diff --name-only
```

Confirm only the two implementation files and two approved documentation files
changed. Pass that file list to GitNexus change detection and request an
independent code review. Fix substantive findings, then repeat affected checks.

- [ ] **Step 4: Commit and push**

```bash
rtk git add src/app/page.tsx src/__tests__/portal-root-route.test.ts \
  docs/superpowers/specs/2026-07-19-cdc-portal-three-column-design.md \
  docs/superpowers/plans/2026-07-19-cdc-portal-three-column.md
rtk git commit -m "feat: Redesign CDC portal layout"
rtk git fetch origin
rtk git rebase origin/main
rtk git push -u origin feat/portal-three-column-layout
rtk git status --short --branch
```

Expected: branch is clean and up to date with its remote.
