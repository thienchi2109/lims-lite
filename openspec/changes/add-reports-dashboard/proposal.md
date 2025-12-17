## Why

CDC-LIMS currently lacks a centralized reporting and analytics dashboard, forcing managers and analysts to manually query individual pages to understand lab performance. Users need real-time visibility into operational KPIs (TAT, throughput, error rates), approval queue metrics, and Certificate of Analysis (CoA) generation statistics to make data-driven decisions and meet compliance reporting requirements (ISO 17025, 21 CFR Part 11).

## What Changes

- Add **Reports & Analytics Dashboard** page at `/manager/reports` and `/analyst/reports`
- Implement **role-based access control**:
  - Managers: Full access to all reports including staff productivity metrics
  - Analysts: Lab-wide operational statistics (transparent performance visibility)
- Create **5 core KPI cards** with trend indicators:
  - TAT Trung Bình (Average Turnaround Time)
  - Mẫu Đang Xử Lý (Samples in Progress)
  - Chờ Phê Duyệt (Pending Approvals)
  - Tỷ Lệ Hoàn Thành Đúng Hạn (On-Time Delivery Rate)
  - Tỷ Lệ Lỗi (Error Rate from audit logs)
- Add **4 interactive charts** using Recharts library:
  - TAT Trend Chart (line chart with SLA threshold)
  - Sample Status Distribution (horizontal bar chart)
  - CoA Statistics (donut chart with generation pipeline)
  - Staff Productivity Comparison (manager-only vertical bar chart)
- Implement **filterable date ranges** (Today, This Week, This Month, Custom Range)
- Add **Excel export functionality** for reports data (MVP), PDF export planned post-launch
- Create **Recent Samples Table** with TAT details and approval status
- All UI text in **Vietnamese** per project localization requirements

**Design Philosophy:**
- Follow existing glassmorphism design system for visual consistency
- Real-time data refresh via TanStack Query
- Responsive grid layout (desktop 3-col, tablet 2-col, mobile stack)
- Chart interactions filter data tables below
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
