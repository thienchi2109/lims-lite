# Responsive Dashboard Header Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a three-mode dashboard header that uses a hamburger below 768px, compact icon navigation from 768px through 1799px, and the current full navigation from 1800px upward without overlap.

**Architecture:** Keep responsive mode ownership in `DashboardHeader`, which renders one mobile, compact, and full row with mutually exclusive Tailwind visibility classes. Give `DashboardNav` and `UserProfileDropdown` explicit presentation variants so route, active-state, dropdown, and logout logic remain shared. Keep exactly one mounted `GlobalSearch` instance responsible for the global keyboard shortcut.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS 4, Radix UI primitives, Lucide icons, Vitest, Testing Library, agent-browser.

**Design Spec:** `docs/superpowers/specs/2026-07-23-responsive-dashboard-header-design.md`

---

## Chunk 1: Leaf Component Contracts

### Task 1: Lock Compact Global Search Presentation

**Files:**
- Modify: `src/components/__tests__/global-search-serial.test.tsx`
- Modify: `src/components/global-search.tsx:37-190`

- [ ] **Step 1: Write the failing compact-trigger test**

Add a test that renders:

```tsx
render(
    <ScannerContext.Provider value={noOpScannerContext}>
        <GlobalSearch variant="compact" skipShortcut />
    </ScannerContext.Provider>,
)
```

Assert:

```tsx
const trigger = screen.getByRole('button', { name: 'Tìm kiếm' })
expect(trigger.className).toContain('h-10')
expect(trigger.className).toContain('w-10')
expect(trigger.className).toContain('shrink-0')
```

The existing full trigger behavior and serial-search tests must remain unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk npm run test:run -- src/components/__tests__/global-search-serial.test.tsx
```

Expected: FAIL because the compact trigger is still `h-9 w-9`, lacks
`shrink-0`, and has no explicit accessible name. The test must reach these
assertions instead of failing because `ScannerContext` is missing.

- [ ] **Step 3: Implement the minimal compact presentation**

In `GlobalSearch`:

- set compact classes to `h-10 w-10 shrink-0 p-0`;
- add `aria-label={isCompact ? 'Tìm kiếm' : undefined}`;
- do not change dialog, debounce, scanner, routing, or shortcut behavior.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 1 command again.

Expected: all tests in `global-search-serial.test.tsx` pass.

- [ ] **Step 5: Commit Task 1**

```bash
rtk git add src/components/global-search.tsx src/components/__tests__/global-search-serial.test.tsx
rtk git commit -m "fix: Make compact search trigger accessible"
```

### Task 2: Add User Profile Trigger Variants

**Files:**
- Modify: `src/components/__tests__/user-profile-dropdown-cache-clear.test.tsx`
- Modify: `src/components/user-profile-dropdown.tsx:30-105`

- [ ] **Step 1: Write failing variant tests**

Extend `UserProfileDropdown` tests with:

```tsx
const user = { full_name: 'Manager HIV', role: 'manager' }

const { rerender } = render(
    <UserProfileDropdown user={user} variant="compact" />,
)

let trigger = screen.getByRole('button', { name: 'Mở menu tài khoản' })
expect(trigger.className).toContain('h-10')
expect(trigger.className).toContain('w-10')
expect(trigger.className).toContain('shrink-0')
expect(within(trigger).queryByText('Manager HIV')).toBeNull()

rerender(<UserProfileDropdown user={user} variant="full" />)
trigger = screen.getByRole('button', { name: 'Mở menu tài khoản' })
expect(within(trigger).getByText('Manager HIV')).toBeDefined()
```

Also render without `variant` and verify the trigger retains the existing
responsive `hidden sm:flex` presentation contract. Update the existing logout
test selector to `{ name: 'Mở menu tài khoản' }`. Assert compact mode hides both
name and role while full mode retains both; make the Chevron mock observable
when asserting its presence.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk npm run test:run -- src/components/__tests__/user-profile-dropdown-cache-clear.test.tsx
```

Expected: FAIL because the component has no `variant` prop or account-menu
accessible name.

- [ ] **Step 3: Implement the presentation-only variants**

Add:

```ts
type UserProfileDropdownVariant = 'responsive' | 'compact' | 'full'
```

Default `variant` to `responsive`.

