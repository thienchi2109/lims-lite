# Fix Critical Lint And Security Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the highest-risk React Compiler/runtime lint errors first, then address production security advisories, while leaving lower-priority test lint debt for a separate pass.

**Architecture:** Treat this as three independent stabilization batches: runtime React Compiler correctness, production dependency security, and runtime typing. Each batch must preserve current user-facing behavior and finish with focused tests plus the repo quality gates. Do not broaden scope into visual redesigns or test-only lint cleanup until the runtime and security items are green.

**Tech Stack:** Next.js 16, React 19, TypeScript, ESLint 9 with React Compiler rules, Vitest, npm, React Doctor.

---

## Current Evidence

- `npm run typecheck`: pass.
- `npm run test:run`: pass, 99 files, 642 passed, 4 skipped.
- `npm run build`: pass.
- `npm run react-doctor -- --score`: pass, score 96.
- `npm run lint`: fail with 178 errors and 131 warnings.
- `npm audit --json`: 5 vulnerabilities, 3 high and 2 moderate, 0 critical.

High-priority lint breakdown:

- Runtime React Compiler / Hooks errors: 21.
- Runtime `@typescript-eslint/no-explicit-any` errors under `src/`: 55.
- Test-only lint errors: 90, mostly `no-explicit-any`; defer until runtime work is stable.

## GitNexus Blast Radius

Run before implementation:

```bash
gitnexus list
gitnexus impact useApprovalUrlState --repo lims-lite --direction upstream --max-depth 3 --include-tests
gitnexus context useApprovalUrlState --repo lims-lite --file src/hooks/use-approval-url-state.ts
gitnexus context ApprovalTabsClient --repo lims-lite --file src/components/approval-tabs-client.tsx
gitnexus context ApprovalMobileLayout --repo lims-lite --file src/components/approval-mobile-layout.tsx
gitnexus query "quality control manager page qc sessions filter bar page component" --repo lims-lite
```

Observed blast radius from GitNexus on 2026-04-09:

- `useApprovalUrlState` is **CRITICAL** risk: 2 direct callers, 12 affected approval processes, 1 affected module.
- Direct callers of `useApprovalUrlState`:
  - `src/components/approval-tabs-client.tsx:ApprovalTabsClient`
  - `src/components/approval-mobile-layout.tsx:ApprovalMobileLayout`
- Affected approval processes include:
  - `ApprovalTabsClient -> CallClientAction`
  - `ApprovalTabsClient -> FetchSampleDetail`
  - `ApprovalTabsClient -> CreateApprovalSearchParams`
  - `ApprovalTabsClient -> ResolveApprovalTab`
  - `ApprovalTabsClient -> CreateApprovalSampleCoreData`
  - `ApprovalTabsClient -> GetOppositeApprovalTab`
  - the matching `ApprovalMobileLayout` flows for the same operations.
- `ApprovalTabsClient` and `ApprovalMobileLayout` are entry components with no upstream callers in the graph, but each participates in 6 approval processes. Treat them as high-blast entrypoints even though upstream impact reports `LOW`.
- `QualityControlPage` has no upstream callers in the graph and participates in `QualityControlPage -> RequiredEnv`. Treat it as a page entrypoint: low upstream graph blast, medium product blast because it is manager QC.
- `useGridHighlight`, `SearchInput`, `AccessionMobileWizard`, and `useFaviconBadge` reported no upstream callers or affected processes. Treat them as leaf/local changes, but still verify with focused component/hook tests because graph coverage can miss JSX imports and hook-only call sites.

Execution priority after blast-radius analysis:

1. Approval URL state and approval entrypoints first: `useApprovalUrlState`, `ApprovalTabsClient`, `ApprovalMobileLayout`.
2. Manager QC page next: `QualityControlPage` and QC filter state.
3. Leaf React Compiler fixes next: status badges, accession wizard, grid highlight, search input, favicon badge, mobile-only, portal QR, walkthrough provider, date range filter, add-method dialog.
4. Dependency security upgrades.
5. Runtime `any` cleanup.
6. Test/script lint debt.

