# QC Entry Page Redesign

**Date:** 2026-01-04
**Status:** Approved
**Approach:** Hybrid (Data Table + Side Sheet)

## Problem Statement

Current QC Entry page has usability issues:
- Tab-based specialty navigation is cluttered
- Card grid (3 columns) is hard to scan with 13+ assays
- Mini L-J charts are too small (96px)
- Too many clicks: Card → Dialog → Enter → Submit

## Design Summary

Replace card-based layout with a **data table + side sheet** hybrid:
- Scannable table with sparklines for quick overview
- Side sheet with full L-J chart for detailed entry
- Server-side filtering via URL params
- Minimal client-side JavaScript

## Layout

```
┌─────────────────────────────────────────┬──────────────────────────────┐
│           TABLE (60%)                   │     SIDE SHEET (40%)         │
├─────────────────────────────────────────┤                              │
│ Glucose (Fasting)  │ L1 │ ● Đạt │ ∿∿∿  │  ┌─ Glucose (Fasting) L1 ─┐  │
│ Glucose (Fasting)  │ L2 │ ● Đạt │ ∿∿∿  │  │                         │  │
│ ─────────────────────────────────────── │  │  Kết quả: [____] mg/dL │  │
│ Total Cholesterol  │ L1 │ ○ Chờ │ ∿∿∿  │  │  [Lưu kết quả]          │  │
│ Total Cholesterol► │ L2 │ ⚠ Báo │ ∿∿∿◄ │  │                         │  │
│ ─────────────────────────────────────── │  │  Mean: 100  SD: 1.5    │  │
│ Creatinine         │ L1 │ ✕ Lỗi │ ∿∿∿  │  │  Lô: 12345ABC           │  │
│ Creatinine         │ L2 │ ● Đạt │ ∿∿∿  │  │                         │  │
│                                         │  │  ┌─ L-J CHART ───────┐ │  │
│                                         │  │  │   ●  ●    ●  ●    │ │  │
│                                         │  │  │  ══════════════   │ │  │
│                                         │  │  │    ●   ●    ●     │ │  │
│                                         │  │  └───────────────────┘ │  │
│                                         │  └─────────────────────────┘  │
└─────────────────────────────────────────┴──────────────────────────────┘
```

## Components

### 1. Page Header
- Back button + Page title + Walkthrough trigger
- Analyst name displayed subtly

### 2. Specialty Filter (Segmented Control)
- Horizontal pill buttons with counts: `[Hóa sinh (8)]`
- Server-side filtering via URL: `/analyst/qc-entry?specialty=hoa-sinh`
- "Tất cả" shows all assays

### 3. Data Table (Collapsed State)
| Column | Width | Content |
|--------|-------|---------|
| Tên xét nghiệm | flex-1 | Assay name |
| Mức | 60px | "L1" or "L2" badge |
| Trạng thái | 120px | Status badge with icon |
| Xu hướng | 140px | Sparkline (15 points, 24px tall) |

### 4. Side Sheet (400px fixed width)
| Section | Content |
|---------|---------|
| Header | Assay name, material info, lot, close button |
| Entry Form | Input field, unit, reference values, submit |
| L-J Chart | 200px height, 30-day trend, SD lines |
| Recent History | Last 3-5 entries with date/value/status |

## URL-based State

```
/analyst/qc-entry                           → All specialties, no selection
/analyst/qc-entry?specialty=hoa-sinh        → Filtered to Hóa sinh
/analyst/qc-entry?specialty=hoa-sinh&id=123 → Filtered + Sheet open
```

## Interaction Flow

1. Analyst opens `/analyst/qc-entry`
2. Sees table with all assays, grouped by specialty
3. Clicks specialty filter → URL updates, table filters (server-side)
4. Clicks table row → URL adds `?id=X`, sheet slides in
5. Enters value in form, clicks "Lưu kết quả"
6. Server action saves, sheet shows success, stays open
7. Clicks another row → Sheet updates to new assay
8. Clicks ✕ → Sheet closes, URL removes `?id`

## File Structure

```
src/app/(dashboard)/analyst/qc-entry/
├── page.tsx                    (~80 lines)  - Server data fetch + layout

src/components/qc-entry/
├── qc-entry-header.tsx         (~40 lines)  - Title, back button
├── specialty-filter.tsx        (~60 lines)  - Segmented control links
├── qc-assay-table.tsx          (~100 lines) - Table wrapper + headers
├── qc-table-row.tsx            (~80 lines)  - Single row (Link wrapper)
├── qc-detail-sheet.tsx         (~120 lines) - Sheet container
├── qc-entry-form.tsx           (~100 lines) - Form (client)
├── qc-sparkline.tsx            (~60 lines)  - Mini trend (client)
├── levey-jennings-chart.tsx    (~120 lines) - Full chart (client)
└── qc-recent-history.tsx       (~50 lines)  - History list
```

**All files under 350 lines.**

## Visual Styling

### Status Badges
| Status | Background | Text |
|--------|------------|------|
| Đạt | `bg-emerald-100` | `text-emerald-700` |
| Chờ QC | `bg-slate-100` | `text-slate-600` |
| Cảnh báo | `bg-amber-100` | `text-amber-700` |
| Vi phạm | `bg-red-100` | `text-red-700` |

### Table
- Rounded corners (`rounded-xl`)
- Subtle border (`border border-slate-200`)
- Selected row: `bg-emerald-50 border-l-4 border-emerald-500`
- Hover: `hover:bg-slate-50 transition`

### Side Sheet
- Fixed right, `h-full w-[400px]`
- Shadow: `shadow-xl`
- Slide animation: `translate-x-full → translate-x-0`
- Border: `border-l border-slate-200`

## Files to Delete After Migration

- `src/components/qc/qc-entry-page-client.tsx`
- `src/components/qc/qc-assay-card.tsx`

## Implementation Notes

1. **Server-first:** Filter and selection state in URL, minimal client JS
2. **Reuse:** Adapt existing `mini-levey-jennings-chart.tsx` for sparklines
3. **Form:** Use `useActionState` for form submission with server actions
4. **Chart:** Keep Recharts for L-J visualization (client component)
