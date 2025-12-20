# Sample Accession Trend Chart - Design Document

**Date:** 2025-12-20
**Feature:** Sample Accession Trend Chart with Cumulative Total
**Epic:** Phase 6 - Reports Dashboard Enhancement
**Priority:** P2

---

## Overview

Add a **Sample Accession Trend Chart** to the Reports page that visualizes sample accession volume trends over time with cumulative totals. The chart will automatically adjust granularity (daily/monthly/yearly) based on the selected date range.

**User Story:**
As a Lab Manager or Analyst, I want to see sample accession trends over time so I can identify volume patterns, peak periods, and track cumulative progress toward goals.

---

## Design Decisions

### 1. Time Granularity (Option A - Auto-Select)

**Decision:** Fixed granularity based on date range (automatic)

- **≤ 31 days** → Daily view (bars per day)
- **≤ 365 days** → Monthly view (bars per month)
- **> 365 days** → Yearly view (bars per year)

**Rationale:**
- Prevents overwhelming users with hundreds of data points
- Matches industry standard analytics dashboards
- Simplifies UI (no toggle buttons needed)
- Provides appropriate detail level for the selected range

**Rejected Alternatives:**
- User-selectable toggle (adds UI complexity, can show too many points)
- Smart hybrid (over-engineering for MVP)

---

### 2. Metrics to Display (Option B - Count + Cumulative)

**Decision:** Dual metrics with dual Y-axis

- **Primary (Bars):** Sample count per period (daily/monthly/yearly)
- **Secondary (Line):** Cumulative total (running sum)

**Rationale:**
- Shows both volume patterns (bars) and progress (cumulative line)
- More analytical value than count alone
- Helps identify trends and forecast capacity needs
- Common pattern in business intelligence dashboards

**Rejected Alternatives:**
- Just sample count (less insight)
- Count + status breakdown (redundant with Sample Status Chart)

---

### 3. Chart Visual Style (Option A - Bars + Line)

**Decision:** Combined chart with bars and line overlay

- **Bars:** Blue gradient (matches theme), sample count per period
- **Line:** Orange/green line, cumulative total
- **Dual Y-axis:** Left for count, Right for cumulative
- **Chart Type:** Recharts `ComposedChart`

**Rationale:**
- Industry standard for volume + cumulative visualization
- Space-efficient (chart is `lg:col-span-1`)
- Easy to correlate volume spikes with cumulative progress
- Recharts handles dual Y-axis elegantly

**Rejected Alternatives:**
- Dual area charts (harder to read exact counts)
- Side-by-side charts (takes too much horizontal space)

---

## Architecture

### Component Structure

```
src/components/sample-accession-trend-chart.tsx (new)
├── Client Component ('use client')
├── Uses Recharts ComposedChart (Bar + Line)
├── Auto-formats period labels (dd/MM, MM/YYYY, YYYY)
├── Custom tooltip showing both metrics
└── Follows existing chart patterns (ChartContainer, loading/empty states)
```

### Data Flow

```
1. Page Level (analyst/reports/page.tsx, manager/reports/page.tsx)
   └── Calls getSampleAccessionTrend(dateRange) Server Action
   └── Passes accessionTrendData to ReportsLayout

2. Layout Level (reports-layout.tsx)
   └── Receives accessionTrendData prop
   └── Passes to SampleAccessionTrendChart component
   └── Places next to Sample Status Chart (lg:col-span-1 each)

3. Component Level (sample-accession-trend-chart.tsx)
   └── Renders ComposedChart with bars + line
   └── Dual Y-axis: Left (count), Right (cumulative)
   └── Tooltip shows period, count, cumulative
```

---

## Database Layer

### RPC Function: `get_sample_accession_trend`

**Location:** `supabase/migrations/082_sample_accession_trend.sql`

**Signature:**
```sql
get_sample_accession_trend(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
) RETURNS TABLE (
    period TEXT,
    sample_count BIGINT,
    cumulative_count BIGINT
)
```

