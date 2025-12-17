# Reports & Analytics Dashboard Design
**Date:** 2025-12-17
**Status:** Proposal Complete - Awaiting Approval
**OpenSpec Change:** `add-reports-dashboard`

## Executive Summary

This design document captures the complete brainstorming session for building a Reports & Analytics Dashboard for CDC-LIMS. The dashboard provides real-time operational KPIs, interactive charts, and data export functionality for both Managers and Analysts, aligned with industry best practices from LIMS documentation research.

## Design Decisions from Brainstorming

### 1. Primary Users
**Decision:** Both Manager and Analyst (lab-wide operational transparency)
- Managers: Full access including staff productivity metrics
- Analysts: Same operational KPIs but no individual performance comparisons

### 2. Analyst View
**Decision:** Lab-wide operational stats (not personal metrics only)
- Promotes transparency and team accountability
- Analysts see aggregate metrics without individual breakdowns
- Staff productivity comparison hidden to avoid competitive pressure

### 3. MVP Priority
**Decision:** Dashboard + CoA statistics (not full reporting suite immediately)
- Live dashboard with real-time metrics (quick wins)
- CoA generation tracking (critical compliance output)
- Defer complex analytical reports to phase 2

### 4. Visualization Style
**Decision:** Charts and graphs (using Recharts library)
- More visual than stat cards alone
- Industry-standard approach for dashboards
- Supports trend analysis and pattern recognition

### 5. Time Range Filtering
**Decision:** Filterable date ranges (Today, This Week, This Month, Custom)
- Default to "Today" for immediate operational view
- Quick filters for common timeframes
- Custom range for historical analysis

### 6. Export Functionality
**Decision:** Excel format for MVP, PDF later
- Managers need raw data for external analysis
- Excel export simpler than PDF generation
- PDF planned post-launch based on feedback

## Core KPIs (from NotebookLM Research)

### 1. TAT Trung Bình (Average Turnaround Time)
- Formula: `SUM(approved_at - received_at) / COUNT(samples)`
- Display: Days/hours with trend indicator
- Target: <72 hours (3 days SLA)

### 2. Mẫu Đang Xử Lý (Samples in Progress)
- Formula: `COUNT(*) WHERE status IN ('received', 'assigned', 'in_progress', 'review')`
- Display: Total count with mini status breakdown

### 3. Chờ Phê Duyệt (Pending Approvals)
- Formula: `COUNT(*) WHERE status = 'review'`
- Display: Count with alert badge if >20 samples or wait time >24h

### 4. Tỷ Lệ Hoàn Thành Đúng Hạn (On-Time Delivery Rate)
- Formula: `(COUNT completed within SLA / TOTAL completed) × 100`
- Display: Percentage with color coding (green >90%, yellow 80-90%, red <80%)

### 5. Tỷ Lệ Lỗi (Error Rate)
- Formula: `(COUNT result changes / TOTAL results) × 100`
- Source: `audit_logs` WHERE `table_name = 'results'` AND `action = 'UPDATE'`
- Display: Percentage with trend

## Chart Specifications

### 1. TAT Trend Chart (Line Chart)
- **Type:** Recharts LineChart with area fill
- **Data:** Daily average TAT for last 7/30 days
- **Features:** SLA threshold line (72h), tooltip with sample count
- **Purpose:** Identify TAT trends and bottlenecks

### 2. Sample Status Distribution (Horizontal Bar Chart)
- **Type:** Recharts BarChart (horizontal)
- **Data:** Sample count by status (Received, Assigned, In Progress, Review, Completed)
- **Features:** Color-coded bars, click-to-filter Recent Samples Table
- **Purpose:** Visualize workflow bottlenecks

### 3. CoA Statistics (Donut Chart)
- **Type:** Recharts PieChart with donut style
- **Data:** 3 segments - Generated, Pending CoA, Not Approved
- **Features:** Center metric (total approved), legend with percentages
- **Purpose:** Track CoA generation pipeline health

### 4. Staff Productivity (Bar Chart - Manager Only)
- **Type:** Recharts BarChart (vertical, grouped)
- **Data:** Tests completed per analyst (current vs previous period)
- **Features:** Sort by current period, anonymization option
- **Purpose:** Fair performance comparison for management

## Architecture

### Component Hierarchy
```
/manager/reports/page.tsx (Server Component)
├── ReportsHeader (date filter, export button)
├── KPICardsGrid
│   ├── KPICard (TAT)
│   ├── KPICard (WIP)
│   ├── KPICard (Pending Approvals)
│   ├── KPICard (On-Time Rate)
│   └── KPICard (Error Rate)
├── ChartsSection
│   ├── TATTrendChart (Recharts)
│   ├── SampleStatusChart (Recharts)
│   ├── CoAStatisticsChart (Recharts)
│   └── StaffProductivityChart (Manager-only, Recharts)
└── RecentSamplesTable (TanStack Table)
```

### Data Flow
1. **Server Actions** (`src/app/actions/reports.ts`) call PostgreSQL RPC functions
2. **RPC Functions** perform aggregations with RLS compliance
3. **Server Components** fetch data server-side, pass to client components
4. **TanStack Query** handles client-side caching and refreshing
5. **URL Params** sync date range and filters across components