## File Structure

Modify these files in priority order:

- `src/hooks/use-approval-url-state.ts`: derive URL fallback state safely without synchronous effect-state update. GitNexus marks this as the highest blast radius item.
- `src/components/approval-tabs-client.tsx`: remove sync effect-state update; verify approval URL, fetch detail, and action flows.
- `src/components/approval-mobile-layout.tsx`: same approval URL/detail behavior as desktop approval tabs.
- `src/app/(dashboard)/manager/quality-control/page.tsx`: remove impure render-time `Date.now()` complaint and replace Supabase nested relation `any` casts with local types/helpers.
- `src/components/qc/qc-sessions-filter-bar.tsx`: derive filters/search from URL or move sync to event boundaries.
- `src/components/accession-mobile-wizard.tsx`: remove render-time state update and destructure callbacks before memoized handlers.
- `src/components/result-status-badge.tsx`: stop reading refs during render.
- `src/components/sample-status-badge.tsx`: stop reading refs during render.
- `src/components/sample-grid/hooks/useGridHighlight.ts`: remove synchronous effect-state update pattern while preserving row highlight behavior.
- `src/components/ui/search-input.tsx`: replace prop-to-state sync effect with a compiler-safe pattern.
- `src/components/sample-filters/use-filter-params.ts`: replace search value sync effect with a compiler-safe pattern.
- `src/components/add-method-to-assay-dialog.tsx`: move `loadMethods` above its effect or wrap it in `useCallback`.
- `src/components/reports/date-range-filter.tsx`: move `detectActivePreset` above its effect or derive active preset with `useMemo`.
- `src/components/batch-save-toolbar.tsx`: avoid synchronous state updates inside effects for animation/success flags.
- `src/components/mobile-only.tsx`: replace mount-state effect with a compiler-safe client-only pattern, or isolate the rule if unavoidable.
- `src/components/portal-qr-code.tsx`: derive portal URL without effect-state update.
- `src/components/sample-filters/FilterPopover.tsx`: stop reading refs during render at the sorted specialty logic.
- `src/components/walkthrough/walkthrough-provider.tsx`: store Driver instance in a ref instead of state when it does not affect render.
- `src/hooks/use-favicon-badge.ts`: avoid mutating snapshot objects in the effect path flagged by immutability.
- `package.json` and `package-lock.json`: upgrade vulnerable dependencies after runtime lint fixes.

Add focused tests where coverage is missing:

- Create `src/components/__tests__/status-badge-animation.test.tsx` for status badge update behavior.
- Create `src/components/sample-grid/hooks/useGridHighlight.test.tsx` for highlight add/remove behavior.
- Create or extend `src/components/__tests__/search-input.test.tsx` for URL sync/back button behavior.
- Extend `src/hooks/__tests__/use-approval-url-state.test.tsx`.
- Create focused tests for any changed QC filter or approval selection behavior if no existing test exercises the edited branch.

## Chunk 1: Runtime React Compiler Fixes

Because GitNexus marks `useApprovalUrlState` as the only critical blast-radius symbol, execute the approval slice before the small leaf fixes. Do not batch approval URL changes with unrelated badge/search/grid edits.

### Task 0: Fix approval URL state blast radius first

**Files:**
- Modify: `src/hooks/use-approval-url-state.ts`
- Modify: `src/components/approval-tabs-client.tsx`
- Modify: `src/components/approval-mobile-layout.tsx`
- Test: `src/hooks/__tests__/use-approval-url-state.test.tsx`
- Test: `src/components/__tests__/approval-tabs-client.test.tsx`
- Test: `src/components/__tests__/approval-mobile-layout.test.tsx`

- [ ] **Step 1: Re-run GitNexus context before editing**

Run:

```bash
gitnexus context useApprovalUrlState --repo lims-lite --file src/hooks/use-approval-url-state.ts
gitnexus impact useApprovalUrlState --repo lims-lite --direction upstream --max-depth 3 --include-tests
```

