## 1. Database Setup

- [ ] 1.1 Create migration `0XX_create_reports_functions.sql` with RPC functions:
  - [ ] `calculate_average_tat(start_date, end_date)` - TAT metrics
  - [ ] `get_samples_by_status(start_date, end_date)` - Status distribution
  - [ ] `get_approval_queue_metrics(start_date, end_date)` - Pending approvals
  - [ ] `get_error_rate_metrics(start_date, end_date)` - From audit logs
  - [ ] `get_coa_statistics(start_date, end_date)` - CoA generation stats
  - [ ] `get_staff_productivity(start_date, end_date)` - Manager-only
- [ ] 1.2 Add database indexes for performance:
  - [ ] `CREATE INDEX idx_samples_received_at ON samples(received_at) WHERE deleted_at IS NULL`
  - [ ] `CREATE INDEX idx_samples_approved_at ON samples(approved_at) WHERE deleted_at IS NULL`
  - [ ] `CREATE INDEX idx_results_created_at ON results(created_at)`
  - [ ] `CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp) WHERE table_name = 'results'`
- [ ] 1.3 Test RPC functions with sample data
- [ ] 1.4 Run security tests: `docker exec lims-postgres psql -U postgres -d postgres -c "SELECT * FROM run_security_tests();"`
- [ ] 1.5 Verify RLS compliance for all RPC functions

## 2. Backend Implementation

- [ ] 2.1 Install dependencies:
  - [ ] Add `recharts` to package.json (chart library)
  - [ ] Add `xlsx` to package.json (Excel export)
  - [ ] Add `date-fns` for date range utilities (if not already installed)
  - [ ] Run `npm install`
- [ ] 2.2 Create Server Actions in `src/app/actions/reports.ts`:
  - [ ] `getKPIMetrics(dateRange)` - Fetches all 5 KPI cards data
  - [ ] `getTATTrendData(dateRange)` - TAT over time for line chart
  - [ ] `getSampleStatusDistribution(dateRange)` - Status counts for bar chart
  - [ ] `getCoAStatistics(dateRange)` - CoA generation pipeline data
  - [ ] `getStaffProductivity(dateRange)` - Manager-only analyst comparison
  - [ ] `getRecentSamples(dateRange, filters)` - Table data with pagination
  - [ ] `exportReportsToExcel(dateRange)` - Generate Excel workbook
- [ ] 2.3 Create data fetching utilities in `src/lib/data/reports.ts`:
  - [ ] `fetchKPIData()` - Wrapper for KPI RPC calls
  - [ ] `fetchChartData()` - Wrapper for chart RPC calls
  - [ ] Type definitions for all return types
- [ ] 2.4 Create helper utilities in `src/lib/utils-reports.ts`:
  - [ ] `calculateTATInHours(received_at, approved_at)` - TAT calculation
  - [ ] `calculateOnTimeRate(samples, sla_hours)` - On-time percentage
  - [ ] `formatTrendIndicator(current, previous)` - Trend up/down
  - [ ] `getDateRangePresets()` - Today, This Week, This Month helpers
- [ ] 2.5 Add TypeScript types in `src/types/index.ts`:
  - [ ] `KPIMetrics` - KPI cards data structure
  - [ ] `TATTrendData` - Line chart data points
  - [ ] `SampleStatusData` - Bar chart data
  - [ ] `CoAStatistics` - Donut chart segments
  - [ ] `StaffProductivityData` - Staff comparison data
  - [ ] `DateRange` - Date range filter type

## 3. UI Components - KPI Cards

- [ ] 3.1 Create `src/components/reports/kpi-cards-grid.tsx`:
  - [ ] Grid layout (3 columns desktop, 2 tablet, 1 mobile)
  - [ ] Glassmorphism card styling matching dashboard design
  - [ ] Server Component fetching KPI data
- [ ] 3.2 Create `src/components/reports/kpi-card.tsx`:
  - [ ] Display metric value with unit (hours, percentage, count)
  - [ ] Trend indicator (up/down arrow with color)
  - [ ] Comparison text (vs previous period)
  - [ ] Icon and gradient color per metric type
  - [ ] Loading skeleton state
- [ ] 3.3 Implement 5 KPI cards:
  - [ ] TAT Trung Bình (Average TAT in hours/days)
  - [ ] Mẫu Đang Xử Lý (WIP count with mini status breakdown)
  - [ ] Chờ Phê Duyệt (Pending approvals with alert badge)
  - [ ] Tỷ Lệ Hoàn Thành Đúng Hạn (On-time rate percentage)
  - [ ] Tỷ Lệ Lỗi (Error rate from audit logs)

