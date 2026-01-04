# Context Save: QC Entry Page Redesign

**Date:** 2026-01-04
**Session:** Brainstorming → Planning Pipeline
**Status:** Ready for execution

## Summary

Redesigned the Analyst QC Entry page from card-based layout to a hybrid data table + side sheet approach. Created implementation plan and ingested 15 Beads issues with dependencies.

## Design Decisions Made

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout approach | Hybrid (table + side sheet) | Speed of table + detail visibility of sheet |
| Specialty filtering | Top segmented control | Server-side via URL params, familiar pattern |
| Table columns | Name, Level, Status, Sparkline | Scannable, shows trend at-a-glance |
| Detail panel | Side sheet (400px, right) | Inline expand was confusing, sheet keeps table clean |
| Entry flow | Expand first | Click row → sheet opens → enter value → submit → stays open |
| Chart size | 200px (medium) | Compact, less scrolling |
| State management | URL params | `?specialty=X&id=Y`, fully server-side |

## Key Files

### Design Documents
- `docs/plans/2026-01-04-qc-entry-redesign.md` - Approved design
- `docs/plans/2026-01-04-qc-entry-redesign-tasks.md` - Implementation plan

### Current Implementation (to be replaced)
- `src/app/(dashboard)/analyst/qc-entry/page.tsx` - Server component
- `src/components/qc/qc-entry-page-client.tsx` - Tab-based layout (DELETE)
- `src/components/qc/qc-assay-card.tsx` - Card component (DELETE)

### New Component Structure
```
src/components/qc-entry/
├── qc-entry-header.tsx         (~40 lines)
├── specialty-filter.tsx        (~60 lines)
├── qc-assay-table.tsx          (~100 lines)
├── qc-table-row.tsx            (~80 lines)
├── qc-detail-sheet.tsx         (~120 lines)
├── qc-entry-form.tsx           (~100 lines)
├── qc-sparkline.tsx            (~60 lines)
├── levey-jennings-chart.tsx    (~120 lines)
└── qc-recent-history.tsx       (~50 lines)
```

## Beads Issues Created

**Epic:** lims-lite-341a - QC Entry Page Redesign

**Section 1 (P0, parallel - ready now):**
- lims-lite-0kd0: Create qc-entry-header.tsx
- lims-lite-nva3: Create specialty-filter.tsx
- lims-lite-ghfy: Create qc-sparkline.tsx

**Section 2 (P1, sequential):**
- lims-lite-o89z: Create qc-table-row.tsx (blocked by ghfy)
- lims-lite-gro1: Create qc-assay-table.tsx (blocked by o89z)

**Section 3 (P1, mostly parallel - ready now):**
- lims-lite-5guv: Create qc-recent-history.tsx
- lims-lite-j6ap: Create levey-jennings-chart.tsx
- lims-lite-4wk1: Adapt qc-entry-form.tsx
- lims-lite-4xu7: Create qc-detail-sheet.tsx (blocked by 5guv, j6ap, 4wk1)

**Section 4 (P2):**
- lims-lite-9rzl: Rewrite page.tsx (blocked by 0kd0, nva3, gro1, 4xu7)
- lims-lite-oa2s: Extract types.ts

**Section 5 (P2):**
- lims-lite-vaae: Delete old components (blocked by 9rzl)
- lims-lite-cgp0: Manual QA testing
- lims-lite-visk: Typecheck and build (blocked by vaae)

## Dependency Graph

```
Section 1 (parallel):     Section 3 (parallel):
  0kd0 (header) ─────┐      5guv (history) ───┐
  nva3 (filter) ─────┼──┐   j6ap (chart) ─────┼─→ 4xu7 (sheet)
  ghfy (sparkline) ──┘  │   4wk1 (form) ──────┘        │
        │               │                              │
        ▼               │                              │
  o89z (row) ───→ gro1 (table) ────────────────────────┼──→ 9rzl (page)
                                                       │         │
                                                       └─────────┘
                                                                 │
                                                                 ▼
                                                          vaae (delete)
                                                                 │
                                                                 ▼
                                                          visk (build)
```

## Ready Tasks (9 unblocked)

1. **lims-lite-0kd0** [P0] - Create qc-entry-header.tsx
2. **lims-lite-nva3** [P0] - Create specialty-filter.tsx
3. **lims-lite-ghfy** [P0] - Create qc-sparkline.tsx
4. **lims-lite-5guv** [P1] - Create qc-recent-history.tsx
5. **lims-lite-j6ap** [P1] - Create levey-jennings-chart.tsx
6. **lims-lite-4wk1** [P1] - Adapt qc-entry-form.tsx
7. **lims-lite-oa2s** [P2] - Extract types.ts
8. **lims-lite-cgp0** [P2] - Manual QA testing
9. **lims-lite-341a** [P1] - Epic (parent)

## Execution Options Pending

User needs to choose:
- **A) Subagent-Driven** - This session, parallel subagents
- **B) Parallel Session** - New terminal in worktree
- **C) Manual** - User drives with `bd ready`

## Git Commits This Session

- `8cfe864` - feat(qc): add QC seed data and fix analyst QC entry page (prior)
- `d40273d` - docs(qc): add QC entry page redesign plan

## Resume Commands

```bash
# See ready tasks
powershell -Command "bd ready"

# Start robot triage
powershell -Command "bv --robot-triage"

# Claim a task
powershell -Command "bd update lims-lite-0kd0 --status=in_progress"
```
