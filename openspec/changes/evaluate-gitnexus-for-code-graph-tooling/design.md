## Context

`CLAUDE.md` currently treats graph-backed code navigation as a primary workflow and explicitly prefers GKG for definition and reference discovery. In this workspace, the indexed project exists and `search_codebase_definitions` succeeds, but path-based operations such as `get_references` and `read_definitions` fail consistently with `Failed to compute relative file path`. That makes the current workflow partially functional and unreliable for real engineering tasks.

GitNexus is attractive because it builds repository knowledge graphs and supports interactive code exploration, but its public documentation describes a browser-based experience rather than an MCP tool contract that agents can call directly. That means the real question is not "swap one tool name for another," but "can GitNexus satisfy the workflows this repo currently delegates to GKG?"

## Goals / Non-Goals

### Goals

- Restore reliable graph-assisted code navigation for this repo on Windows
- Preserve required engineering workflows:
  - find definitions
  - find references/callers
  - perform impact analysis before edits
  - explore code relationships faster than raw grep alone
- Make the migration evidence-based, with clear pass/fail acceptance criteria
- Keep repo instructions synchronized with validated tooling
- Document rollback and fallback paths before any cutover

### Non-Goals

- Changing CDC-LIMS product features or runtime behavior
- Replacing Morph, Context7, or other non-graph tools that already work
- Building a custom GitNexus integration in the same change unless feasibility proves it is necessary and tractable
- Forcing immediate decommission of GKG before parity is demonstrated

## Decisions

### Decision: Treat GitNexus as a feasibility pilot first

GitNexus SHALL be evaluated first as a pilot, not assumed to be a drop-in replacement. The implementation plan will test whether GitNexus can cover the workflows that currently depend on GKG in this repo.

Why:
- We have direct evidence that GKG is failing in this environment
- We do not yet have direct evidence that GitNexus exposes agent-usable APIs equivalent to GKG
- A staged evaluation avoids replacing one unreliable workflow with another

### Decision: Gate cutover on workflow parity, not on feature marketing

The replacement decision SHALL be based on concrete tasks in `E:\lims-lite`, not generic capability claims. The pilot must pass all of these categories on Windows:

1. Repository import/indexing succeeds for the repo
2. Symbol-to-definition lookup is accurate
3. Caller/reference discovery works on real TypeScript files
4. Impact analysis is usable before refactors
5. Results are stable enough to update repo instructions without caveats that negate the benefit

### Decision: Prefer side-by-side rollout with explicit fallback

During evaluation and early adoption, repo guidance SHALL preserve fallback paths:
- Morph/code reading for semantic exploration
- manual search when graph tooling fails
- existing GKG only where it still works

Why:
- This repo already depends on several complementary tools
- A side-by-side rollout reduces workflow interruption
- It keeps engineers productive while validation is still in progress

### Decision: Separate human-facing exploration from agent-facing automation

If GitNexus proves useful only as a browser-based human tool, it may still be adopted as a developer aid, but it SHALL NOT replace GKG instructions that imply direct agent tool parity. Full replacement requires either:

- native agent-usable APIs that cover the required workflows, or
- an approved bridge layer with documented maintenance cost

## Alternatives Considered

### Fix GKG only

Pros:
- Lowest workflow churn if the Windows bug can be fixed quickly
- Keeps current instructions mostly intact

Cons:
- Current failures are blocking today
- Root cause appears to be in path handling outside this repo
- No timeline is guaranteed for an upstream fix

### Keep GKG and rely on Morph/manual search

Pros:
- No migration work
- Uses tools that already exist

Cons:
- Loses targeted reference analysis workflow
- Keeps incorrect repo guidance in place
- Increases engineer friction on impact analysis tasks

### Evaluate GitNexus with staged cutover

Pros:
- Gives a realistic escape hatch from the current failure mode
- Forces evidence-based comparison
- Allows partial adoption if only some workflows improve

Cons:
- Requires local setup and evaluation effort
- May expose gaps if GitNexus is not agent-native

## Risks / Trade-offs

- GitNexus may be strong for interactive exploration but weak as a direct agent replacement
  - Mitigation: keep the proposal scoped to evaluation and staged adoption
- Repo prompts may drift from actual tool availability
  - Mitigation: update `AGENTS.md` and `CLAUDE.md` only after acceptance gates pass
- Engineers may assume full migration success before validation
  - Mitigation: document explicit pass/fail checklist and rollback path

## Migration Plan

1. Capture baseline GKG failures with reproducible repo-specific cases
2. Install and evaluate GitNexus against the checklist in `docs/plans/2026-03-15-gitnexus-code-graph-tooling.md`
3. Decide one of three outcomes:
   - keep GKG and wait for fix
   - adopt GitNexus as a supplemental human tool
   - cut over repo guidance to GitNexus-based workflow
4. If cutover is approved, update repo instructions and keep rollback notes until stable

## Open Questions

- Does GitNexus expose enough machine-usable interfaces for agent workflows, or is it primarily a browser tool?
- Does GitNexus handle local Windows paths for this repo more reliably than the current knowledge-graph server?
- If GitNexus needs a bridge layer for agent use, is that maintenance cost justified versus fixing GKG upstream?
