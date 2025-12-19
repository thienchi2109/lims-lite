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
import { format, startOfMonth, isValid, parseISO } from 'date-fns'
import type { DateRange, SampleStatus } from '@/types'
import { Activity, ClipboardCheck, AlertCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import { z } from 'zod'

// Vietnamese status translations
const statusTranslations: Record<SampleStatus, string> = {
  received: 'Đã nhận',
  assigned: 'Đã giao',
  in_progress: 'Đang thực hiện',
  review: 'Đang duyệt',
  discarded: 'Hủy bỏ',
  completed: 'Hoàn thành',
}

// Zod schema for URL parameter validation
const SearchParamsSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  statusFilter: z.string().optional(),
})

interface SearchParams {
  fromDate?: string | string[]
  toDate?: string | string[]
  statusFilter?: string | string[]
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
    redirect('/analyst')
  }

  // Coerce array params to single strings
  const rawFromDate = Array.isArray(searchParams.fromDate) ? searchParams.fromDate[0] : searchParams.fromDate
  const rawToDate = Array.isArray(searchParams.toDate) ? searchParams.toDate[0] : searchParams.toDate
  const rawStatusFilter = Array.isArray(searchParams.statusFilter) ? searchParams.statusFilter[0] : searchParams.statusFilter

  // Validate and sanitize URL parameters
  const validatedParams = SearchParamsSchema.safeParse({
    fromDate: rawFromDate,
    toDate: rawToDate,
    statusFilter: rawStatusFilter,
  })

  // Default date values
  const defaultFromDate = format(startOfMonth(new Date()), 'yyyy-MM-dd')
  const defaultToDate = format(new Date(), 'yyyy-MM-dd')

  // Parse and validate dates
  let fromDate = defaultFromDate
  let toDate = defaultToDate

  if (validatedParams.success) {
    // Validate fromDate
    if (validatedParams.data.fromDate) {
      const parsedFromDate = parseISO(validatedParams.data.fromDate)
      if (isValid(parsedFromDate)) {
        fromDate = validatedParams.data.fromDate
      }
    }

    // Validate toDate
    if (validatedParams.data.toDate) {
      const parsedToDate = parseISO(validatedParams.data.toDate)
      if (isValid(parsedToDate)) {
        toDate = validatedParams.data.toDate
      }
    }

    // Ensure fromDate <= toDate
    const fromDateObj = parseISO(fromDate)
    const toDateObj = parseISO(toDate)
    if (fromDateObj > toDateObj) {
      // Swap dates if from > to
      const temp = fromDate
      fromDate = toDate
      toDate = temp
    }
  }

  const dateRange: DateRange = {
    start: fromDate,
    end: toDate,
  }

  // Cast statusFilter to SampleStatus if it matches valid statuses
  const validStatus = validatedParams.success && validatedParams.data.statusFilter &&
    ['received', 'assigned', 'in_progress', 'review', 'discarded', 'completed'].includes(validatedParams.data.statusFilter)
    ? (validatedParams.data.statusFilter as SampleStatus)
    : undefined

  // Fetch all data in parallel for performance
  const [
    kpiMetricsResult,
    tatTrendResult,
    statusDistributionResult,
    coaStatisticsResult,
    staffProductivityResult,
    recentSamplesResult,
  ] = await Promise.all([
    getKPIMetrics(dateRange),
    getTATTrendData(dateRange),
    getSampleStatusDistribution(dateRange),
    getCoAStatistics(dateRange),
    getStaffProductivity(dateRange),
    getRecentSamples(dateRange, validStatus ? { status: validStatus } : undefined),
  ])

  // Error handling for data fetches
  if (!kpiMetricsResult || !tatTrendResult || !statusDistributionResult ||
      !coaStatisticsResult || !staffProductivityResult || !recentSamplesResult) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-red-600 mb-2">Lỗi tải dữ liệu</h2>
          <p className="text-slate-600">Không thể tải dữ liệu báo cáo. Vui lòng thử lại sau.</p>
        </div>
      </div>
    )
  }

  const kpiMetrics = kpiMetricsResult
  const tatTrendData = tatTrendResult
  const statusDistribution = statusDistributionResult
  const coaStatistics = coaStatisticsResult
  const staffProductivity = staffProductivityResult
  const recentSamples = recentSamplesResult

  // Handle empty samples data
  if (!recentSamples.samples) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-600 mb-2">Không có dữ liệu</h2>
          <p className="text-slate-600">Không tìm thấy mẫu nào trong khoảng thời gian này.</p>
        </div>
      </div>
    )
  }

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

          {/* Row 2: Sample Status (1 col) + Staff Productivity (2 cols) */}
          <div className="lg:col-span-1" aria-label="Phân bổ trạng thái mẫu">
            <SampleStatusChart data={statusDistribution} />
          </div>
          <div className="lg:col-span-2" aria-label="Năng suất nhân viên">
            <StaffProductivityChart data={staffProductivity} />
          </div>
        </div>

        {/* Recent Samples Table */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm p-6 shadow-sm" role="region" aria-label="Bảng mẫu gần đây">
          <RecentSamplesTable data={transformedSamples} statusFilter={validStatus} />
        </div>
      </div>
    </div>
  )
}
