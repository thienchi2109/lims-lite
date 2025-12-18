## Context

CDC-LIMS currently lacks centralized reporting and analytics capabilities. Users must navigate individual pages (Samples, Approvals, etc.) to understand lab performance. Industry best practices (ISO 17025, LIMS operational standards) require real-time KPI dashboards for:

- **Turnaround Time (TAT)** monitoring to meet client SLA commitments
- **Sample throughput** tracking to identify workflow bottlenecks
- **Approval queue** visibility to prevent release delays
- **Quality metrics** (error rates, rework) for continuous improvement
- **CoA generation** tracking for compliance reporting

Based on NotebookLM LIMS documentation research, the essential KPIs for operational dashboards are:
1. TAT average, on-time delivery rate, and delay tracking
2. Sample volume and work-in-progress by status
3. Quality metrics (error rates, result changes from audit logs)
4. Approval queue depth and average approval wait time
5. CoA generation statistics and pending CoA count

This design implements a **glassmorphism dashboard** with **Recharts visualizations** and **role-based access** to provide managers and analysts with actionable insights.

## Goals / Non-Goals

### Goals
- Provide real-time operational KPIs aligned with LIMS industry standards
- Support both Manager and Analyst roles with transparent lab-wide statistics
- Enable data-driven decision making through visual trend analysis
- Maintain RLS compliance (reports respect existing row-level security)
- Follow existing UI/UX patterns (glassmorphism, Vietnamese localization)
- Export reports to Excel for external analysis (MVP requirement)
- Performance: Sub-second KPI calculation for datasets up to 100k samples

### Non-Goals
- Financial reporting (cost per test, revenue tracking) - post-MVP
- Predictive analytics or AI-powered insights - future enhancement
- Custom report builder (ad-hoc query interface) - phase 2
- Real-time WebSocket updates (polling/refresh is sufficient for MVP)
- PDF report export - planned post-launch based on user feedback
- Drill-down to individual analyst performance details (privacy concerns)
- Integration with external BI tools (Power BI, Tableau) - future

## Decisions

### Decision: Recharts for Data Visualization

**Why Recharts over alternatives:**

| Aspect | Recharts | Chart.js | Victory | D3.js |
|--------|----------|----------|---------|-------|
| **React integration** | Native React components | Wrapper required | Native React | Low-level API |
| **TypeScript support** | Excellent | Good | Good | Excellent |
| **Bundle size** | ~400KB | ~200KB | ~500KB | ~300KB (core) |
| **Customization** | High (via props) | Medium | High | Unlimited |
| **Learning curve** | Low | Low | Medium | High |
| **Responsive** | Built-in | Manual config | Built-in | Manual |
| **Accessibility** | Good (ARIA) | Fair | Good | Manual |

**Why Recharts wins for LIMS:**
- ✅ Declarative React components match Next.js patterns
- ✅ Responsive by default (critical for mobile access)
- ✅ Excellent TypeScript definitions
- ✅ Tooltip/legend customization for Vietnamese labels
- ✅ Active maintenance (5k+ GitHub stars, recent updates)
- ✅ Proven in production dashboards (Vercel Analytics uses Recharts)

**Trade-offs:**
- Larger bundle (~400KB) but acceptable for dashboard page (code-split)
- Less control than D3 but LIMS doesn't need custom chart types
- Not as performant as Canvas-based libraries but datasets are small (<1000 points per chart)

**Verdict:** Recharts provides the best balance of developer experience, TypeScript support, and visual quality for LIMS reporting needs.

### Decision: Server-Side KPI Calculation

**Implementation strategy:**

All KPI calculations happen **server-side** via Server Actions for:
- **Security**: Prevents client-side data exposure
- **Performance**: Database aggregations are faster than client-side processing
- **RLS compliance**: Supabase RLS policies automatically filter results
- **Caching**: Edge caching for frequently accessed date ranges

**KPI Calculation Patterns:**

```typescript
// src/app/actions/reports.ts

export async function getAverageTAT(dateRange: DateRange): Promise<number> {
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('calculate_average_tat', {
    start_date: dateRange.start,
    end_date: dateRange.end
  })

  if (error) throw error
  return data.avg_tat_hours
}
```

**Database RPC Functions:**