## 4. UI Components - Charts

- [ ] 4.1 Create `src/components/reports/tat-trend-chart.tsx`:
  - [ ] Recharts LineChart with area fill
  - [ ] X-axis: Dates (formatted Vietnamese)
  - [ ] Y-axis: TAT in hours
  - [ ] Reference line for SLA threshold (72 hours)
  - [ ] Custom tooltip with sample count
  - [ ] Responsive sizing
  - [ ] Loading state
- [ ] 4.2 Create `src/components/reports/sample-status-chart.tsx`:
  - [ ] Recharts BarChart (horizontal orientation)
  - [ ] Color-coded bars by status
  - [ ] Click handler to filter Recent Samples Table
  - [ ] Vietnamese status labels
  - [ ] Responsive sizing
- [ ] 4.3 Create `src/components/reports/coa-statistics-chart.tsx`:
  - [ ] Recharts PieChart with donut style
  - [ ] 3 segments: Generated, Pending CoA, Not Approved
  - [ ] Center label with total approved count
  - [ ] Custom legend with counts and percentages
  - [ ] Vietnamese labels
- [ ] 4.4 Create `src/components/reports/staff-productivity-chart.tsx`:
  - [ ] Recharts BarChart (vertical, grouped bars)
  - [ ] Current period vs Previous period comparison
  - [ ] Manager-only component (check role)
  - [ ] Anonymization option (display initials or full names)
  - [ ] Sort by current period descending
- [ ] 4.5 Create shared chart utilities:
  - [ ] `src/components/reports/chart-container.tsx` - Wrapper with title and loading
  - [ ] `src/components/reports/chart-skeleton.tsx` - Loading skeleton
  - [ ] Custom Recharts theme matching glassmorphism colors

## 5. UI Components - Filters & Tables

- [ ] 5.1 Create `src/components/reports/date-range-filter.tsx`:
  - [ ] Quick filter buttons: Hôm nay, Tuần này, Tháng này
  - [ ] Custom date range picker (shadcn DatePickerRange)
  - [ ] Active state styling
  - [ ] URL param sync (Next.js searchParams)
  - [ ] Vietnamese date formatting
- [ ] 5.2 Create `src/components/reports/recent-samples-table.tsx`:
  - [ ] TanStack Table with columns:
    - Sample ID, Client, Received Date, Approved Date, TAT, Status
  - [ ] Status filter from URL params (chart click interaction)
  - [ ] Pagination (50 rows per page)
  - [ ] Sort by TAT descending (longest first)
  - [ ] Vietnamese column headers
  - [ ] Mobile responsive (stack columns)
- [ ] 5.3 Create `src/components/reports/export-excel-button.tsx`:
  - [ ] Button with Excel icon
  - [ ] Loading state during export
  - [ ] Download trigger using `xlsx` library
  - [ ] Generate 3 sheets: KPIs, Samples, CoA Stats
  - [ ] Vietnamese sheet names and headers
  - [ ] Filename format: `bao-cao-lims-YYYY-MM-DD.xlsx`

## 6. Page Implementation

- [ ] 6.1 Create `src/app/(dashboard)/manager/reports/page.tsx`:
  - [ ] Server Component with role check
  - [ ] Page header with title "Báo cáo & Phân tích"
  - [ ] Date range filter component
  - [ ] Export Excel button (top right)
  - [ ] KPI cards grid
  - [ ] Charts section with responsive grid:
    - Desktop: [TAT Trend col-span-2] [CoA Stats col-span-1]
    - Desktop: [Sample Status col-span-1] [Staff Productivity col-span-2]
  - [ ] Recent Samples Table
  - [ ] Glassmorphism background decorations
  - [ ] Pass date range to all components via props or context
- [ ] 6.2 Create `src/app/(dashboard)/analyst/reports/page.tsx`:
  - [ ] Reuse manager page layout
  - [ ] Hide Staff Productivity Chart (role check)
  - [ ] Same KPIs and charts (lab-wide transparency)
  - [ ] Analyst-specific welcome message
- [ ] 6.3 Create shared layout component `src/components/reports/reports-layout.tsx`:
  - [ ] Accept role prop
  - [ ] Conditional chart rendering
  - [ ] Shared styling and structure

## 7. Navigation Integration