Apply these trigger contracts:

- `responsive`: preserve current avatar and `hidden sm:flex` text behavior;
- `compact`: fixed `h-10 w-10 shrink-0 p-0`, avatar-only;
- `full`: render avatar, name, role, and chevron without responsive hiding.

Add `aria-label="Mở menu tài khoản"` to the dropdown trigger. Constrain the full
name with a stable max width and `truncate` so long names cannot expand the
header. Do not change dropdown content, logout, cache clearing, or navigation.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 2 command again.

Expected: all profile dropdown tests pass, including the existing failed-logout
cache isolation test.

- [ ] **Step 5: Commit Task 2**

```bash
rtk git add src/components/user-profile-dropdown.tsx src/components/__tests__/user-profile-dropdown-cache-clear.test.tsx
rtk git commit -m "feat: Add responsive profile trigger variants"
```

## Chunk 2: Navigation Modes

### Task 3: Add Mobile, Compact, and Full Dashboard Navigation Variants

**Files:**
- Create: `src/components/__tests__/dashboard-nav-responsive.test.tsx`
- Modify: `src/components/dashboard-nav.tsx:24-134`

- [ ] **Step 1: Write the failing navigation contract tests**

Mock `usePathname` as `/manager/users` and render each explicit variant:

```tsx
const manager = { full_name: 'Manager A', role: 'manager' as const }

render(<DashboardNav user={manager} variant="compact" />)
```

Assert compact mode:

- renders eight manager destinations as links;
- each link has the Vietnamese route label as its accessible name;
- each link has fixed `h-10 w-10 shrink-0` metrics;
- after hover and keyboard focus, tooltip content contains the same Vietnamese
  label;
- `/manager/users` has `aria-current="page"`;
- no visible text label is rendered inside compact links.

Render `variant="full"` and assert:

- eight manager links render with visible labels;
- links contain `shrink-0 whitespace-nowrap`;
- `/manager/users` has `aria-current="page"`.

Render `variant="mobile"` and assert:

- the trigger is named `Mở menu điều hướng`;
- after `userEvent.click()` opens the Sheet, it contains all eight destinations;
- the active destination has `aria-current="page"`.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk npm run test:run -- src/components/__tests__/dashboard-nav-responsive.test.tsx
```

Expected: FAIL because `DashboardNav` has no explicit variant, compact links, or
`aria-current` semantics.

- [ ] **Step 3: Implement shared navigation variants**

Add:

```ts
type DashboardNavVariant = 'mobile' | 'compact' | 'full'
```

Require `variant` in `DashboardNavProps`.

Keep one role-based `links` array and one shared active-route calculation.
Render only the requested presentation:

- `mobile`: existing Sheet flow, change hidden label to
  `Mở menu điều hướng`, add `aria-current`;
- `compact`: render each destination as a `Link` with fixed 40px dimensions,
  icon only, `aria-label`, active styling, `aria-current`, and the existing
  tooltip primitives; include visible `focus-visible:ring-2` styling that
  remains visible in light and dark modes;
- `full`: render existing icon + label links with `shrink-0`,
  `whitespace-nowrap`, and `aria-current`.

Use `Tooltip`, `TooltipTrigger`, and `TooltipContent` from the existing UI
primitive. Do not reorder routes or change role access.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the Task 3 command again.

Expected: all responsive navigation tests pass.

- [ ] **Step 5: Keep Task 3 uncommitted until header callers are updated**

Do not commit after Task 3 because `DashboardHeader` still uses the old
`DashboardNav` API. Continue directly to Task 4 and commit the navigation and
header migration together after focused tests and typecheck pass.

## Chunk 3: Header Composition

### Task 4: Compose the Three Responsive Header Rows

**Files:**
- Create: `src/components/__tests__/dashboard-header-responsive.test.tsx`
- Create: `src/components/__tests__/dashboard-header-search-shortcut.test.tsx`
- Modify: `src/components/__tests__/dashboard-header-doctor.test.tsx`
- Modify: `src/components/dashboard-header.tsx:21-120`

- [ ] **Step 1: Write failing responsive composition tests**

In a new focused test, mock child components while preserving their props.
Render a manager header and assert:

```tsx
expect(screen.getByTestId('dashboard-header-mobile-row').className)
    .toContain('flex')