**Implementation:**
```sql
CREATE OR REPLACE FUNCTION get_sample_accession_trend(
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ
)
RETURNS TABLE (
    period TEXT,
    sample_count BIGINT,
    cumulative_count BIGINT
)
LANGUAGE plpgsql
SECURITY INVOKER  -- Enforces RLS policies
AS $$
DECLARE
    day_diff INT;
    granularity TEXT;
BEGIN
    -- Calculate date range in days
    day_diff := EXTRACT(EPOCH FROM (end_date - start_date)) / 86400;

    -- Determine granularity
    IF day_diff <= 31 THEN
        granularity := 'daily';
    ELSIF day_diff <= 365 THEN
        granularity := 'monthly';
    ELSE
        granularity := 'yearly';
    END IF;

    -- Return aggregated data based on granularity
    -- Single query with window function (no N+1 issues)
    RETURN QUERY
    SELECT
        CASE granularity
            WHEN 'daily' THEN TO_CHAR(DATE(received_at), 'YYYY-MM-DD')
            WHEN 'monthly' THEN TO_CHAR(DATE_TRUNC('month', received_at), 'YYYY-MM')
            WHEN 'yearly' THEN TO_CHAR(DATE_TRUNC('year', received_at), 'YYYY')
        END AS period,
        COUNT(*)::BIGINT AS sample_count,
        -- Window function calculates cumulative sum in single pass
        SUM(COUNT(*)) OVER (ORDER BY
            CASE granularity
                WHEN 'daily' THEN DATE(received_at)
                WHEN 'monthly' THEN DATE_TRUNC('month', received_at)
                WHEN 'yearly' THEN DATE_TRUNC('year', received_at)
            END
        )::BIGINT AS cumulative_count
    FROM samples
    WHERE received_at >= start_date
      AND received_at <= end_date
      AND deleted_at IS NULL  -- Exclude soft-deleted samples
    GROUP BY period
    ORDER BY period ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_sample_accession_trend TO authenticated;
```

**Performance Optimization:**
```sql
-- Add index for performance (avoid full table scan)
-- Use CONCURRENTLY for production (zero downtime)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_samples_received_at_not_deleted
ON samples(received_at) WHERE deleted_at IS NULL;
```

**Performance & Safety Analysis:**

✅ **No N+1 Query Issues:**
- Single SQL query execution
- Window function (`SUM(COUNT(*)) OVER`) calculates cumulative in one pass
- No loops or multiple round trips
- Client makes one RPC call → gets all data points

✅ **No Race Condition Issues:**
- Read-only operation (no writes, no locks needed)
- PostgreSQL MVCC ensures consistent snapshot
- `SECURITY INVOKER` enforces RLS without locking
- Idempotent and deterministic (same inputs = same output)

✅ **Additional Safety:**
- Respects soft deletes (`deleted_at IS NULL`)
- Timezone-aware (`TIMESTAMPTZ`)
- Efficient aggregation (database-side, single pass)

---

## Type Definitions

**Location:** `src/types/index.ts`

```typescript
// Zod schema for validation
export const SampleAccessionTrendDataSchema = z.object({
  period: z.string(), // "2024-01-15" (daily), "2024-01" (monthly), "2024" (yearly)
  sampleCount: z.number(), // Samples received in this period
  cumulativeCount: z.number(), // Running total up to this period
})

export type SampleAccessionTrendData = z.infer<typeof SampleAccessionTrendDataSchema>
```

---

## Server Action

**Location:** `src/app/actions/reports.ts`

```typescript
/**
 * Fetches sample accession trend data with cumulative totals
 * Automatically adjusts granularity based on date range
 */
export async function getSampleAccessionTrend(
  dateRange: DateRange
): Promise<SampleAccessionTrendData[]> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    const supabase = await createClient()

    // Call RPC function (auto-determines granularity)
    const { data, error } = await supabase.rpc('get_sample_accession_trend', {
      start_date: validated.start,
      end_date: validated.end,
    })

    if (error) throw error

    // Transform to match TypeScript types
    return (
      data?.map((item: {
        period: string
        sample_count: number | bigint
        cumulative_count: number | bigint
      }) => ({
        period: item.period,
        sampleCount: Number(item.sample_count),
        cumulativeCount: Number(item.cumulative_count),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching sample accession trend:', error)
    throw error
  }
}
```