### Database Layer
- **RPC Functions** for KPI calculations (server-side aggregation)
- **Indexes** on `received_at`, `approved_at`, `status` for performance
- **RLS Policies** automatically filter results by role
- **Security:** All functions use `SECURITY INVOKER` to respect RLS

## Technical Decisions

### Why Recharts?
- Native React components (declarative, matches Next.js)
- Excellent TypeScript support
- Responsive by default (critical for mobile)
- Active maintenance and proven in production
- ~400KB bundle size (acceptable for dashboard page with code-splitting)

### Why Server-Side KPI Calculation?
- **Security:** Prevents client-side data exposure
- **Performance:** Database aggregations faster than client processing
- **RLS Compliance:** Supabase RLS policies automatically apply
- **Caching:** Edge caching for frequently accessed ranges

### Why Excel Export First?
- Managers need raw data for pivot tables and custom analysis
- Simpler implementation (~100 lines vs complex PDF layout)
- Vietnamese font handling easier in Excel
- PDF can be added post-MVP based on user demand

## Responsive Design

### Desktop (≥1024px)
- KPI Cards: 3-column grid
- Charts: 2-row grid (TAT + CoA top row, Status + Productivity bottom row)
- Table: All columns visible

### Tablet (768px - 1023px)
- KPI Cards: 2-column grid
- Charts: Mixed layout (TAT full-width, Status + CoA 2-col, Productivity full-width)
- Table: Horizontal scroll

### Mobile (<768px)
- KPI Cards: 1-column stack
- Charts: All full-width, vertical stack
- Table: Condensed columns (hide non-essential)

## Performance Targets

- **Page Load:** <2 seconds on 3G connection
- **RPC Functions:** <500ms for 100k sample dataset
- **Chart Render:** <200ms for 30 data points
- **Caching:** 5 minutes for "Today" data, 1 hour for historical

## Vietnamese Localization

All UI text in Vietnamese per project requirements:
- Báo cáo & Phân tích (Reports & Analytics)
- TAT Trung Bình (Average Turnaround Time)
- Mẫu Đang Xử Lý (Samples in Progress)
- Chờ Phê Duyệt (Pending Approvals)
- Tỷ Lệ Hoàn Thành Đúng Hạn (On-Time Delivery Rate)
- Tỷ Lệ Lỗi (Error Rate)
- Hôm nay / Tuần này / Tháng này (Today / This Week / This Month)
- Xuất Excel (Export to Excel)

## Compliance & Security

### 21 CFR Part 11 Alignment
- Audit trail for all data changes (error rate from audit_logs)
- RLS policies enforce role-based access
- No data modification in reports (read-only operations)

### ISO 17025 Alignment
- TAT monitoring for quality management
- Error rate tracking for continuous improvement
- Staff productivity for competency assessment (manager-only)

### Privacy
- Staff productivity visible only to managers
- Analyst names can be anonymized if privacy concerns arise
- No PII in export filenames

## Future Enhancements (Post-MVP)

1. **PDF Export:** Professional formatted reports
2. **Auto-Refresh:** Polling every 5 minutes for real-time updates
3. **Drill-Down:** Click KPI card to see detailed breakdown
4. **Custom Report Builder:** Ad-hoc query interface for advanced users
5. **Financial Reports:** Cost per test, revenue tracking
6. **Predictive Analytics:** TAT forecasting, bottleneck prediction
7. **Power BI Integration:** Export to external BI tools

## Open Questions (Resolved)

1. ✅ **SLA Configuration:** Start with global 72-hour default, add per-assay config post-MVP
2. ✅ **Staff Names:** Display full names (managers need context for support)
3. ✅ **Auto-Refresh:** Manual refresh for MVP (add refresh button)
4. ✅ **Historical Range:** Allow unlimited but warn if >1 year (performance)
5. ✅ **Export Filename:** Date-based format `bao-cao-lims-YYYY-MM-DD.xlsx`

## Implementation Plan

See OpenSpec change proposal `add-reports-dashboard` for:
- **proposal.md:** Why, what, impact summary
- **design.md:** Technical decisions and architecture (this document's source)
- **tasks.md:** 12-phase implementation checklist (125+ tasks)
- **specs/reporting/spec.md:** Formal requirements with scenarios

## Next Steps

1. **Request Approval:** Review proposal with stakeholders
2. **Begin Implementation:** Follow `tasks.md` checklist sequentially
3. **Create Git Branch:** `feature/add-reports-dashboard`
4. **Milestone 1:** Database setup + RPC functions
5. **Milestone 2:** Backend Server Actions
6. **Milestone 3:** Frontend components (KPIs, charts, tables)
7. **Milestone 4:** Integration and testing
8. **Milestone 5:** Deployment and user feedback collection

---

**References:**
- NotebookLM LIMS Notebook: KPI metrics, dashboard best practices, compliance requirements
- Codex Review: PostgreSQL full-text search proposal (learned OpenSpec workflow)
- OpenSpec: `openspec/changes/add-reports-dashboard/`