expect(screen.getByTestId('dashboard-header-mobile-row').className)
    .toContain('md:hidden')
expect(screen.getByTestId('dashboard-header-compact-row').className)
    .toContain('hidden')
expect(screen.getByTestId('dashboard-header-compact-row').className)
    .toContain('md:flex')
expect(screen.getByTestId('dashboard-header-compact-row').className)
    .toContain('min-[1800px]:hidden!')
expect(screen.getByTestId('dashboard-header-full-row').className)
    .toContain('hidden')
expect(screen.getByTestId('dashboard-header-full-row').className)
    .toContain('min-[1800px]:flex')
```

Reject `max-[1799px]` and old `xl` visibility classes on these row containers.

Assert child contracts:

- nav variants are `mobile`, `compact`, and `full`;
- profile variants are `responsive`, `compact`, and `full`;
- compact and full search instances receive `skipShortcut`;
- exactly one search instance does not receive `skipShortcut`;
- compact row hides the subtitle and keeps the product name;
- compact controls are wrapped in non-shrinking groups.

Add a separate behavior test that uses real `GlobalSearch` instances with a
`ScannerContext.Provider` and mocked search/command dependencies. Render the
manager header, dispatch `Ctrl+K`, close the dialog, then dispatch `Meta+K`;
assert each shortcut opens exactly one dialog even though three responsive
search instances are mounted.

Update doctor restrictions to expect three nav/profile/scanner render sites and
zero search instances. Update the existing desktop-search test to use
`dashboard-header-full-row` and `dashboard-header-full-search`, preserving its
containment and minimum-width assertions.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
rtk npm run test:run -- \
  src/components/__tests__/dashboard-header-responsive.test.tsx \
  src/components/__tests__/dashboard-header-search-shortcut.test.tsx \
  src/components/__tests__/dashboard-header-doctor.test.tsx
```

Expected: FAIL because only the current mobile/tablet and desktop rows exist.

- [ ] **Step 3: Implement the three header rows**

Refactor `DashboardHeader` to render:

1. Mobile row:
   - `flex md:hidden`;
   - existing hamburger/navigation flow through
     `<DashboardNav variant="mobile" />`;
   - current logo, title, subtitle, compact search, scanner, and
     `<UserProfileDropdown variant="responsive" />`;
   - use `min-w-0 flex-1` for the left group so title truncation cannot push
     controls outside the viewport.

2. Compact row:
   - `hidden md:flex min-[1800px]:hidden!` so the Tailwind v4 important
     modifier guarantees that the 1800px hide rule overrides `md:flex`;
   - stable 64px row;
   - logo and product name, no subtitle;
   - `<DashboardNav variant="compact" />`;
   - compact search with `skipShortcut`;
   - scanner;
   - `<UserProfileDropdown variant="compact" />`;
   - restrained fixed gaps and `shrink-0` controls so manager's eight icons fit
     at 768px.

3. Full row:
   - `hidden min-[1800px]:flex`;
   - preserve the current full desktop layout and styling;
   - `<DashboardNav variant="full" />`;
   - full search with `skipShortcut`;
   - `<UserProfileDropdown variant="full" />`;
   - give the search slot a practical minimum width and keep full nav controls
     non-shrinking.

The mobile search remains the single mounted owner of `Cmd/Ctrl+K`; compact and
full searches receive `skipShortcut`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run the Task 4 command again.

Expected: responsive composition and doctor restrictions pass.

- [ ] **Step 5: Run the complete changed-component test set**

Run:

```bash
rtk npm run test:run -- \
  src/components/__tests__/dashboard-header-responsive.test.tsx \
  src/components/__tests__/dashboard-header-search-shortcut.test.tsx \
  src/components/__tests__/dashboard-header-doctor.test.tsx \
  src/components/__tests__/dashboard-nav-responsive.test.tsx \
  src/components/__tests__/global-search-serial.test.tsx \
  src/components/__tests__/user-profile-dropdown-cache-clear.test.tsx
```

Expected: all focused regression tests pass.

- [ ] **Step 6: Run typecheck before the combined nav/header commit**

```bash
rtk npm run typecheck
```

Expected: exit 0 with all `DashboardNav` callers migrated.

