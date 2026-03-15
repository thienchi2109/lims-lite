# GitNexus Code Graph Tooling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Determine whether GitNexus can replace or augment the broken GKG workflow for `E:\lims-lite` on Windows, then cut over repo guidance only if parity is demonstrated.

**Architecture:** Run a side-by-side pilot instead of a hard swap. Baseline the current GKG failures, evaluate GitNexus on the same repository tasks, and update `AGENTS.md` and `CLAUDE.md` only after the candidate tool proves stable for definition lookup, reference discovery, and impact analysis in this workspace.

**Tech Stack:** GitNexus, existing `knowledge-graph` MCP, Morph search, PowerShell, OpenSpec documentation

---

### Task 1: Capture the current GKG failure baseline

**Files:**
- Modify: `openspec/changes/evaluate-gitnexus-for-code-graph-tooling/design.md`
- Modify: `docs/plans/2026-03-15-gitnexus-code-graph-tooling.md`

**Step 1: Reproduce the failing workflows**

Record the exact failing cases already observed on March 15, 2026:
- `usePrintHandlers` in `src/hooks/use-print-handlers.ts`
- `cn` in `src/lib/utils.ts`
- `requireAuth` in `src/lib/auth-helpers.ts`

Expected result:
- `search_codebase_definitions` succeeds
- `get_references` fails with `Failed to compute relative file path`
- `read_definitions` fails with `Failed to compute relative file path`

**Step 2: Confirm the repo is indexed**

Verify the project root is still recognized as `E:\lims-lite` and that a fresh reindex completes.

Expected result:
- Indexing succeeds
- Path-based operations still fail, proving the issue is not just stale index data

**Step 3: Save the baseline evidence**

Add a concise baseline section to the design doc if the reproduction changes, including:
- failing symbol
- file path
- operation attempted
- exact error text

**Step 4: Commit**

```bash
git add openspec/changes/evaluate-gitnexus-for-code-graph-tooling/design.md docs/plans/2026-03-15-gitnexus-code-graph-tooling.md
git commit -m "docs: capture GKG baseline for GitNexus evaluation"
```

### Task 2: Stand up a GitNexus pilot outside the repo

**Files:**
- Modify: `docs/plans/2026-03-15-gitnexus-code-graph-tooling.md`
- Modify: `openspec/changes/evaluate-gitnexus-for-code-graph-tooling/tasks.md`

**Step 1: Install GitNexus in a separate working directory**

Follow the GitNexus README workflow in its own folder, not inside `E:\lims-lite`.

Suggested commands:

```powershell
git clone https://github.com/abhigyanpatwari/GitNexus.git E:\tools\GitNexus
cd E:\tools\GitNexus
npm install
npm run dev
```

Expected result:
- The local development server starts successfully
- The browser UI is available for repository import and graph generation

**Step 2: Import this repository into GitNexus**

Use GitNexus’s documented repository import path for `E:\lims-lite` or an archive of the repo if direct local import is not supported.

Expected result:
- The repo can be loaded and analyzed without path corruption
- The generated graph includes TypeScript files under `src/`

**Step 3: Stop immediately if the repo cannot be ingested reliably**

If import/indexing fails or requires brittle manual workarounds, mark GitNexus as not viable for full replacement and do not continue to cutover tasks.

**Step 4: Commit**

```bash
git add openspec/changes/evaluate-gitnexus-for-code-graph-tooling/tasks.md docs/plans/2026-03-15-gitnexus-code-graph-tooling.md
git commit -m "docs: add GitNexus pilot setup notes"
```

### Task 3: Execute the functional parity checklist

**Files:**
- Modify: `docs/plans/2026-03-15-gitnexus-code-graph-tooling.md`

**Step 1: Test symbol lookup**

Use the same repo symbols from the baseline:
- `usePrintHandlers`
- `cn`
- `requireAuth`

Pass criteria:
- GitNexus surfaces the correct file and symbol for each test case
- Results are fast enough to use during normal navigation

**Step 2: Test caller/reference discovery**

For each symbol, verify whether GitNexus can show inbound usages or an equivalent impact view.

Pass criteria:
- The result identifies real call sites or import/use locations
- The output is specific enough to guide a refactor

