import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ReportsLayout } from '@/components/reports/reports-layout'
import {
  getKPIMetrics,
  getTATTrendData,
  getSampleStatusDistribution,
  getCoAStatistics,
  getStaffProductivity,
  getSampleAccessionTrend,
} from '@/app/actions/reports'
import { format, startOfMonth, isValid, parseISO } from 'date-fns'
import type { DateRange } from '@/types'
import { z } from 'zod'

// Zod schema for URL parameter validation
const SearchParamsSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
})

interface SearchParams {
  fromDate?: string | string[]
  toDate?: string | string[]
}

export default async function ManagerReportsPage(props: {
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

  if (!userData || userData.role !== 'manager') {
    redirect('/analyst')
  }

  // Coerce array params to single strings
  const rawFromDate = Array.isArray(searchParams.fromDate) ? searchParams.fromDate[0] : searchParams.fromDate
  const rawToDate = Array.isArray(searchParams.toDate) ? searchParams.toDate[0] : searchParams.toDate

  // Validate and sanitize URL parameters
  const validatedParams = SearchParamsSchema.safeParse({
    fromDate: rawFromDate,
    toDate: rawToDate,
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

  // Fetch all data in parallel for performance
  const [
    kpiMetricsResult,
    tatTrendResult,
    statusDistributionResult,
    coaStatisticsResult,
    staffProductivityResult,
    accessionTrendResult,
  ] = await Promise.all([
    getKPIMetrics(dateRange),
    getTATTrendData(dateRange),
    getSampleStatusDistribution(dateRange),
    getCoAStatistics(dateRange),
    getStaffProductivity(dateRange),
    getSampleAccessionTrend(dateRange),
  ])

  // Error handling for data fetches
  if (!kpiMetricsResult || !tatTrendResult || !statusDistributionResult ||
      !coaStatisticsResult || !staffProductivityResult || !accessionTrendResult) {
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
  const accessionTrendData = accessionTrendResult

  return (
    <ReportsLayout
      role="manager"
      user={userData}
      fromDate={fromDate}
      toDate={toDate}
      kpiMetrics={kpiMetrics}
      tatTrendData={tatTrendData}
      statusDistribution={statusDistribution}
      accessionTrendData={accessionTrendData}
      coaStatistics={coaStatistics}
      staffProductivity={staffProductivity}
    />
  )
}
