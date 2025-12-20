import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { ExportExcelButton } from '@/components/reports/export-excel-button'
import { KPICardsGrid } from '@/components/kpi-cards-grid'
import { KPICard } from '@/components/kpi-card'
import { TATTrendChart } from '@/components/tat-trend-chart'
import { SampleStatusChart } from '@/components/sample-status-chart'
import { CoAStatisticsChart } from '@/components/coa-statistics-chart'
import { StaffProductivityChart } from '@/components/staff-productivity-chart'
import { RecentSamplesTable } from '@/components/reports/recent-samples-table'
import type { SampleStatus, TATTrendData, SampleStatusData, CoAStatistics, StaffProductivityData, KPIMetrics } from '@/types'
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
  fromDate: string
  toDate: string
  kpiMetrics: KPIMetrics
  tatTrendData: TATTrendData[]
  statusDistribution: SampleStatusData[]
  coaStatistics: CoAStatistics[]
  staffProductivity?: StaffProductivityData[]
  transformedSamples: Array<{
    id: string
    sample_id: string
    client_name: string
    status: SampleStatus
    received_at: string
    approved_at: string | null
    tat_hours: number | null
  }>
  validStatus?: SampleStatus
}

export function ReportsLayout({
  role,
  fromDate,
  toDate,
  kpiMetrics,
  tatTrendData,
  statusDistribution,
  coaStatistics,
  staffProductivity,
  transformedSamples,
  validStatus,
}: ReportsLayoutProps) {
  // Role-specific welcome messages
  const welcomeMessage = role === 'manager'
    ? 'Xem tổng quan hiệu suất phòng lab và phân tích xu hướng'
    : 'Theo dõi hiệu suất phòng lab và phân tích xu hướng'

  return (
    <div className="relative min-h-screen">
      {/* Glassmorphism background decorations */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-400/20 to-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 max-w-7xl mx-auto space-y-6 p-4 sm:p-6 lg:p-8">
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
            <p className="text-sm text-muted-foreground mt-1">
              {welcomeMessage}
            </p>
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
              samplesData={transformedSamples}
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

          {/* Row 2: Sample Status + Staff Productivity (manager only) */}
          <div className="lg:col-span-1" aria-label="Phân bổ trạng thái mẫu">
            <SampleStatusChart data={statusDistribution} />
          </div>
          {role === 'manager' && staffProductivity ? (
            <div className="lg:col-span-2" aria-label="Năng suất nhân viên">
              <StaffProductivityChart data={staffProductivity} />
            </div>
          ) : (
            // For analyst, Sample Status takes full width on row 2
            role === 'analyst' && <div className="lg:col-span-2" />
          )}
        </div>

        {/* Recent Samples Table */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm p-6 shadow-sm" role="region" aria-label="Bảng mẫu gần đây">
          <RecentSamplesTable data={transformedSamples} statusFilter={validStatus} />
        </div>
      </div>
    </div>
  )
}
