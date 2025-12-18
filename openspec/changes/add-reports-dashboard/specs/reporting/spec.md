## ADDED Requirements

### Requirement: Reports Dashboard Access

The system SHALL provide role-based access to a centralized Reports & Analytics dashboard for Managers and Analysts to monitor operational KPIs and lab performance metrics.

#### Scenario: Manager accesses Reports dashboard
- **GIVEN** user is authenticated as Manager role
- **WHEN** user navigates to `/manager/reports`
- **THEN** system displays dashboard with all KPI cards, all charts including Staff Productivity, and export functionality

#### Scenario: Analyst accesses Reports dashboard
- **GIVEN** user is authenticated as Analyst role
- **WHEN** user navigates to `/analyst/reports`
- **THEN** system displays dashboard with all KPI cards and charts EXCEPT Staff Productivity chart (hidden)

#### Scenario: Unauthenticated access denied
- **GIVEN** user is not authenticated
- **WHEN** user attempts to access `/manager/reports` or `/analyst/reports`
- **THEN** system redirects to login page

### Requirement: Real-Time KPI Cards Display

The system SHALL display 5 core operational KPI cards with current values, trend indicators, and comparison to previous period.

#### Scenario: Display Average Turnaround Time (TAT)
- **GIVEN** user is viewing Reports dashboard with date range selected
- **WHEN** KPI cards render
- **THEN** system displays "TAT Trung Bình" card showing:
  - Average TAT in hours or days (e.g., "2.3 ngày")
  - **Calculation**: `AVG(EXTRACT(EPOCH FROM (approved_at - received_at))/3600)` for samples WHERE status = 'completed' AND approved_at BETWEEN start_date AND end_date
  - **LIMS best practice**: Display both average (mean) and median TAT to account for outliers
  - Trend indicator (↑ or ↓) compared to previous period (same date range length shifted back)
  - Percentage change (e.g., "+12% vs tuần trước")
  - **Alert threshold**: Show warning badge if average TAT >60 hours (approaching 72h SLA limit)

#### Scenario: Display Samples in Progress (WIP)
- **GIVEN** user is viewing Reports dashboard
- **WHEN** KPI cards render
- **THEN** system displays "Mẫu Đang Xử Lý" card showing:
  - Total WIP count (samples with status IN 'received', 'assigned', 'in_progress', 'review')
  - Mini breakdown by status (visual bar or list)
  - Color-coded status indicators

#### Scenario: Display Pending Approvals with Alert
- **GIVEN** user is viewing Reports dashboard
- **WHEN** pending approvals count exceeds threshold (>20 samples OR average wait time >24 hours)
- **THEN** system displays "Chờ Phê Duyệt" card with red alert badge and warning indicator

#### Scenario: Display On-Time Delivery Rate
- **GIVEN** user is viewing Reports dashboard
- **WHEN** KPI cards render
- **THEN** system displays "Tỷ Lệ Hoàn Thành Đúng Hạn" card showing:
  - Percentage of samples completed within SLA (default 72 hours)
  - **Calculation**: `(COUNT(*) FILTER (WHERE (approved_at - received_at) <= INTERVAL '72 hours') / COUNT(*)) * 100` for completed samples in date range
  - **LIMS industry benchmark**: Target ≥90% for operational excellence, ≥95% for best-in-class labs
  - Color coding: green if ≥90%, yellow if 80-89%, red if <80%
  - Trend compared to previous period
  - **Actionable insight**: Red status triggers investigation of workflow bottlenecks

#### Scenario: Display Error Rate from Audit Logs
- **GIVEN** user is viewing Reports dashboard
- **WHEN** KPI cards render
- **THEN** system displays "Tỷ Lệ Lỗi" card showing:
  - Error rate percentage calculated as (result modifications / total results entered) × 100
  - **Calculation**: `(COUNT(*) FROM audit_logs WHERE table_name = 'results' AND action = 'UPDATE' AND timestamp BETWEEN start_date AND end_date) / (SELECT COUNT(*) FROM results WHERE created_at BETWEEN start_date AND end_date) * 100`
  - **LIMS quality metric**: Tracks rework/retest rate per ISO 17025 continuous improvement requirements
  - Data sourced from audit_logs table WHERE table_name = 'results' AND action = 'UPDATE'
  - Excludes legitimate result approvals (only counts corrections/modifications)
  - Trend indicator
  - **Compliance value**: High error rate (>5%) indicates training needs or process issues requiring corrective action