```sql
-- supabase/migrations/0XX_create_reports_functions.sql

CREATE OR REPLACE FUNCTION calculate_average_tat(
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ
)
RETURNS TABLE(
  avg_tat_hours NUMERIC,
  sample_count BIGINT,
  on_time_count BIGINT
) LANGUAGE plpgsql SECURITY INVOKER AS $$
BEGIN
  RETURN QUERY
  SELECT
    AVG(EXTRACT(EPOCH FROM (approved_at - received_at))/3600)::NUMERIC(10,2),
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE (approved_at - received_at) <= INTERVAL '72 hours')::BIGINT
  FROM samples
  WHERE approved_at BETWEEN start_date AND end_date
    AND deleted_at IS NULL
    AND status = 'completed';
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_average_tat TO authenticated;
```

**Why RPC functions:**
- Single database roundtrip (vs multiple queries)
- Complex aggregations offloaded to PostgreSQL
- Automatically respects RLS policies (`SECURITY INVOKER`)
- Can add indexes to optimize specific calculations

### Decision: Role-Based Access Control

**Access Matrix:**

| Feature | Manager | Analyst |
|---------|---------|---------|
| View KPI Cards | ✅ All 5 KPIs | ✅ All 5 KPIs |
| TAT Trend Chart | ✅ | ✅ |
| Sample Status Chart | ✅ | ✅ |
| CoA Statistics Chart | ✅ | ✅ |
| Staff Productivity Chart | ✅ **Manager only** | ❌ Hidden |
| Export to Excel | ✅ | ✅ |
| Filter by Date Range | ✅ | ✅ |

**Why analysts get lab-wide stats:**
- Promotes **transparency** and **team accountability** (LIMS best practice for operational dashboards)
- Aligns with user's choice of "Lab-wide operational stats" during brainstorming
- Analysts see aggregate metrics (not individual breakdowns) - provides context for their work without creating competitive pressure
- Staff productivity comparison is **manager-only** to avoid anxiety and maintain psychological safety
- **LIMS industry standard**: Analysts need tactical operational views (worklists, pending tasks) while managers need strategic oversight (productivity, cost per test, compliance metrics)
- **Security best practice**: Each role has unique login (no shared credentials) - ensures attributable audit trail per ALCOA+ principles
- **Audit trail enforcement**: All dashboard views logged with role + user ID for compliance verification

**Implementation:**

```tsx
// src/app/(dashboard)/manager/reports/page.tsx (Server Component)

export default async function ManagerReportsPage() {
  const user = await getCurrentUser()
  const role = user.role // 'manager' | 'analyst'

  return (
    <ReportsLayout role={role}>
      <KPICardsGrid />
      <ChartsSection>
        <TATTrendChart />
        <SampleStatusChart />
        <CoAStatisticsChart />
        {role === 'manager' && <StaffProductivityChart />}
      </ChartsSection>
    </ReportsLayout>
  )
}
```

### Decision: Date Range Filtering Strategy

**Default behavior:**
- **Today** (00:00 - 23:59 current day) - real-time operational view
- Quick filters: "Today", "This Week", "This Month"
- Custom range picker for historical analysis

**Why not always show "This Month":**
- Managers check **today's performance** first thing each morning
- "Today" provides immediate actionable insights (e.g., approval queue depth)
- Month-to-date view available via quick filter

**Implementation:**

```tsx
// src/components/reports/date-range-filter.tsx

export function DateRangeFilter({ onChange }: Props) {
  const [range, setRange] = useState<DateRange>(getToday())

  const quickFilters = [
    { label: "Hôm nay", value: getToday() },
    { label: "Tuần này", value: getThisWeek() },
    { label: "Tháng này", value: getThisMonth() },
    { label: "Tùy chỉnh", value: null } // Opens date picker
  ]

  return (
    <div className="flex gap-2">
      {quickFilters.map(filter => (
        <Button
          onClick={() => handleFilterChange(filter.value)}
          variant={isActive(filter) ? "default" : "outline"}
        >
          {filter.label}
        </Button>
      ))}
      <DatePickerRange onChange={setRange} />
    </div>
  )
}
```

**Performance optimization:**
- Cache today's KPIs for 5 minutes (TanStack Query `staleTime`)
- Historical queries cached for 1 hour
- Use PostgreSQL date indexes for fast filtering

### Decision: Excel Export Over PDF for MVP

**Why Excel first:**
- Managers need **raw data** for external analysis (pivot tables, custom charts)
- Excel export is simpler (use `xlsx` library, ~100 lines of code)
- PDF requires layout design and Vietnamese font handling (complex)
- User explicitly requested "Excel format for MVP, PDF later"

**Export implementation:**