Expected: direct callers are still `ApprovalTabsClient` and `ApprovalMobileLayout`.

- [ ] **Step 2: Add or extend approval URL tests**

Cover these behaviors:

- `useApprovalUrlState` resolves fallback tab/sample ID from props.
- Browser back/forward or server-provided sample changes update the selected approval sample as before.
- Desktop `ApprovalTabsClient` and mobile `ApprovalMobileLayout` still fetch sample detail and update URL search params.

- [ ] **Step 3: Run focused approval tests before implementation**

Run:

```bash
npm run test:run -- src/hooks/__tests__/use-approval-url-state.test.tsx src/components/__tests__/approval-tabs-client.test.tsx src/components/__tests__/approval-mobile-layout.test.tsx
```

Expected: existing tests pass before edits; new assertions may fail until implementation.

- [ ] **Step 4: Implement minimal approval fix**

Prefer deriving fallback URL state with `useMemo` and storing only user overrides in state. Avoid synchronous `setState` inside effects in all three files.

- [ ] **Step 5: Verify approval blast radius**

Run:

```bash
npm run test:run -- src/hooks/__tests__/use-approval-url-state.test.tsx src/components/__tests__/approval-tabs-client.test.tsx src/components/__tests__/approval-mobile-layout.test.tsx
npm run lint -- src/hooks/use-approval-url-state.ts src/components/approval-tabs-client.tsx src/components/approval-mobile-layout.tsx
gitnexus impact useApprovalUrlState --repo lims-lite --direction upstream --max-depth 3 --include-tests
```

Expected: tests pass, no `react-hooks/*` errors in the three files, and GitNexus impact still identifies only the two known direct callers.

### Task 1: Fix render-time state and ref reads in small components

**Files:**
- Modify: `src/components/accession-mobile-wizard.tsx`
- Modify: `src/components/result-status-badge.tsx`
- Modify: `src/components/sample-status-badge.tsx`
- Test: `src/components/__tests__/accession-mobile-wizard.test.tsx`
- Test: `src/components/__tests__/status-badge-animation.test.tsx`

- [ ] **Step 1: Add or extend tests**

Cover these behaviors:

- `AccessionMobileWizard` moves to success step after `submitSuccess` becomes true.
- `AccessionMobileWizard` calls `onSave` and `onReset` exactly once from the same UI paths as before.
- `ResultStatusBadge` and `SampleStatusBadge` render the correct labels and do not throw during rerender from one status to another.

- [ ] **Step 2: Run focused tests and confirm current behavior**

Run:

```bash
npm run test:run -- src/components/__tests__/accession-mobile-wizard.test.tsx
```

Expected: existing tests pass before edits. New status-badge tests may fail until created/implemented.

- [ ] **Step 3: Implement minimal fixes**

Use these patterns:

- In `AccessionMobileWizard`, destructure `onSave`, `onReset`, and other used props at the top of the component. Move the `setCurrentStep(3)` out of render into a `useEffect` keyed on `submitSuccess`.
- In both status badge components, replace `prevStatusRef.current !== status` reads during render with state updated after commit, or use a short-lived animation trigger set by an effect when status changes.

- [ ] **Step 4: Run verification for this task**

Run:

```bash
npm run test:run -- src/components/__tests__/accession-mobile-wizard.test.tsx src/components/__tests__/status-badge-animation.test.tsx
npm run lint -- src/components/accession-mobile-wizard.tsx src/components/result-status-badge.tsx src/components/sample-status-badge.tsx
```

Expected: focused tests pass and these three files have no React Compiler lint errors.

### Task 2: Fix effect-state synchronization hot spots

**Files:**
- Modify: `src/components/sample-grid/hooks/useGridHighlight.ts`
- Modify: `src/components/ui/search-input.tsx`
- Modify: `src/components/sample-filters/use-filter-params.ts`
- Test: `src/components/sample-grid/hooks/useGridHighlight.test.tsx`
- Test: `src/components/__tests__/search-input.test.tsx`