### Requirement: TAT Trend Chart Visualization

The system SHALL display a line chart showing Average Turnaround Time trends over the selected date range with SLA threshold reference line.

#### Scenario: Display TAT trend for last 7 days
- **GIVEN** user selects "Tuần này" date filter
- **WHEN** chart renders
- **THEN** system displays line chart with:
  - X-axis: 7 dates (formatted as Vietnamese short dates)
  - Y-axis: Average TAT in hours
  - Blue line with area fill showing daily TAT values
  - Red dotted reference line at 72 hours (SLA threshold)
  - Tooltip on hover showing: Date, TAT value, Sample count for that day

#### Scenario: TAT chart with no data
- **GIVEN** user selects date range with zero approved samples
- **WHEN** chart attempts to render
- **THEN** system displays empty state message "Không có dữ liệu trong khoảng thời gian này"

### Requirement: Sample Status Distribution Chart

The system SHALL display a horizontal bar chart showing sample count distribution by workflow status with click-to-filter interaction.

#### Scenario: Display sample status breakdown
- **GIVEN** user is viewing Reports dashboard
- **WHEN** chart renders
- **THEN** system displays horizontal bar chart with:
  - Y-axis: Status names (Received, Assigned, In Progress, Review, Completed)
  - X-axis: Sample count
  - Color-coded bars: Received (slate), Assigned (blue), In Progress (amber), Review (purple), Completed (emerald)
  - Bars sorted by workflow order (not by count)

#### Scenario: Click bar to filter Recent Samples Table
- **GIVEN** user is viewing Sample Status chart
- **WHEN** user clicks on "In Progress" bar
- **THEN** system updates URL with `?status=in_progress` parameter
- **AND** Recent Samples Table below automatically filters to show only "In Progress" samples
- **AND** clicked bar is visually highlighted

### Requirement: CoA Statistics Donut Chart

The system SHALL display a donut chart visualizing the Certificate of Analysis (CoA) generation pipeline with three segments: Generated, Pending CoA, and Not Approved.

#### Scenario: Display CoA generation pipeline
- **GIVEN** user is viewing Reports dashboard
- **WHEN** chart renders
- **THEN** system displays donut chart with:
  - Segment 1 (emerald): "Đã tạo CoA" - samples with coa_generated_at IS NOT NULL
  - Segment 2 (amber): "Chờ tạo CoA" - samples with status = 'completed' AND coa_generated_at IS NULL
  - Segment 3 (slate): "Chưa phê duyệt" - samples with status != 'completed'
  - Center label showing total approved sample count
  - Legend showing count and percentage for each segment

#### Scenario: CoA chart with all samples pending
- **GIVEN** all samples in date range have status != 'completed'
- **WHEN** chart renders
- **THEN** system displays donut chart with 100% "Chưa phê duyệt" segment (slate color)

### Requirement: Staff Productivity Chart (Manager-Only)

The system SHALL display a vertical bar chart comparing analyst productivity (tests completed) for current vs previous period, accessible only to Manager role.

#### Scenario: Manager views staff productivity
- **GIVEN** user is authenticated as Manager
- **WHEN** Reports dashboard renders
- **THEN** system displays Staff Productivity chart showing:
  - X-axis: Analyst names (full names or anonymized as "Analyst A, B, C")
  - Y-axis: Tests completed count
  - Grouped bars: Current period (blue) vs Previous period (gray)
  - Analysts sorted by current period count descending
  - Only analysts who completed at least 1 test in either period are shown

#### Scenario: Analyst cannot see staff productivity
- **GIVEN** user is authenticated as Analyst
- **WHEN** Reports dashboard renders
- **THEN** Staff Productivity chart component is not rendered (completely hidden)

