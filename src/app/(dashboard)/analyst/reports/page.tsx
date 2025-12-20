import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsLayout } from '@/components/reports/reports-layout'
import {
  getKPIMetrics,
  getTATTrendData,
  getSampleStatusDistribution,
  getCoAStatistics,
  getRecentSamples,
} from '@/app/actions/reports'
import { format, startOfMonth, isValid, parseISO } from 'date-fns'
import type { DateRange, SampleStatus } from '@/types'
import { z } from 'zod'

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

export default async function AnalystReportsPage(props: {
  searchParams: Promise<SearchParams>
}) {
  // Await searchParams (Next.js 16 requirement)
  const searchParams = await props.searchParams

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

  if (!userData || userData.role !== 'analyst') {
    redirect('/manager')
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
    start: fromDate + 'T00:00:00Z', // Convert to ISO datetime with UTC timezone
    end: toDate + 'T23:59:59Z', // End of day in UTC
  }

  // Cast statusFilter to SampleStatus if it matches valid statuses
  const validStatus = validatedParams.success && validatedParams.data.statusFilter &&
    ['received', 'assigned', 'in_progress', 'review', 'discarded', 'completed'].includes(validatedParams.data.statusFilter)
    ? (validatedParams.data.statusFilter as SampleStatus)
    : undefined

  // Fetch all data in parallel for performance (no staff productivity for analyst)
  const [
    kpiMetricsResult,
    tatTrendResult,
    statusDistributionResult,
    coaStatisticsResult,
    recentSamplesResult,
  ] = await Promise.all([
    getKPIMetrics(dateRange),
    getTATTrendData(dateRange),
    getSampleStatusDistribution(dateRange),
    getCoAStatistics(dateRange),
    getRecentSamples(dateRange, validStatus ? { status: validStatus } : undefined),
  ])

  // Error handling for data fetches
  if (!kpiMetricsResult || !tatTrendResult || !statusDistributionResult ||
      !coaStatisticsResult || !recentSamplesResult) {
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
    status: sample.status as SampleStatus,
    received_at: sample.receivedAt,
    approved_at: sample.completedAt,
    tat_hours: sample.tatHours,
  }))

  return (
    <ReportsLayout
      role="analyst"
      user={userData}
      fromDate={fromDate}
      toDate={toDate}
      kpiMetrics={kpiMetrics}
      tatTrendData={tatTrendData}
      statusDistribution={statusDistribution}
      coaStatistics={coaStatistics}
      transformedSamples={transformedSamples}
      validStatus={validStatus}
    />
  )
}
