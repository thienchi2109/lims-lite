import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { ExportExcelButton } from '@/components/reports/export-excel-button'
import { KPICardsGrid } from '@/components/kpi-cards-grid'
import { KPICard } from '@/components/kpi-card'
import { TATTrendChart } from '@/components/tat-trend-chart'
import { SampleStatusChart } from '@/components/sample-status-chart'
import { SampleAccessionTrendChart } from '@/components/sample-accession-trend-chart'
import { CoAStatisticsChart } from '@/components/coa-statistics-chart'
import { StaffProductivityChart } from '@/components/staff-productivity-chart'
import { DashboardHeader } from '@/components/dashboard-header'
import type { SampleStatus, TATTrendData, SampleAccessionTrendData, SampleStatusData, CoAStatistics, StaffProductivityData, KPIMetrics, UserRole } from '@/types'
import { Activity, ClipboardCheck, AlertCircle, TrendingUp, AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

// Vietnamese status translations
const statusTranslations: Record<SampleStatus, string> = {
  received: 'Đã nhận',
  assigned: 'Đã giao',
  in_progress: 'Đang thực hiện',
  review: 'Đang duyệt',
  discarded: 'Hủy bỏ',
  completed: 'Hoàn thành',
}

interface ReportsLayoutProps {
  role: 'manager' | 'analyst'
  user?: {
    full_name: string | null
    role: UserRole | null
  } | null
  fromDate: string
  toDate: string
  kpiMetrics: KPIMetrics
  tatTrendData: TATTrendData[]
  statusDistribution: SampleStatusData[]
  accessionTrendData: SampleAccessionTrendData[]
  coaStatistics: CoAStatistics[]
  staffProductivity?: StaffProductivityData[]
}

export function ReportsLayout({
  role,
  user,
  fromDate,
  toDate,
  kpiMetrics,
  tatTrendData,
  statusDistribution,
  accessionTrendData,
  coaStatistics,
  staffProductivity,
}: ReportsLayoutProps) {
  // Role-specific subtitle
  const subtitle = role === 'manager'
    ? 'Bảng điều khiển Quản lý'
    : 'Bảng điều khiển Kiểm nghiệm viên'

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 relative overflow-hidden font-sans">
      {/* Background Decorations */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-sky-50/80 to-transparent dark:from-sky-950/20 pointer-events-none" />
      <div className="absolute top-[-100px] right-[-100px] w-[500px] h-[500px] bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-[200px] left-[-100px] w-[300px] h-[300px] bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-3xl pointer-events-none" />

      <DashboardHeader
        subtitle={subtitle}
        user={user}
        className="relative z-10"
      />

      <div className="max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8 relative z-10">
        {/* Back Button */}
        <Link
          href={role === 'manager' ? '/manager' : '/analyst'}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Quay lại bảng điều khiển</span>
        </Link>

        {/* Header with title and export button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Báo cáo & Phân tích
            </h1>
          </div>
          <div aria-label="Xuất báo cáo Excel">
            <ExportExcelButton
              kpiData={[
                { metric: 'TAT Trung Bình', value: kpiMetrics.avgTAT.value, unit: 'giờ' },
                { metric: 'Mẫu Đang Xử Lý', value: kpiMetrics.wipCount.value },
                { metric: 'Chờ Phê Duyệt', value: kpiMetrics.pendingApprovals.count },
                { metric: 'Tỷ Lệ Hoàn Thành Đúng Hạn', value: kpiMetrics.onTimeRate.value, unit: '%' },
                { metric: 'Tỷ Lệ Lỗi', value: kpiMetrics.errorRate.value, unit: '%' },
              ]}
              samplesData={[]}
              coaData={coaStatistics}
              dateRange={{ fromDate, toDate }}
            />
          </div>
        </div>

        {/* Date Range Filter */}
        <DateRangeFilter fromDate={fromDate} toDate={toDate} />

        {/* KPI Cards Grid */}
        <KPICardsGrid>
          <KPICard
            title="TAT Trung Bình"
            value={kpiMetrics.avgTAT.value}
            unit="giờ"
            trend={{
              value: kpiMetrics.avgTAT.trend,
              direction: kpiMetrics.avgTAT.trend > 0 ? 'up' : kpiMetrics.avgTAT.trend < 0 ? 'down' : 'stable',
              label: 'vs kỳ trước',
            }}
            trendType="inverse"
            icon={<Activity className="h-5 w-5" />}
            gradient="blue"
          />
          <KPICard
            title="Mẫu Đang Xử Lý"
            value={kpiMetrics.wipCount.value}
            extra={
              <div className="text-xs text-muted-foreground mt-1" aria-label="Chi tiết trạng thái mẫu">
                {kpiMetrics.wipCount.breakdown.slice(0, 3).map((item) => (
                  <div key={item.status}>
                    {statusTranslations[item.status as SampleStatus] || item.status}: {item.count}
                  </div>
                ))}
              </div>
            }
            icon={<ClipboardCheck className="h-5 w-5" />}
            gradient="orange"
          />
          <KPICard
            title="Chờ Phê Duyệt"
            value={kpiMetrics.pendingApprovals.count}
            alert={
              kpiMetrics.pendingApprovals.isAlert
                ? {
                    show: true,
                    message: `${kpiMetrics.pendingApprovals.overdueCount} mẫu quá hạn`,
                  }
                : undefined
            }
            icon={<AlertCircle className="h-5 w-5" />}
            gradient="green"
          />
          <KPICard
            title="Tỷ Lệ Hoàn Thành Đúng Hạn"
            value={kpiMetrics.onTimeRate.value}
            unit="%"
            trend={{
              value: kpiMetrics.onTimeRate.trend,
              direction: kpiMetrics.onTimeRate.trend > 0 ? 'up' : kpiMetrics.onTimeRate.trend < 0 ? 'down' : 'stable',
              label: 'vs kỳ trước',
            }}
            icon={<TrendingUp className="h-5 w-5" />}
            gradient="purple"
          />
          <KPICard
            title="Tỷ Lệ Lỗi"
            value={kpiMetrics.errorRate.value}
            unit="%"
            trend={{
              value: kpiMetrics.errorRate.trend,
              direction: kpiMetrics.errorRate.trend > 0 ? 'up' : kpiMetrics.errorRate.trend < 0 ? 'down' : 'stable',
              label: 'vs kỳ trước',
            }}
            trendType="inverse"
            icon={<AlertTriangle className="h-5 w-5" />}
            gradient="red"
          />
        </KPICardsGrid>

        {/* Charts Section - Responsive Grid */}
        <div className="grid gap-6 lg:grid-cols-3" role="region" aria-label="Biểu đồ phân tích">
          {/* Row 1: TAT Trend (2 cols) + CoA Stats (1 col) */}
          <div className="lg:col-span-2" aria-label="Biểu đồ xu hướng TAT">
            <TATTrendChart data={tatTrendData} />
          </div>
          <div className="lg:col-span-1" aria-label="Thống kê Giấy chứng nhận">
            <CoAStatisticsChart data={coaStatistics} />
          </div>

          {/* Row 2: Sample Status (1 col) + Accession Trend (2 cols) */}
          <div className="lg:col-span-1" aria-label="Phân bổ trạng thái mẫu">
            <SampleStatusChart data={statusDistribution} />
          </div>
          <div className="lg:col-span-2" aria-label="Xu hướng tiếp nhận mẫu">
            <SampleAccessionTrendChart data={accessionTrendData} />
          </div>

          {/* Row 3: Staff Productivity (manager only, full width 2 cols) */}
          {role === 'manager' && staffProductivity && (
            <div className="lg:col-span-2" aria-label="Năng suất nhân viên">
              <StaffProductivityChart data={staffProductivity} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