#### Scenario: Staff productivity with zero data
- **GIVEN** no analysts completed any tests in selected date range
- **WHEN** chart attempts to render
- **THEN** system displays empty state "Không có dữ liệu năng suất trong khoảng thời gian này"

### Requirement: Date Range Filtering

The system SHALL provide date range filtering with preset quick filters (Today, This Week, This Month) and custom date picker, updating all KPIs and charts dynamically.

#### Scenario: Apply "Today" quick filter (default)
- **GIVEN** user navigates to Reports dashboard
- **WHEN** page loads
- **THEN** system defaults to "Hôm nay" filter (00:00 to 23:59 current day)
- **AND** all KPIs and charts display data for today only
- **AND** "Hôm nay" button is highlighted as active

#### Scenario: Apply "This Week" quick filter
- **GIVEN** user is viewing Reports dashboard
- **WHEN** user clicks "Tuần này" button
- **THEN** system updates date range to current week (Monday 00:00 to Sunday 23:59)
- **AND** all KPIs and charts re-fetch and display data for this week
- **AND** URL updates with `?range=this-week` parameter

#### Scenario: Apply custom date range
- **GIVEN** user clicks "Tùy chỉnh" button
- **WHEN** user selects start date and end date in date picker
- **AND** user clicks apply
- **THEN** system updates all KPIs and charts with selected date range
- **AND** URL updates with `?start=YYYY-MM-DD&end=YYYY-MM-DD` parameters

#### Scenario: Invalid date range (end before start)
- **GIVEN** user opens custom date picker
- **WHEN** user selects end date that is before start date
- **THEN** system displays validation error "Ngày kết thúc phải sau ngày bắt đầu"
- **AND** prevents applying the invalid range

### Requirement: Recent Samples Data Table

The system SHALL display a paginated table showing recent samples with TAT details, sortable columns, and status filtering from chart interactions.

#### Scenario: Display recent samples for selected date range
- **GIVEN** user is viewing Reports dashboard with date range selected
- **WHEN** Recent Samples Table renders
- **THEN** system displays table with columns:
  - Sample ID (clickable link to sample detail)
  - Client name
  - Received date (Vietnamese format)
  - Approved date (Vietnamese format)
  - TAT (calculated in hours or days)
  - Status (color-coded badge)
- **AND** table shows maximum 50 rows per page
- **AND** rows are sorted by TAT descending (longest TAT first) by default

#### Scenario: Filter table by status from chart click
- **GIVEN** URL contains `?status=in_progress` parameter (from chart click)
- **WHEN** table renders
- **THEN** system displays only samples WHERE status = 'in_progress'
- **AND** displays filter badge showing "Lọc: In Progress" with clear button

#### Scenario: Paginate table results
- **GIVEN** selected date range has >50 samples
- **WHEN** table renders
- **THEN** system displays first 50 rows
- **AND** displays pagination controls at bottom
- **AND** shows total count "Hiển thị 1-50 của 237 mẫu"

### Requirement: Excel Export Functionality

The system SHALL provide Excel export functionality to download reports data as a multi-sheet workbook with Vietnamese labels and proper formatting.

#### Scenario: Manager exports reports to Excel
- **GIVEN** user is authenticated as Manager
- **WHEN** user clicks "Xuất Excel" button on Reports dashboard
- **THEN** system generates Excel workbook with 3 sheets:
  - Sheet 1 "Tổng quan KPI": KPI cards data (metric name, value, trend)
  - Sheet 2 "Chi tiết mẫu": Recent samples table data (all columns)
  - Sheet 3 "Thống kê CoA": CoA statistics (segment name, count, percentage)
- **AND** file downloads with name format `bao-cao-lims-YYYY-MM-DD.xlsx` where date is range start date
- **AND** all sheet names and column headers are in Vietnamese

#### Scenario: Analyst exports reports to Excel
- **GIVEN** user is authenticated as Analyst
- **WHEN** user clicks "Xuất Excel" button
- **THEN** system generates same Excel workbook as Manager (no staff productivity data needed in sheets)

#### Scenario: Export with large dataset
- **GIVEN** selected date range contains >10,000 samples
- **WHEN** user clicks "Xuất Excel" button
- **THEN** system displays loading indicator "Đang tạo file Excel..."
- **AND** export completes within 10 seconds
- **AND** file downloads successfully