```typescript
// src/components/reports/export-excel-button.tsx

import * as XLSX from 'xlsx'

async function exportToExcel(dateRange: DateRange) {
  const data = await fetchReportsData(dateRange)

  const workbook = XLSX.utils.book_new()

  // Sheet 1: KPI Summary
  XLSX.utils.book_append_sheet(workbook,
    XLSX.utils.json_to_sheet(data.kpis),
    "Tổng quan KPI"
  )

  // Sheet 2: Sample Details
  XLSX.utils.book_append_sheet(workbook,
    XLSX.utils.json_to_sheet(data.samples),
    "Chi tiết mẫu"
  )

  // Download
  XLSX.writeFile(workbook, `bao-cao-lims-${formatDate(dateRange.start)}.xlsx`)
}
```

**Excel workbook structure:**
1. **Sheet 1 - Tổng quan KPI**: KPI cards data with values and trends
2. **Sheet 2 - Chi tiết mẫu**: Recent samples table with TAT calculations
3. **Sheet 3 - Thống kê CoA**: CoA generation statistics

### Decision: Chart Interaction Patterns

**Sample Status Chart → Filters Recent Samples Table:**

When user clicks a bar in Sample Status Chart (e.g., "In Progress"), the Recent Samples Table below automatically filters to show only samples with that status.

**Implementation:**

```tsx
// State management via URL params (Next.js searchParams)

function SampleStatusChart({ onStatusClick }: Props) {
  const router = useRouter()

  const handleBarClick = (status: SampleStatus) => {
    router.push(`/manager/reports?status=${status}`, { scroll: false })
  }

  return (
    <BarChart onClick={handleBarClick}>
      {/* Chart config */}
    </BarChart>
  )
}

function RecentSamplesTable({ statusFilter }: Props) {
  const filteredData = samples.filter(s =>
    !statusFilter || s.status === statusFilter
  )

  return <TanStackTable data={filteredData} />
}
```

**Why URL params:**
- Shareable filtered views (copy link to share specific status view)
- Browser back/forward works naturally
- Server-side filtering via searchParams in Server Component

### Decision: Data Visualization Best Practices (LIMS Industry Standards)

**Chart Type Selection Rationale:**

Based on LIMS documentation research, the following chart types are industry-proven for dashboard KPIs:

1. **TAT Trend Chart (Line Chart with Control Limits)**
   - **Why**: Trend analysis and control charts (Shewhart rules) are standard for monitoring process variation over time
   - **LIMS best practice**: Display both average and median TAT values to account for outliers
   - **Control chart pattern**: 72h SLA reference line acts as upper control limit (UCL) - data points above this indicate process out of control
   - **Actionable insight**: Identifies delay patterns by shift/day to pinpoint workflow bottlenecks

2. **Sample Status Distribution (Horizontal Bar Chart)**
   - **Why**: Status boards and matrix views are essential for visualizing work-in-progress (WIP) distribution
   - **LIMS best practice**: Bars sorted by workflow order (not by count) to reflect actual sample journey
   - **Bottleneck detection**: Long bars at specific stages (e.g., "Review") indicate workflow congestion
   - **Color coding**: Semantic colors (slate=received, blue=assigned, amber=in_progress, purple=review, emerald=completed) - consistent with existing LIMS UI patterns

3. **CoA Statistics (Donut Chart)**
   - **Why**: Pipeline/funnel views are standard for tracking multi-stage approval processes
   - **LIMS best practice**: Shows CoA generation funnel with clear segment labels and percentages
   - **Business value**: Identifies pending CoA backlog (amber segment) requiring manager attention
   - **Compliance tracking**: Ensures all approved samples have CoA generated (regulatory requirement)

4. **Staff Productivity (Grouped Bar Chart)**
   - **Why**: Comparative bar charts are proven for productivity benchmarking across team members
   - **LIMS best practice**: Current vs previous period comparison shows individual trends and team patterns
   - **Privacy consideration**: Manager-only view prevents analyst anxiety while enabling targeted coaching
   - **Data integrity**: Tracks result modification counts per analyst - identifies training needs

**Dashboard Design Principles (from LIMS Research):**