- [ ] **Step 1: Add tests for current contracts**

Cover these behaviors:

- `useGridHighlight` skips initial mount when configured, highlights IDs whose `updated_at` changes, and clears them after the timeout.
- `SearchInput` initializes from `searchParams`, debounces URL updates, resets `page` to `1`, and responds to external URL changes.
- `use-filter-params` keeps search input in sync when URL changes externally and preserves local typing while the input has focus.

- [ ] **Step 2: Run focused tests**

Run:

```bash
npm run test:run -- src/components/sample-grid/hooks/useGridHighlight.test.tsx src/components/__tests__/search-input.test.tsx
```

Expected: new tests should fail only where they depend on the pending implementation or missing test files.

- [ ] **Step 3: Implement minimal fixes**

Use these patterns:

- For `useGridHighlight`, consider an event-like deferred update with `queueMicrotask`/timeout or a reducer transition that is not synchronously set inside the effect body. Keep timeout cleanup reliable.
- For `SearchInput` and `use-filter-params`, prefer deriving display value from URL plus local dirty/focus state rather than setting local state immediately in the URL-sync effect.

- [ ] **Step 4: Run verification for this task**

Run:

```bash
npm run test:run -- src/components/sample-grid/hooks/useGridHighlight.test.tsx src/components/__tests__/search-input.test.tsx
npm run lint -- src/components/sample-grid/hooks/useGridHighlight.ts src/components/ui/search-input.tsx src/components/sample-filters/use-filter-params.ts
```

Expected: focused tests pass and these four files have no React Compiler lint errors.

### Task 3: Fix remaining runtime React Compiler files

**Files:**
- Modify: `src/components/add-method-to-assay-dialog.tsx`
- Modify: `src/components/reports/date-range-filter.tsx`
- Modify: `src/components/batch-save-toolbar.tsx`
- Modify: `src/components/mobile-only.tsx`
- Modify: `src/components/portal-qr-code.tsx`
- Modify: `src/components/qc/qc-sessions-filter-bar.tsx`
- Modify: `src/components/sample-filters/FilterPopover.tsx`
- Modify: `src/components/walkthrough/walkthrough-provider.tsx`
- Modify: `src/hooks/use-favicon-badge.ts`
- Test: focused existing tests for each edited area; create missing tests only for behavior with no coverage.

- [ ] **Step 1: Add or identify focused tests**

Use existing tests where available:

```bash
npm run test:run -- tests/realtime-favicon-badge.test.ts
```

Approval tests are already handled in Task 0. For this task, add missing tests only for remaining files without relevant coverage.

- [ ] **Step 2: Implement minimal fixes**

Use these patterns:

- Move functions above effects or wrap them in `useCallback` before use.
- Replace derived state effects with `useMemo` where the value is fully derived from props/search params.
- Replace state-held imperative instances with refs when they do not affect render.
- Avoid reading or mutating ref-held objects during render; make immutable copies in effects before mutation.

- [ ] **Step 3: Run lint only on remaining runtime React Compiler files**

Run:

```bash
npm run lint -- src/components/add-method-to-assay-dialog.tsx src/components/reports/date-range-filter.tsx src/components/batch-save-toolbar.tsx src/components/mobile-only.tsx src/components/portal-qr-code.tsx src/components/qc/qc-sessions-filter-bar.tsx src/components/sample-filters/FilterPopover.tsx src/components/walkthrough/walkthrough-provider.tsx src/hooks/use-favicon-badge.ts
```

Expected: no React Compiler errors remain in these files. If unrelated `any` errors appear in the same files, record them for Chunk 3 unless they are small and directly adjacent.

- [ ] **Step 4: Run full React Compiler error check**

Run:

```bash
npx eslint -f json -o /tmp/lims-eslint-after-react.json || true
node -e "const r=require('/tmp/lims-eslint-after-react.json'); const e=r.flatMap(f=>f.messages.map(m=>({file:f.filePath,msg:m}))).filter(x=>x.msg.severity===2 && x.msg.ruleId?.startsWith('react-hooks/')); console.log(e.map(x=>`${x.msg.ruleId} ${x.file}:${x.msg.line}:${x.msg.column}`).join('\n')); process.exit(e.length?1:0)"
```