#### Scenario: Export fails due to server error
- **GIVEN** database is unavailable during export
- **WHEN** user clicks "Xuất Excel" button
- **THEN** system displays error toast "Không thể xuất báo cáo. Vui lòng thử lại."
- **AND** no file is downloaded

### Requirement: RLS Compliance for Reports Data

The system SHALL enforce row-level security (RLS) policies when fetching reports data, ensuring analysts and managers see only data permitted by their role.

#### Scenario: Reports respect RLS policies
- **GIVEN** RLS policies restrict analysts from viewing deleted samples
- **WHEN** analyst views Reports dashboard
- **THEN** all KPIs, charts, and tables exclude rows WHERE deleted_at IS NOT NULL
- **AND** data is filtered server-side via PostgreSQL RLS

#### Scenario: Manager-only RPC functions enforce role check
- **GIVEN** `get_staff_productivity()` RPC function is marked manager-only
- **WHEN** analyst attempts to call this function (e.g., via API tampering)
- **THEN** system returns authorization error "Permission denied: manager role required"
- **AND** no productivity data is returned

### Requirement: Responsive Layout and Mobile Support

The system SHALL provide responsive layout for Reports dashboard that adapts to mobile, tablet, and desktop screen sizes with appropriate chart and table rendering.

#### Scenario: Desktop layout (≥1024px)
- **GIVEN** user views Reports dashboard on desktop browser
- **WHEN** page renders
- **THEN** system displays:
  - KPI cards in 3-column grid
  - Charts in 2-row grid: [TAT Trend: col-span-2, CoA Stats: col-span-1], [Sample Status: col-span-1, Staff Productivity: col-span-2]
  - Recent Samples Table with all columns visible

#### Scenario: Tablet layout (768px - 1023px)
- **GIVEN** user views Reports dashboard on tablet
- **WHEN** page renders
- **THEN** system displays:
  - KPI cards in 2-column grid
  - Charts stack with: TAT Trend (full-width), Sample Status + CoA Stats (2 columns), Staff Productivity (full-width)
  - Recent Samples Table scrolls horizontally

#### Scenario: Mobile layout (<768px)
- **GIVEN** user views Reports dashboard on mobile device
- **WHEN** page renders
- **THEN** system displays:
  - KPI cards in 1-column stack
  - All charts stack vertically (full-width)
  - Recent Samples Table with condensed columns (hide non-essential fields)
  - Export button in mobile-friendly position

### Requirement: Performance and Caching

The system SHALL ensure Reports dashboard loads within 2 seconds on standard connection (3G) and caches frequently accessed metrics to reduce database load.

#### Scenario: Fast page load with caching
- **GIVEN** user previously loaded "Today" reports within last 5 minutes
- **WHEN** user navigates to Reports dashboard again
- **THEN** system serves cached KPI data (TanStack Query cache)
- **AND** page loads in <1 second
- **AND** displays stale data with background refresh

#### Scenario: Database query optimization
- **GIVEN** selected date range contains 100,000 samples
- **WHEN** user applies date filter
- **THEN** all RPC function calls complete within 500ms (using database indexes)
- **AND** total page load time remains <2 seconds
- **AND** system uses the following optimization strategies:
  - **Indexed columns**: `received_at`, `approved_at`, `created_at`, `status` with composite indexes for common query patterns
  - **LIMS best practice**: Use materialized views or snapshots for complex aggregations (refreshed every 5 minutes) to avoid real-time calculation overhead
  - **Query pattern**: Single RPC call per KPI (not multiple queries) to minimize database roundtrips
  - **SECURITY INVOKER**: All RPC functions enforce RLS policies automatically - no client-side filtering needed

#### Scenario: Chart rendering performance
- **GIVEN** TAT Trend chart displays 30 data points (last 30 days)
- **WHEN** chart component renders
- **THEN** Recharts completes rendering within 200ms
- **AND** chart interactions (hover tooltips) are smooth (60fps)
- **AND** system uses lazy loading for below-fold charts (Staff Productivity) to prioritize above-fold KPIs
