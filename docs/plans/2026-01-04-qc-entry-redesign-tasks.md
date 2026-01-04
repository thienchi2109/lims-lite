# QC Entry Redesign - Implementation Plan

**Design:** `docs/plans/2026-01-04-qc-entry-redesign.md`
**Path:** Quick-plan (UI refactoring)
**Label:** `qc-entry-redesign`

---

## Section 1: Foundation Components (parallel)

### Task 1.1: Create qc-entry-header.tsx
- Create `src/components/qc-entry/qc-entry-header.tsx`
- Server component with back button, title, walkthrough trigger
- Props: `user: { full_name: string }`
- ~40 lines

### Task 1.2: Create specialty-filter.tsx
- Create `src/components/qc-entry/specialty-filter.tsx`
- Server component with horizontal pill buttons
- Props: `specialties: SpecialtyWithQC[]`, `activeSpecialty: string | null`
- Use `Link` for server-side navigation
- ~60 lines

### Task 1.3: Create qc-sparkline.tsx
- Create `src/components/qc-entry/qc-sparkline.tsx`
- Client component using Recharts
- Props: `dataPoints: MiniChartDataPoint[]`, `mean: number`, `sd: number`
- 140px × 24px size
- ~60 lines

---

## Section 2: Table Components

### Task 2.1: Create qc-table-row.tsx
- Create `src/components/qc-entry/qc-table-row.tsx`
- Server component wrapping content in `Link`
- Props: `assay: AssayWithQC`, `isSelected: boolean`, `qcDataPoints: MiniChartDataPoint[]`
- Columns: name, level badge, status badge, sparkline
- ~80 lines
- **Depends on:** 1.3 (sparkline)

### Task 2.2: Create qc-assay-table.tsx
- Create `src/components/qc-entry/qc-assay-table.tsx`
- Server component with table headers and row mapping
- Props: `assays: AssayWithQC[]`, `selectedId: string | null`, `qcResultsByDefinition`
- Group rows by assay name (L1/L2 together)
- ~100 lines
- **Depends on:** 2.1

---

## Section 3: Side Sheet Components

### Task 3.1: Create qc-recent-history.tsx
- Create `src/components/qc-entry/qc-recent-history.tsx`
- Server component showing last 5 QC entries
- Props: `entries: { date: string, value: number, status: string }[]`
- ~50 lines

### Task 3.2: Create levey-jennings-chart.tsx
- Create `src/components/qc-entry/levey-jennings-chart.tsx`
- Client component, full L-J chart (200px height)
- Props: `mean`, `sd`, `dataPoints`, `height?: number`
- Adapt from existing `mini-levey-jennings-chart.tsx`
- Add SD line labels, date x-axis
- ~120 lines

### Task 3.3: Adapt qc-entry-form.tsx
- Copy and adapt `src/components/qc/qc-entry-form.tsx`
- Move to `src/components/qc-entry/qc-entry-form.tsx`
- Use `useActionState` for server action
- Remove dialog wrapper (now in sheet)
- ~100 lines

### Task 3.4: Create qc-detail-sheet.tsx
- Create `src/components/qc-entry/qc-detail-sheet.tsx`
- Server component conditionally rendered when `?id` exists
- Fixed right panel, 400px width
- Contains: header, form, chart, history
- Slide animation via CSS
- ~120 lines
- **Depends on:** 3.1, 3.2, 3.3

---

## Section 4: Page Integration

### Task 4.1: Rewrite page.tsx
- Rewrite `src/app/(dashboard)/analyst/qc-entry/page.tsx`
- Read `searchParams.specialty` and `searchParams.id`
- Use new components: header, filter, table, sheet
- ~80 lines
- **Depends on:** 1.1, 1.2, 2.2, 3.4

### Task 4.2: Add types
- Create `src/components/qc-entry/types.ts` if needed
- Extract shared interfaces: `AssayWithQC`, `SpecialtyWithQC`
- ~30 lines

---

## Section 5: Cleanup & Testing

### Task 5.1: Delete old components
- Delete `src/components/qc/qc-entry-page-client.tsx`
- Delete `src/components/qc/qc-assay-card.tsx`
- **Depends on:** 4.1 (verified working)

### Task 5.2: Manual QA testing
- Test specialty filter navigation
- Test row selection → sheet opens
- Test QC value entry → save
- Test sheet close behavior
- Verify sparklines render correctly

### Task 5.3: Run typecheck and build
- `npm run typecheck`
- `npm run build`
- Fix any errors
- **Depends on:** 5.1

---

## Dependency Graph

```
Section 1 (parallel):
  1.1 ─┐
  1.2 ─┼─→ Section 4.1
  1.3 ─┘
        ↓
Section 2 (sequential):
  1.3 → 2.1 → 2.2 ─→ Section 4.1

Section 3 (mostly parallel):
  3.1 ─┐
  3.2 ─┼─→ 3.4 ─→ Section 4.1
  3.3 ─┘

Section 4:
  4.1 (depends on 1.*, 2.2, 3.4)
  4.2 (parallel)

Section 5:
  4.1 → 5.1 → 5.3
  5.2 (parallel with 5.1)
```

## Summary

| Section | Tasks | Parallel? |
|---------|-------|-----------|
| 1. Foundation | 3 | Yes |
| 2. Table | 2 | Sequential |
| 3. Side Sheet | 4 | Mostly parallel |
| 4. Integration | 2 | Sequential |
| 5. Cleanup | 3 | Mixed |
| **Total** | **14** | |