Expected: exit 0 and no `react-hooks/*` errors.

### Task 4: Commit runtime React Compiler fixes

- [ ] **Step 1: Run gates**

Run:

```bash
npm run typecheck
npm run test:run
npm run build
npm run react-doctor -- --score
```

Expected: all pass. Full `npm run lint` may still fail due `no-explicit-any`; that is expected until Chunk 3.

- [ ] **Step 2: Commit**

Run:

```bash
git add src
git commit -m "fix: Resolve runtime React compiler lint errors"
```

## Chunk 2: Production Security Advisories

### Task 5: Upgrade direct production dependency advisories first

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Confirm latest safe Next.js 16 patch**

Run:

```bash
npm view next version
npm view eslint-config-next version
```

Expected: identify a Next.js version at or above `16.1.7`. Keep `eslint-config-next` on a compatible 16.x version.

- [ ] **Step 2: Upgrade Next.js patch line**

Run:

```bash
npm install next@latest eslint-config-next@latest
```

If latest is outside the intended major line, use the newest `16.x` version instead:

```bash
npm install next@16 eslint-config-next@16
```

- [ ] **Step 3: Verify advisory reduction**

Run:

```bash
npm audit --json
npm run typecheck
npm run build
```

Expected: Next.js moderate advisories are gone and build remains green.

### Task 6: Upgrade vulnerable dev dependency chain

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Inspect fix paths**

Run:

```bash
npm audit
npm ls vite picomatch flatted brace-expansion
```

Expected: identify whether fixes come through `vitest`, `@vitest/ui`, `eslint`, `eslint-config-next`, `typescript-eslint`, or transitive overrides.

- [ ] **Step 2: Prefer normal package upgrades before overrides**

Run:

```bash
npm install -D vitest@latest @vitest/ui@latest eslint@latest eslint-config-next@latest
```

If this pulls incompatible majors or leaves advisories unresolved, stop and record the exact blocker before adding overrides.

- [ ] **Step 3: Use overrides only if package upgrades cannot resolve transitive CVEs**

Only if needed, add targeted npm `overrides` for patched transitive versions. Do not override React, Next, or core framework packages unless audit proves it is safe.

- [ ] **Step 4: Verify**

Run:

```bash
npm audit --json
npm run typecheck
npm run test:run
npm run build
```

Expected: `npm audit` has 0 high vulnerabilities. If moderate dev-only issues remain, document why and create a follow-up issue.

- [ ] **Step 5: Commit**

Run:

```bash
git add package.json package-lock.json
git commit -m "fix: Update vulnerable frontend dependencies"
```

## Chunk 3: Runtime Typing Errors

### Task 7: Replace runtime `any` casts in high-density files

**Files:**
- Modify: `src/app/actions/results-approval.ts`
- Modify: `src/components/sample-activity-feed.tsx`
- Modify: `src/app/(dashboard)/manager/quality-control/page.tsx`
- Modify: `src/app/actions/qc-sessions.ts`
- Modify: `src/lib/utils-lims.ts`

- [ ] **Step 1: Add local typed helpers for Supabase nested relation normalization**

Use a helper pattern for relation values that can arrive as object or one-element array:

```ts
function firstRelation<T>(value: T | T[] | null | undefined): T | null {
    return Array.isArray(value) ? value[0] ?? null : value ?? null
}
```

Place the helper near the file that needs it first. Promote to a shared helper only if at least three runtime files need the same exact helper.

- [ ] **Step 2: Replace `any` in `quality-control/page.tsx` first**

Replace casts around `session.assay`, `v.result`, `definition`, `assay`, `material`, and `session` with explicit local relation types and `firstRelation`.

- [ ] **Step 3: Run focused checks**

Run:

```bash
npm run typecheck
npm run lint -- 'src/app/(dashboard)/manager/quality-control/page.tsx'
```

Expected: no `any` or React Compiler errors in the file.

- [ ] **Step 4: Repeat for the remaining high-density files**

Run after each file:

```bash
npm run typecheck
npm run lint -- src/app/actions/results-approval.ts src/components/sample-activity-feed.tsx src/app/actions/qc-sessions.ts src/lib/utils-lims.ts
```

Expected: `no-explicit-any` count falls materially without changing behavior.

- [ ] **Step 5: Commit**

Run:

```bash
git add src/app/actions/results-approval.ts src/components/sample-activity-feed.tsx 'src/app/(dashboard)/manager/quality-control/page.tsx' src/app/actions/qc-sessions.ts src/lib/utils-lims.ts
git commit -m "fix: Tighten runtime relation typing"
```

### Task 8: Sweep remaining runtime `any` errors

**Files:**
- Modify all remaining runtime `src/` files reported by:

```bash
npx eslint -f json -o /tmp/lims-eslint-runtime-any.json || true
node - <<'NODE'
const r = require('/tmp/lims-eslint-runtime-any.json')
const isTest = (p) => p.includes('/__tests__/') || /\.test\.[jt]sx?$/.test(p)
for (const file of r) {
  const rel = file.filePath.replace(process.cwd() + '/', '')
  if (!rel.startsWith('src/') || isTest(rel)) continue
  for (const msg of file.messages) {
    if (msg.severity === 2 && msg.ruleId === '@typescript-eslint/no-explicit-any') {
      console.log(`${rel}:${msg.line}:${msg.column}`)
    }
  }
}
NODE
```

- [ ] **Step 1: Replace direct `any` with domain types, `unknown` plus narrowing, or typed Supabase relation helpers**

Do not silence the rule. Do not use broad `Record<string, unknown>` unless the data is genuinely unstructured and narrowed before use.

- [ ] **Step 2: Run runtime-only lint report**

Run the command above again.

Expected: no runtime `src/` `no-explicit-any` errors remain.

- [ ] **Step 3: Run gates**

Run:

```bash
npm run typecheck
npm run test:run
npm run build
npm run react-doctor -- --score
npm run lint
```

Expected: `typecheck`, tests, build, and React Doctor pass. `npm run lint` may still fail only in test files, scripts, or openspec docs.

- [ ] **Step 4: Commit**

Run:

```bash
git add src
git commit -m "fix: Remove runtime explicit any usage"
```

## Chunk 4: Deferred Lint Debt

### Task 9: Clean test and script lint blockers after runtime is stable

**Files:**
- Modify test files under `src/**/__tests__`, `src/**/*.test.*`, and `tests/**/*.test.*`.
- Modify: `scripts/generate-jwt-keys.js`
- Modify: `scripts/sync-supabase-jwt-keys.js`
- Modify: `openspec/changes/add-clients-and-link-samples/qr-parser-reference.ts`

- [ ] **Step 1: Convert test `any` to typed mocks**

Prefer `vi.mocked`, explicit mock function types, and `unknown` with narrow assertions.

- [ ] **Step 2: Convert CommonJS script imports only if runtime supports ESM**

If scripts are intended to remain CommonJS, prefer ESLint overrides for `scripts/*.js` instead of rewriting working operational scripts.

- [ ] **Step 3: Run final full gates**

Run:

```bash
npm run lint
npm run typecheck
npm run test:run
npm run build
npm audit --json
```

Expected: lint passes, core gates pass, audit has no high vulnerabilities.

- [ ] **Step 4: Commit**

Run:

```bash
git add src tests scripts openspec eslint.config.mjs package.json package-lock.json
git commit -m "fix: Clear remaining lint blockers"
```

## Landing

- [ ] Run `git status --short`.
- [ ] Run `git pull --rebase`.
- [ ] Run `bd sync` if `bd` is available in PATH.
- [ ] Run `git push`.
- [ ] Run `git status --short --branch` and confirm the branch is up to date with `origin/main`.
