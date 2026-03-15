## 1. Baseline And Feasibility

- [ ] 1.1 Capture reproducible GKG failures in `E:\lims-lite` for definition read and reference lookup
- [ ] 1.2 Install GitNexus in an isolated pilot environment and import this repository
- [ ] 1.3 Execute the evaluation checklist in `docs/plans/2026-03-15-gitnexus-code-graph-tooling.md`
- [ ] 1.4 Record pass/fail results for Windows path handling, indexing, definition lookup, reference discovery, and impact analysis

## 2. Decision And Cutover Prep

- [ ] 2.1 Decide whether GitNexus is:
  - a full replacement
  - a supplemental human tool
  - not viable for this repo
- [ ] 2.2 Document fallback and rollback procedures for any partial or full adoption path
- [ ] 2.3 Prepare instruction updates for `AGENTS.md` and `CLAUDE.md` based on the chosen outcome

## 3. Adoption

- [ ] 3.1 Update repo guidance only after acceptance criteria pass
- [ ] 3.2 Re-run the checklist after instruction changes to verify the documented workflow is accurate
- [ ] 3.3 Archive the change after the chosen tooling path is stable