**Step 3: Test impact analysis**

Pick one symbol with multiple consumers and answer:
- what files depend on it
- whether changes would affect client and server code
- what tests or related modules should be reviewed

Pass criteria:
- The workflow is better than raw grep for dependency mapping
- The result is accurate on at least one non-trivial symbol

**Step 4: Record pass/fail with evidence**

For each category, record:
- `Pass`, `Partial`, or `Fail`
- evidence summary
- blocker or workaround

**Step 5: Commit**

```bash
git add docs/plans/2026-03-15-gitnexus-code-graph-tooling.md
git commit -m "docs: record GitNexus parity results"
```

### Task 4: Decide the adoption path

**Files:**
- Modify: `openspec/changes/evaluate-gitnexus-for-code-graph-tooling/proposal.md`
- Modify: `openspec/changes/evaluate-gitnexus-for-code-graph-tooling/design.md`
- Modify: `openspec/changes/evaluate-gitnexus-for-code-graph-tooling/tasks.md`

**Step 1: Choose one outcome**

Allowed outcomes:
- Full replacement: GitNexus covers the required workflows
- Supplemental adoption: GitNexus is useful, but not agent-parity complete
- Rejection: GitNexus does not solve the actual problem

**Step 2: Document the decision criteria**

A full replacement requires:
- reliable Windows repository ingestion
- correct symbol lookup
- usable caller/reference discovery
- usable impact analysis
- no critical gap between documented repo workflow and real tool behavior

**Step 3: Write rollback notes**

Document what to do if the chosen tool fails after adoption:
- restore prior `AGENTS.md` and `CLAUDE.md` instructions
- keep Morph/manual search as emergency fallback
- preserve baseline failure evidence for future upstream debugging

**Step 4: Commit**

```bash
git add openspec/changes/evaluate-gitnexus-for-code-graph-tooling/proposal.md openspec/changes/evaluate-gitnexus-for-code-graph-tooling/design.md openspec/changes/evaluate-gitnexus-for-code-graph-tooling/tasks.md
git commit -m "docs: finalize GitNexus migration decision"
```

### Task 5: Update repo guidance only after approval

**Files:**
- Modify: `AGENTS.md`
- Modify: `CLAUDE.md`

**Step 1: Replace inaccurate hard requirements**

Remove instructions that require a tool which is no longer validated in this environment.

**Step 2: Add the approved workflow**

If GitNexus is a full replacement:
- document the new default workflow
- explain when to use GitNexus vs Morph vs direct code reading

If GitNexus is only supplemental:
- document it as an optional explorer tool
- keep agent-critical instructions on tools that actually work

**Step 3: Re-run the checklist after doc changes**

The documented workflow must match the tool behavior engineers can actually execute.

**Step 4: Commit**

```bash
git add AGENTS.md CLAUDE.md
git commit -m "docs: update code graph tooling guidance"
```

## Evaluation Checklist

Mark each item as `Pass`, `Partial`, or `Fail`.

### Repository ingestion

- [ ] GitNexus can ingest `E:\lims-lite` or a repo archive without path corruption
- [ ] TypeScript files under `src/` appear in the generated graph
- [ ] Re-analyzing the repo does not require brittle manual cleanup

### Core navigation

- [ ] `usePrintHandlers` resolves to `src/hooks/use-print-handlers.ts`
- [ ] `cn` resolves to `src/lib/utils.ts`
- [ ] `requireAuth` resolves to `src/lib/auth-helpers.ts`

### Reference discovery

- [ ] GitNexus shows inbound usages or equivalent callers for at least one symbol above
- [ ] The results are specific enough to replace current `get_references` usage
- [ ] No Windows path rewrite is required to make reference discovery work

### Impact analysis

- [ ] GitNexus can answer "what breaks if I change this symbol?" for one real repo symbol
- [ ] The answer includes enough related files/modules to guide safe edits
- [ ] The result is more useful than raw grep alone

### Adoption readiness

- [ ] The workflow is stable enough to document in `AGENTS.md`
- [ ] The workflow is stable enough to document in `CLAUDE.md`
- [ ] A fallback path is documented if GitNexus fails after adoption
- [ ] The team can explain whether GitNexus is a full replacement, supplemental tool, or rejected option