- [ ] 7.1 Update `src/components/dashboard-nav.tsx`:
  - [ ] Add Reports link for managers: `{ href: '/manager/reports', label: 'Báo cáo', icon: BarChart3 }`
  - [ ] Add Reports link for analysts: `{ href: '/analyst/reports', label: 'Báo cáo', icon: BarChart3 }`
  - [ ] Import `BarChart3` icon from lucide-react
- [ ] 7.2 Update manager dashboard `src/app/(dashboard)/manager/page.tsx`:
  - [ ] Add Reports card to menuItems grid
  - [ ] Icon: BarChart3
  - [ ] Color: `from-orange-500 to-red-600`
  - [ ] Description: "Xem báo cáo và phân tích hiệu suất phòng lab"

## 8. Vietnamese Localization

- [ ] 8.1 Update `docs/vietnamese_dictionary.md` with reporting terms:
  - [ ] Báo cáo & Phân tích - Reports & Analytics
  - [ ] TAT Trung Bình - Average Turnaround Time
  - [ ] Mẫu Đang Xử Lý - Samples in Progress
  - [ ] Chờ Phê Duyệt - Pending Approvals
  - [ ] Tỷ Lệ Hoàn Thành Đúng Hạn - On-Time Delivery Rate
  - [ ] Tỷ Lệ Lỗi - Error Rate
  - [ ] Thống kê CoA - CoA Statistics
  - [ ] Năng suất nhân viên - Staff Productivity
  - [ ] Hôm nay - Today
  - [ ] Tuần này - This Week
  - [ ] Tháng này - This Month
  - [ ] Tùy chỉnh - Custom
  - [ ] Xuất Excel - Export to Excel
- [ ] 8.2 Verify all UI text is in Vietnamese (no English strings)

## 9. Testing

- [ ] 9.1 Unit tests for utility functions:
  - [ ] Test `calculateTATInHours()` with various date inputs
  - [ ] Test `calculateOnTimeRate()` edge cases (0 samples, all late, all on-time)
  - [ ] Test `formatTrendIndicator()` positive/negative/zero trends
- [ ] 9.2 Integration tests for Server Actions:
  - [ ] Test `getKPIMetrics()` with date ranges
  - [ ] Test RLS compliance (analyst can't see manager-only data)
  - [ ] Test error handling for invalid date ranges
- [ ] 9.3 Manual testing checklist:
  - [ ] Login as Manager → Navigate to Reports → Verify all 5 KPIs display
  - [ ] Login as Analyst → Navigate to Reports → Verify Staff Productivity hidden
  - [ ] Test date filters: Today, This Week, This Month, Custom Range
  - [ ] Click Sample Status bar → Verify table filters
  - [ ] Export to Excel → Verify 3 sheets with correct data
  - [ ] Test responsive layout on mobile (Chrome DevTools)
  - [ ] Test charts load correctly with 0 samples (empty state)
  - [ ] Test charts load correctly with 10k+ samples (performance)
- [ ] 9.4 Performance verification:
  - [ ] Run `EXPLAIN ANALYZE` on RPC functions with 100k sample dataset
  - [ ] Measure page load time (target: <2s on 3G)
  - [ ] Check bundle size increase (`npm run build` before/after)

## 10. Documentation

- [ ] 10.1 Update `docs/NOTES.md` with Reports feature completion
- [ ] 10.2 Add screenshots to `docs/screenshots/reports-dashboard.png`
- [ ] 10.3 Document KPI calculation formulas in code comments
- [ ] 10.4 Add JSDoc comments to all Server Actions

## 11. Deployment Verification

- [ ] 11.1 Apply database migration in development Docker
- [ ] 11.2 Run `npm run typecheck` - verify no TypeScript errors
- [ ] 11.3 Run `npm run build` - verify build succeeds
- [ ] 11.4 Test in production-like environment (Railway/VPS)
- [ ] 11.5 Monitor performance in production for first week
- [ ] 11.6 Gather user feedback on KPI relevance and chart clarity

## 12. Post-Launch Enhancements (Not MVP)

- [ ] 12.1 Add PDF export functionality
- [ ] 12.2 Add auto-refresh option (polling every 5 minutes)
- [ ] 12.3 Add drill-down from KPI cards to detailed views
- [ ] 12.4 Add custom report builder (ad-hoc queries)
- [ ] 12.5 Add financial reports (cost per test, revenue tracking)
- [ ] 12.6 Add predictive analytics (TAT forecast, bottleneck prediction)
