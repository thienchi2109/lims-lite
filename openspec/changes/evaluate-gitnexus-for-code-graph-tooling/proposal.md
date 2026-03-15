## Why

The current graph-backed code navigation workflow is unreliable in this Windows workspace. On March 15, 2026, repeated calls against indexed symbols in `E:\lims-lite` returned `Failed to compute relative file path` for path-based knowledge-graph operations such as reference lookup and definition reads, even after a fresh reindex. This blocks impact analysis and weakens the developer workflow described in `CLAUDE.md`.

GitNexus is a promising alternative to evaluate because it focuses on repository knowledge graphs, code relationships, and AI-assisted exploration. However, its published workflow is browser-centric rather than a documented drop-in MCP replacement, so a direct cutover would be premature without a repo-specific feasibility pilot.

## What Changes

- Evaluate GitNexus as a replacement or augmentation path for the current GKG-based workflow in `E:\lims-lite`
- Define Windows-specific acceptance criteria for required engineering tasks:
  - definition lookup
  - caller/reference discovery
  - impact analysis
  - semantic exploration
  - stable repository import/indexing
- Require a staged rollout:
  - baseline current GKG failures
  - run GitNexus pilot side-by-side
  - update developer instructions only after acceptance criteria pass
  - keep documented rollback and fallback paths
- Align repo guidance so `AGENTS.md` and `CLAUDE.md` reference only tooling that is validated in this environment
- **BREAKING (internal tooling only):** if the pilot succeeds, developer workflow instructions and local tool setup will change

## Impact

- Affected specs: new capability `developer-tooling`
- Affected code:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `openspec/changes/evaluate-gitnexus-for-code-graph-tooling/*`
  - `docs/plans/2026-03-15-gitnexus-code-graph-tooling.md`
- Operator-managed dependencies:
  - local MCP/tool configuration outside the repo
  - GitNexus installation/runtime
- No runtime product behavior changes for CDC-LIMS users
