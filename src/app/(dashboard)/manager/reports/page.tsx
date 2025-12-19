import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DateRangeFilter } from '@/components/reports/date-range-filter'
import { ExportExcelButton } from '@/components/reports/export-excel-button'
import { KPICardsGrid } from '@/components/kpi-cards-grid'
import { KPICard } from '@/components/kpi-card'
import { TATTrendChart } from '@/components/tat-trend-chart'
import { SampleStatusChart } from '@/components/sample-status-chart'
import { CoAStatisticsChart } from '@/components/coa-statistics-chart'
import { StaffProductivityChart } from '@/components/staff-productivity-chart'
import { RecentSamplesTable } from '@/components/reports/recent-samples-table'
import {
  getKPIMetrics,
  getTATTrendData,
  getSampleStatusDistribution,
  getCoAStatistics,
  getStaffProductivity,
  getRecentSamples,
} from '@/app/actions/reports'
import { format, startOfMonth } from 'date-fns'
import type { DateRange, SampleStatus } from '@/types'
import { Activity, ClipboardCheck, AlertCircle, TrendingUp, AlertTriangle } from 'lucide-react'

interface SearchParams {
  fromDate?: string
  toDate?: string
  statusFilter?: string
}

export default async function ManagerReportsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const supabase = await createClient()

  // Auth check
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Role check
  const { data: userData } = await supabase
    .from('users')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!userData || userData.role !== 'manager') {
    redirect('/manager')
  }

  // Extract date range from URL params (or use defaults)
  const fromDate = searchParams.fromDate || format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const toDate = searchParams.toDate || format(new Date(), 'yyyy-MM-dd')

  const dateRange: DateRange = {
    start: fromDate,
    end: toDate,
  }

  // Cast statusFilter to SampleStatus if it matches valid statuses
  const validStatus = searchParams.statusFilter &&
    ['received', 'assigned', 'in_progress', 'review', 'discarded', 'completed'].includes(searchParams.statusFilter)
    ? (searchParams.statusFilter as SampleStatus)
    : undefined

  // Fetch all data in parallel for performance
  const [
    kpiMetrics,
    tatTrendData,
    statusDistribution,
    coaStatistics,
    staffProductivity,
    recentSamples,
  ] = await Promise.all([
    getKPIMetrics(dateRange),
    getTATTrendData(dateRange),
    getSampleStatusDistribution(dateRange),
    getCoAStatistics(dateRange),
    getStaffProductivity(dateRange),
    getRecentSamples(dateRange, validStatus ? { status: validStatus } : undefined),
  ])

  // Transform camelCase to snake_case for compatibility with Phase 5 components
  const transformedSamples = recentSamples.samples.map((sample) => ({
    id: sample.id,
    sample_id: sample.sampleId,
    client_name: sample.clientName,
    status: sample.status,
    received_at: sample.receivedAt,
    approved_at: sample.completedAt,
    tat_hours: sample.tatHours,
  }))

  return (
    <div className="relative min-h-screen">
      {/* Glassmorphism background decorations */}
      <div className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-sky-400/20 to-blue-500/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-500/20 rounded-full blur-3xl" />
      </div>

      <div className="flex-1 space-y-6 p-6 md:p-8">
        {/* Header with title and export button */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Báo cáo & Phân tích
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Xem tổng quan hiệu suất phòng lab và phân tích xu hướng
            </p>
          </div>
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
              <div className="text-xs text-muted-foreground mt-1">
                {kpiMetrics.wipCount.breakdown.slice(0, 3).map((item) => (
                  <div key={item.status}>
                    {item.status}: {item.count}
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
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Row 1: TAT Trend (2 cols) + CoA Stats (1 col) */}
          <div className="lg:col-span-2">
            <TATTrendChart data={tatTrendData} />
          </div>
          <div className="lg:col-span-1">
            <CoAStatisticsChart data={coaStatistics} />
          </div>

          {/* Row 2: Sample Status (1 col) + Staff Productivity (2 cols) */}
          <div className="lg:col-span-1">
            <SampleStatusChart data={statusDistribution} />
          </div>
          <div className="lg:col-span-2">
            <StaffProductivityChart data={staffProductivity} />
          </div>
        </div>

        {/* Recent Samples Table */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm p-6 shadow-sm">
          <RecentSamplesTable data={transformedSamples} statusFilter={validStatus} />
        </div>
      </div>
    </div>
  )
}
