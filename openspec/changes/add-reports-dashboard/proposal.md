## Why

CDC-LIMS currently lacks a centralized reporting and analytics dashboard, forcing managers and analysts to manually query individual pages to understand lab performance. Users need real-time visibility into operational KPIs (TAT, throughput, error rates), approval queue metrics, and Certificate of Analysis (CoA) generation statistics to make data-driven decisions and meet compliance reporting requirements (ISO 17025, 21 CFR Part 11).

**Industry Context (from LIMS Best Practices Research):**

Modern LIMS dashboards are essential for operational excellence and regulatory compliance. According to LIMS industry standards:

- **TAT Monitoring**: Most critical operational KPI - tracks time from sample receipt to final result delivery. Industry benchmarks recommend tracking average TAT, on-time delivery rate (typically >90% within 72h SLA), and delay patterns by shift to identify workflow bottlenecks.

- **Quality Metrics**: Error rate tracking from audit logs is a core requirement for ISO 17025 compliance. This includes monitoring sample rejection rates, rework/retest frequencies, Out-of-Specification (OOS) results, and result modification counts.

- **Work-in-Progress (WIP) Management**: Real-time visibility into samples at each workflow stage prevents bottlenecks and enables proactive resource allocation. Essential for capacity planning and throughput optimization.

- **Role-Based Dashboards**: LIMS best practices recommend differentiated views - managers need strategic KPIs (cost per test, staff productivity, compliance metrics) while analysts need tactical operational views (worklists, pending tasks, equipment status).

- **Real-Time Insights**: Dashboard data should refresh frequently (every 5 minutes for operational metrics) to enable immediate action on critical conditions like pending approval queues or overdue samples.

This implementation follows proven LIMS dashboard patterns while adapting to CDC-LIMS's specific workflow and Vietnamese localization requirements.

## What Changes

- Add **Reports & Analytics Dashboard** page at `/manager/reports` and `/analyst/reports`
- Implement **role-based access control**:
  - Managers: Full access to all reports including staff productivity metrics
  - Analysts: Lab-wide operational statistics (transparent performance visibility)
- Create **5 core KPI cards** with trend indicators (aligned with LIMS industry standards):
  - **TAT Trung Bình** (Average Turnaround Time): Tracks time from sample receipt to approval. Displays both average and median values with trend vs previous period. Critical for SLA compliance monitoring.
  - **Mẫu Đang Xử Lý** (Samples in Progress/WIP): Real-time count of samples at each workflow stage (received, assigned, in_progress, review). Includes mini status breakdown to identify bottlenecks.
  - **Chờ Phê Duyệt** (Pending Approvals): Shows approval queue depth with alert badge when >20 samples or average wait time >24h. Essential for preventing release delays.
  - **Tỷ Lệ Hoàn Thành Đúng Hạn** (On-Time Delivery Rate): Percentage of samples completed within 72h SLA. Color-coded: green if ≥90%, yellow if 80-89%, red if <80%.
  - **Tỷ Lệ Lỗi** (Error Rate from audit logs): Calculated as (result modifications / total results) × 100. Tracks quality metrics for ISO 17025 compliance and identifies training needs.
- Add **4 interactive charts** using Recharts library (chart types follow LIMS visualization best practices):
  - **TAT Trend Chart**: Line chart with area fill showing TAT trends over time. Includes 72h SLA reference line (control chart pattern) to identify process variations. Follows Shewhart control chart principles for statistical process monitoring.
  - **Sample Status Distribution**: Horizontal bar chart showing sample counts by workflow stage. Color-coded bars (slate/blue/amber/purple/emerald) sorted by workflow order. Click interaction filters Recent Samples Table below.
  - **CoA Statistics**: Donut chart visualizing the Certificate of Analysis generation pipeline with 3 segments: Generated (emerald), Pending CoA (amber), Not Approved (slate). Center label shows total approved count.
  - **Staff Productivity Comparison**: Manager-only vertical bar chart comparing analyst productivity (tests completed) for current vs previous period. Analysts sorted by current period descending. Promotes accountability while avoiding competitive pressure for analysts.
- Implement **filterable date ranges** (Today, This Week, This Month, Custom Range)
- Add **Excel export functionality** for reports data (MVP), PDF export planned post-launch
- Create **Recent Samples Table** with TAT details and approval status
- All UI text in **Vietnamese** per project localization requirements

**Design Philosophy:**
- Follow existing glassmorphism design system for visual consistency
- **Real-time data refresh** via TanStack Query (5min cache for "Today" metrics, 1h for historical data)
- **Responsive grid layout** (desktop 3-col, tablet 2-col, mobile stack)
- **Chart interactions** filter data tables below (URL param sync for shareable filtered views)
- **Smart alerting**: Color-coded KPIs (red/yellow/green) with alert badges only for critical thresholds - prevents "alarm fatigue" per LIMS best practices
- **Avoid data overload**: Use materialized views/snapshots for complex calculations to maintain <2s page load time
- **Role-based visibility**: Managers see strategic metrics (staff productivity, financial KPIs), analysts see tactical operational views (lab-wide stats, transparent performance)
- **Accessibility**: Proper ARIA labels, keyboard navigation, Vietnamese screen reader support
- **NON-BREAKING**: New feature, no changes to existing functionality

## Impact

- Affected specs: NEW capability `reporting` (analytics dashboard and KPI tracking)
- Affected code:
  - `src/app/(dashboard)/manager/reports/page.tsx` (manager reports page)
  - `src/app/(dashboard)/analyst/reports/page.tsx` (analyst reports page - shared component)
  - `src/app/actions/reports.ts` (Server Actions for KPI calculations and data fetching)
  - `src/components/reports/kpi-cards-grid.tsx` (stat cards with trends)
  - `src/components/reports/tat-trend-chart.tsx` (Recharts line chart)
  - `src/components/reports/sample-status-chart.tsx` (Recharts horizontal bar)
  - `src/components/reports/coa-statistics-chart.tsx` (Recharts donut chart)
  - `src/components/reports/staff-productivity-chart.tsx` (manager-only Recharts bar)
  - `src/components/reports/recent-samples-table.tsx` (TanStack Table)
  - `src/components/reports/date-range-filter.tsx` (filter component)
  - `src/components/reports/export-excel-button.tsx` (Excel export)
  - `src/lib/data/reports.ts` (data fetching utilities)
  - `src/lib/utils-reports.ts` (KPI calculation helpers)
  - `package.json` (add `recharts` and `xlsx` dependencies)
  - `src/components/dashboard-nav.tsx` (add Reports navigation link)
- Database queries:
  - Complex aggregation queries on `samples`, `results`, `audit_logs` tables
  - Date range filtering with RLS compliance
  - Performance: Add indexes on `received_at`, `approved_at`, `created_at` columns if needed
- Vietnamese translations:
  - Update `docs/vietnamese_dictionary.md` with reporting terminology