- [ ] **Step 7: Commit Tasks 3 and 4 together**

```bash
rtk git add \
  src/components/dashboard-nav.tsx \
  src/components/dashboard-header.tsx \
  src/components/__tests__/dashboard-nav-responsive.test.tsx \
  src/components/__tests__/dashboard-header-responsive.test.tsx \
  src/components/__tests__/dashboard-header-search-shortcut.test.tsx \
  src/components/__tests__/dashboard-header-doctor.test.tsx
rtk git commit -m "fix: Make dashboard header responsive"
```

## Chunk 4: Verification and Delivery

### Task 5: Run Static and React Quality Gates

**Files:**
- Verify only.

- [ ] **Step 1: Run TypeScript**

```bash
rtk npm run typecheck
```

Expected: exit 0.

- [ ] **Step 2: Run React Doctor on the diff**

```bash
rtk npm run react-doctor:diff
```

Expected: no new actionable findings in changed React files.

- [ ] **Step 3: Run Git diff checks**

```bash
rtk git diff --check origin/main...HEAD
```

Expected: no whitespace errors.

### Task 6: Verify the Rendered Header

**Files:**
- Verify only unless a failing viewport reveals a requirement gap.

- [ ] **Step 1: Start the local Next.js dev server**

Run:

```bash
rtk npm run dev -- --hostname 127.0.0.1 --port 3100
```

Keep the process session open. Do not start Docker, PostgreSQL, Storage, or
Cloudflare Tunnel in this workspace.

- [ ] **Step 2: Authenticate only if the local route requires it**

Use the user-authorized manager account. If OTP is required, stop and request
the code from the user. Do not deploy this branch merely to obtain a browser
target.

- [ ] **Step 3: Check the approved viewport matrix with agent-browser**

Verify:

- 375px and 767px: hamburger/mobile row;
- 768px, 1024px, 1280px, 1440px, 1728px, and 1799px: compact row;
- 1800px and 1920px: full row.

At each width assert:

- `document.documentElement.scrollWidth <= window.innerWidth`;
- visible header controls have non-overlapping bounding boxes;
- header height is stable within the active mode;
- active nav state is visible;
- compact tooltips appear on hover and focus;
- search, scanner, profile dropdown, and hamburger remain operable.

Capture screenshots at 767px, 768px, 1799px, and 1800px.

Use a named browser session:

```bash
rtk agent-browser --session responsive-header open http://127.0.0.1:3100
rtk agent-browser --session responsive-header wait --load networkidle
rtk agent-browser --session responsive-header snapshot -i
```

For each matrix width run:

```bash
rtk agent-browser --session responsive-header set viewport WIDTH 1000
```

Use `agent-browser eval` to collect the active header row, child bounding boxes,
`scrollWidth`, unexpected clipped text, and focus-ring computed styles. Repeat
focus checks in light and dark themes. Save boundary screenshots under
`/tmp/lims-lite-responsive-header/`.

- [ ] **Step 4: Re-run focused tests after any browser-driven fix**

Use the complete changed-component test command from Task 4.

- [ ] **Step 5: Close browser and server sessions**

```bash
rtk agent-browser --session responsive-header close
```

Stop the local dev-server process and confirm port 3100 is released.

### Task 7: Final Review, Commit, and Push

**Files:**
- Review all changed files.

- [ ] **Step 1: Run GitNexus change detection**

Run:

```bash
rtk git diff --name-only --diff-filter=ACMR origin/main...HEAD
```

Pass that list to GitNexus `detect_changes` with compare scope and
`base_ref: "origin/main"` for the `lims-lite` repository.

- [ ] **Step 2: Request code review**

Use `superpowers:requesting-code-review`. Triage findings with
`superpowers:receiving-code-review`; apply only verified, in-scope fixes.

- [ ] **Step 3: Run final verification**

Re-run focused tests, typecheck, React Doctor diff, and:

```bash
rtk git diff --check origin/main...HEAD
```

- [ ] **Step 4: Commit any final review fixes**

Use a conventional `fix:` or `test:` commit matching the actual change.

- [ ] **Step 5: Rebase and push**

```bash
rtk git pull --rebase
rtk git push
rtk git status --short --branch
```

Expected: branch is clean and up to date with
`origin/fix/responsive-dashboard-header`.