---

## Component Implementation

**Location:** `src/components/sample-accession-trend-chart.tsx`

**Key Features:**
- Client component using Recharts `ComposedChart`
- Dual Y-axis (left: count, right: cumulative)
- Auto-formats period labels for Vietnamese locale
- Custom tooltip showing both metrics
- Loading skeleton and empty state
- Follows existing chart patterns

**Props Interface:**
```typescript
export interface SampleAccessionTrendChartProps {
  data: SampleAccessionTrendData[]
  isLoading?: boolean
  height?: number
}
```

**Chart Configuration:**
- **Bars:** Blue gradient (`getChartColor('blue')`), represents sample count
- **Line:** Orange color (`getChartColor('orange')`), represents cumulative total
- **Left Y-axis:** Sample count (0 to max count)
- **Right Y-axis:** Cumulative total (0 to final cumulative)
- **X-axis:** Period labels (formatted based on granularity)

**Tooltip Content:**
```
Kỳ: 15/01/2024
Số mẫu: 45
Tổng tích lũy: 312
```

---

## Layout Integration

**Location:** `src/components/reports/reports-layout.tsx`

**Current Layout (Row 2):**
```tsx
{/* Row 2: Sample Status + Staff Productivity (manager only) */}
<div className="lg:col-span-1">
  <SampleStatusChart data={statusDistribution} />
</div>
{role === 'manager' && staffProductivity ? (
  <div className="lg:col-span-2">
    <StaffProductivityChart data={staffProductivity} />
  </div>
) : (
  role === 'analyst' && <div className="lg:col-span-2" />
)}
```

**Updated Layout (Row 2):**
```tsx
{/* Row 2: Sample Status + Sample Accession Trend */}
<div className="lg:col-span-1" aria-label="Phân bổ trạng thái mẫu">
  <SampleStatusChart data={statusDistribution} />
</div>
<div className="lg:col-span-1" aria-label="Xu hướng tiếp nhận mẫu">
  <SampleAccessionTrendChart data={accessionTrendData} />
</div>
{/* Row 3: Staff Productivity (manager only, full width) */}
{role === 'manager' && staffProductivity && (
  <div className="lg:col-span-2" aria-label="Năng suất nhân viên">
    <StaffProductivityChart data={staffProductivity} />
  </div>
)}
```

**Balanced Layout:**
- Row 1: TAT Trend (2 cols) + CoA Stats (1 col)
- Row 2: Sample Status (1 col) + Accession Trend (1 col)
- Row 3: Staff Productivity (2 cols, manager only)

---

## Page Updates

**Files to Update:**
- `src/app/(dashboard)/analyst/reports/page.tsx`
- `src/app/(dashboard)/manager/reports/page.tsx`

**Changes:**
1. Import `getSampleAccessionTrend` from `@/app/actions/reports`
2. Add to parallel data fetching in `Promise.all()`
3. Pass `accessionTrendData` to `ReportsLayout` component

**Example (manager page):**
```typescript
const [
  kpiMetricsResult,
  tatTrendResult,
  statusDistributionResult,
  coaStatisticsResult,
  staffProductivityResult,
  accessionTrendResult, // NEW
] = await Promise.all([
  getKPIMetrics(dateRange),
  getTATTrendData(dateRange),
  getSampleStatusDistribution(dateRange),
  getCoAStatistics(dateRange),
  getStaffProductivity(dateRange),
  getSampleAccessionTrend(dateRange), // NEW
])

// ... error handling ...

return (
  <ReportsLayout
    role="manager"
    user={userData}
    fromDate={fromDate}
    toDate={toDate}
    kpiMetrics={kpiMetrics}
    tatTrendData={tatTrendData}
    statusDistribution={statusDistribution}
    coaStatistics={coaStatistics}
    staffProductivity={staffProductivity}
    accessionTrendData={accessionTrendResult} // NEW
  />
)
```

