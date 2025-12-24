# Design: Thống kê số lượng mẫu theo nhóm kỹ thuật

**Date:** 2025-12-24
**Status:** Approved
**Author:** Claude + User brainstorming session

## Overview

Add a new grouped bar chart to the Reports page showing sample counts by lab specialty (nhóm kỹ thuật) with interactive status filtering, wired to the master date range filter.

## Requirements

- **Chart type:** Grouped vertical bar chart
- **Filter UI:** Toggle chips with "Tất cả" quick action
- **Default state:** All statuses selected
- **Data:** Count samples per specialty (with test count in tooltip)
- **Filtering:** Server-side via URL params (consistent with date range)
- **Availability:** Both analyst and manager roles

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Chart type | Grouped bar | Clear comparison across specialties and statuses |
| Orientation | Vertical bars | Easier to read, specialties on X-axis |
| Filter approach | Toggle chips | Visual, compact, matches existing LIMS patterns |
| Filter state | URL params | Bookmarkable, consistent with date range filter |
| Data aggregation | Server-side | Pre-filtered data, lean payloads |
| Metric | Sample count | Primary metric, test count in tooltip |

## UI Layout

```
┌─────────────────────────────────────────────────────────┐
│  Thống kê Mẫu theo Nhóm Kỹ Thuật                        │
│  Số lượng mẫu phân bổ theo chuyên khoa                  │
├─────────────────────────────────────────────────────────┤
│  [Tất cả] [Đã nhận] [Đã chỉ định] [Đang thực hiện]     │
│           [Chờ duyệt] [Hoàn thành] [Loại bỏ]           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│   ██                                                    │
│   ██ ▓▓                    ██                          │
│   ██ ▓▓ ░░        ██      ██ ▓▓                        │
│   ██ ▓▓ ░░ ▒▒    ██ ▓▓    ██ ▓▓ ░░                     │
│  ─────────────────────────────────────────────          │
│  Huyết   Sinh   Miễn   Vi    Sinh   Giải               │
│  học     hóa    dịch   sinh  học    phẫu               │
│                              phân   bệnh               │
│                              tử                        │
└─────────────────────────────────────────────────────────┘
```

### Position in Reports Grid

Full width (3 columns), placed after Sample Accession Trend and before Staff Productivity.

## Data Architecture

### URL Parameters

```
/manager/reports?fromDate=2025-01-01&toDate=2025-01-31&statuses=received,assigned,in_progress
```

- `statuses`: Comma-separated list of status codes
- Default (when absent): All statuses selected
- Empty `statuses=` means none selected (empty chart)

### Database RPC Function

```sql
CREATE OR REPLACE FUNCTION get_specialty_sample_stats(
  p_from_date TIMESTAMPTZ,
  p_to_date TIMESTAMPTZ,
  p_statuses TEXT[]
)
RETURNS TABLE (
  specialty_code TEXT,
  specialty_name TEXT,
  status TEXT,
  sample_count BIGINT,
  test_count BIGINT
)
LANGUAGE plpgsql SECURITY INVOKER STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ls.code,
    ls.name,
    s.status::TEXT,
    COUNT(DISTINCT s.id),
    COUNT(r.id)
  FROM samples s
  INNER JOIN results r ON r.sample_id = s.id
  INNER JOIN assay_definitions ad ON ad.id = r.assay_id
  INNER JOIN lab_specialties ls ON ls.id = ad.specialty_id
  WHERE s.received_at BETWEEN p_from_date AND p_to_date
    AND s.status = ANY(p_statuses)
    AND s.deleted_at IS NULL
    AND ad.deleted_at IS NULL
    AND ls.deleted_at IS NULL
  GROUP BY ls.code, ls.name, ls.display_order, s.status
  ORDER BY ls.display_order, s.status;
END;
$$;
```

### TypeScript Types

```typescript
interface SpecialtySampleData {
  specialtyCode: string      // 'HEM', 'BIO', etc.
  specialtyName: string      // 'Huyết học', 'Sinh hóa'
  status: SampleStatus
  sampleCount: number
  testCount: number
}

interface SpecialtySampleChartProps {
  data: SpecialtySampleData[]
  selectedStatuses: SampleStatus[]
  isLoading?: boolean
  height?: number
}
```

### Data Flow

1. Page reads `fromDate`, `toDate`, `statuses` from URL searchParams
2. Server Action `getSpecialtySampleStats(dateRange, statuses)` calls RPC
3. Data passed to `ReportsLayout` → `SpecialtySampleChart`
4. Toggle chips use `useRouter().push()` to update URL
5. URL change triggers page re-render with new filtered data

## Component Implementation

### Toggle Chips with URL Updates

```typescript
'use client'

import { useRouter, useSearchParams } from 'next/navigation'

function StatusFilterChips({ selectedStatuses }: { selectedStatuses: SampleStatus[] }) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const updateStatuses = (newStatuses: SampleStatus[]) => {
    const params = new URLSearchParams(searchParams.toString())
    if (newStatuses.length === ALL_STATUSES.length) {
      params.delete('statuses')  // Default = all, cleaner URL
    } else {
      params.set('statuses', newStatuses.join(','))
    }
    router.push(`?${params.toString()}`)
  }

  const toggleStatus = (status: SampleStatus) => {
    const newSet = new Set(selectedStatuses)
    newSet.has(status) ? newSet.delete(status) : newSet.add(status)
    updateStatuses([...newSet])
  }

  const toggleAll = () => {
    const allSelected = selectedStatuses.length === ALL_STATUSES.length
    updateStatuses(allSelected ? [] : ALL_STATUSES)
  }
}
```

### Custom Tooltip

```typescript
function SpecialtyTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="bg-white dark:bg-slate-800 p-3 rounded shadow-lg border">
      <p className="font-medium">{label}</p>
      {payload.map(entry => (
        <p key={entry.dataKey} style={{ color: entry.fill }}>
          {statusLabels[entry.dataKey]}: {entry.value} mẫu
          ({entry.payload[`${entry.dataKey}_tests`]} xét nghiệm)
        </p>
      ))}
    </div>
  )
}
```

## File Changes

| File | Change |
|------|--------|
| `supabase/migrations/XXX_specialty_sample_stats.sql` | New RPC function |
| `src/types/index.ts` | Add `SpecialtySampleData` type |
| `src/app/actions/reports.ts` | Add `getSpecialtySampleStats()` |
| `src/components/specialty-sample-chart.tsx` | New chart component |
| `src/components/status-filter-chips.tsx` | New filter component |
| `src/components/reports/reports-layout.tsx` | Add chart to grid, new props |
| `src/app/(dashboard)/manager/reports/page.tsx` | Parse statuses, fetch data |
| `src/app/(dashboard)/analyst/reports/page.tsx` | Same changes |

## Implementation Tasks

1. Create SQL migration for `get_specialty_sample_stats` RPC function
2. Add `SpecialtySampleData` type to `src/types/index.ts`
3. Create `getSpecialtySampleStats` Server Action
4. Create `StatusFilterChips` component
5. Create `SpecialtySampleChart` component
6. Update `ReportsLayout` with new props and chart placement
7. Update manager reports page (parse statuses, fetch data)
8. Update analyst reports page (same changes)
9. Run typecheck and verify
10. Test end-to-end with different filter combinations