- **Avoid data overload**: Dashboard overwhelm is a top complaint - limit to 5-7 key metrics per view
- **Smart grouping**: Group related information logically (KPIs at top, charts in middle, detailed table at bottom)
- **Meaningful color coding**: Use colors purposefully (red=alert, yellow=warning, green=healthy) - not decoratively
- **Prevent alarm fatigue**: Only show alert badges for critical thresholds (>20 pending approvals, >24h wait time) - don't over-notify
- **White space**: Keep layout uncluttered with sufficient spacing for readability
- **Progressive disclosure**: Show summary first, allow drill-down to details on click (chart → filtered table pattern)
- **Mobile-first**: Dashboard must be readable on tablets (managers check metrics on rounds)

## Risks / Trade-offs

### Risk: Performance Degradation with Large Datasets

**Scenario:** TAT calculations on 100k+ samples with complex date filtering

**Mitigation:**
- Add database indexes on `received_at`, `approved_at`, `status` columns
- Use PostgreSQL materialized views for pre-aggregated metrics (if needed)
- Implement pagination on Recent Samples Table (show top 50 by default)
- Monitor query performance with `EXPLAIN ANALYZE`

**Rollback:** If performance issues arise, add caching layer with Redis

### Risk: Chart Bundle Size Impact

**Trade-off:** Recharts adds ~400KB to bundle

**Mitigation:**
- Code-split reports page (only loads when navigating to /reports)
- Use Next.js dynamic imports for chart components
- Lazy load charts below the fold

```tsx
// Lazy load staff productivity chart (manager-only, below fold)
const StaffProductivityChart = dynamic(
  () => import('@/components/reports/staff-productivity-chart'),
  { loading: () => <ChartSkeleton /> }
)
```

**Measurement:** Monitor bundle size with `npm run build` and set alert at 500KB increase

### Risk: Vietnamese Font Rendering in Charts

**Issue:** Chart labels may not display Vietnamese diacritics correctly

**Mitigation:**
- Test with production Vietnamese text during development
- Recharts uses SVG text (supports Unicode by default)
- Use system fonts that support Vietnamese (already configured in Tailwind)

**Fallback:** If issues arise, manually set font-family on chart components

## Migration Plan

### Phase 1: Database Setup (Migration 0XX)

1. Create RPC functions for KPI calculations
2. Add indexes on date columns for performance
3. Test functions with sample data
4. Run security tests to verify RLS compliance

### Phase 2: Backend Implementation

1. Create Server Actions in `src/app/actions/reports.ts`
2. Implement data fetching utilities in `src/lib/data/reports.ts`
3. Add KPI calculation helpers in `src/lib/utils-reports.ts`
4. Write unit tests for calculation logic

### Phase 3: Frontend Components

1. Build KPI cards grid with trend indicators
2. Implement date range filter component
3. Create chart components using Recharts
4. Build Recent Samples Table with filtering
5. Add Excel export functionality
6. Test responsive layout on mobile/tablet

### Phase 4: Integration

1. Add Reports navigation link to dashboard nav
2. Create `/manager/reports` and `/analyst/reports` pages
3. Wire up Server Actions to components
4. Test role-based access control
5. Add Vietnamese translations to dictionary

### Phase 5: Testing & Optimization

1. Test with realistic dataset (10k samples)
2. Measure query performance and optimize if needed
3. Test Excel export with various date ranges
4. Cross-browser testing (Chrome, Safari, Firefox)
5. Mobile responsiveness verification

### Rollback Strategy

If critical issues discovered post-deployment:
1. Remove Reports navigation link (hide feature)
2. Reports page still accessible via direct URL for debugging
3. No database migrations to rollback (RPC functions are additive)
4. Fix issues and re-enable navigation link

## Open Questions

1. **SLA Threshold Configuration:** Should TAT SLA (currently hardcoded at 72 hours) be configurable per assay type, or is a global default sufficient for MVP?
   - **Recommendation:** Start with global 72-hour default, add per-assay config post-MVP based on user feedback

2. **Staff Productivity Privacy:** Should staff names be displayed or anonymized as "Analyst A, B, C"?
   - **Current decision:** Display full names (managers need to know who to support)
   - **Alternative:** Add toggle to anonymize in settings

3. **Chart Refresh Rate:** Should charts auto-refresh (polling) or require manual refresh?
   - **Recommendation:** Manual refresh for MVP (add refresh button), auto-refresh post-MVP if requested

4. **Historical Data Retention:** How far back should date range picker allow?
   - **Recommendation:** Allow unlimited historical range, but warn if >1 year selected (performance)

5. **Export File Naming:** Should Excel filename include user name or just date range?
   - **Recommendation:** `bao-cao-lims-YYYY-MM-DD.xlsx` (date-based, no PII in filename)