---

## Implementation Checklist

Tracked via Beads:

- [ ] **lims-lite-rux** - Add `SampleAccessionTrendData` type schema to `src/types/index.ts`
- [ ] **lims-lite-4hm** - Create database RPC function `get_sample_accession_trend` with auto-granularity
- [ ] **lims-lite-vi2** - Create `getSampleAccessionTrend` Server Action in `src/app/actions/reports.ts`
- [ ] **lims-lite-7qd** - Create `SampleAccessionTrendChart` component with bars + line (dual Y-axis)
- [ ] **lims-lite-wft** - Integrate `SampleAccessionTrendChart` into ReportsLayout next to Sample Status Chart
- [ ] **lims-lite-bal** - Update analyst and manager reports pages to fetch accession trend data

---

## Testing Strategy

### Unit Tests
- [ ] Validate `SampleAccessionTrendDataSchema` with Zod
- [ ] Test `getSampleAccessionTrend` Server Action with various date ranges

### Integration Tests
- [ ] Test RPC function with different date ranges (daily/monthly/yearly)
- [ ] Verify auto-granularity logic (31 days, 365 days, > 365 days)
- [ ] Verify cumulative count calculation accuracy
- [ ] Test with empty date ranges (no samples)

### Manual Testing
- [ ] Select date range ≤ 31 days → Verify daily bars shown
- [ ] Select date range ≤ 365 days → Verify monthly bars shown
- [ ] Select date range > 365 days → Verify yearly bars shown
- [ ] Verify cumulative line matches manual calculation
- [ ] Verify tooltip shows correct values
- [ ] Verify responsive layout (mobile, tablet, desktop)
- [ ] Verify loading skeleton displays
- [ ] Verify empty state message

### Performance Testing
- [ ] Run `EXPLAIN ANALYZE` on RPC function with 1000+ samples
- [ ] Verify index is being used (`idx_samples_received_at_not_deleted`)
- [ ] Check query execution time (should be < 100ms for 1000 samples)

### Security Testing
- [ ] Verify RLS policies are enforced (analyst can only see own samples)
- [ ] Test with different user roles (analyst, manager)
- [ ] Run `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`

---

## Vietnamese Localization

All UI text must be in Vietnamese:

- **Chart Title:** "Xu Hướng Tiếp Nhận Mẫu"
- **Subtitle:** "Số lượng mẫu tiếp nhận theo thời gian"
- **Tooltip Labels:**
  - "Kỳ" (Period)
  - "Số mẫu" (Sample count)
  - "Tổng tích lũy" (Cumulative total)
- **Y-axis Labels:**
  - Left: "Số mẫu" (Count)
  - Right: "Tổng tích lũy" (Cumulative)
- **Empty State:** "Chưa có dữ liệu tiếp nhận mẫu"
- **Loading State:** Skeleton with shimmer effect

---

## Success Criteria

- [x] Design document completed and reviewed
- [ ] All 6 Beads tasks completed
- [ ] Chart displays correctly on both analyst and manager reports pages
- [ ] Auto-granularity works correctly for all date ranges
- [ ] Cumulative line accurately reflects running total
- [ ] No N+1 queries (single RPC call per render)
- [ ] No race conditions (read-only, MVCC ensures consistency)
- [ ] All UI text in Vietnamese
- [ ] TypeScript compilation passes (`npm run typecheck`)
- [ ] Security tests pass (`run_security_tests()`)
- [ ] Performance acceptable (< 100ms query time for 1000 samples)

---

## Future Enhancements (Post-MVP)

Not part of this implementation:

- User-selectable granularity toggle (override auto-select)
- Drill-down to daily view from monthly/yearly
- Comparison with previous period (year-over-year)
- Forecasting/trend line projection
- Export chart as image (PNG/SVG)
- Animated transitions when switching date ranges
