import { createClient } from '@/lib/supabase/server'
import type {
  DateRange,
  KPIMetrics,
  TATTrendData,
  SampleStatusData,
  CoAStatistics,
  StaffProductivityData,
  RecentSample,
} from '@/types'
import { DateRangeSchema } from '@/types'

/**
 * Server-side helper to fetch KPI metrics for Reports Dashboard.
 * Can be safely imported into Server Components (no Server Action boundary).
 *
 * @param dateRange - Start and end date range for filtering
 * @returns KPIMetrics object with all 5 KPI metrics
 */
export async function fetchKPIData(dateRange: DateRange): Promise<KPIMetrics> {
  // Validate input
  const validated = DateRangeSchema.parse(dateRange)

  const supabase = await createClient()

  // Fetch all metrics in parallel (performance optimization)
  const [
    { data: tatData, error: tatError },
    { data: statusData, error: statusError },
    { data: approvalData, error: approvalError },
    { data: errorData, error: errorError },
  ] = await Promise.all([
    supabase.rpc('calculate_average_tat', {
      start_date: validated.start,
      end_date: validated.end,
    }),
    supabase.rpc('get_samples_by_status', {
      start_date: validated.start,
      end_date: validated.end,
    }),
    supabase.rpc('get_approval_queue_metrics', {
      start_date: validated.start,
      end_date: validated.end,
    }),
    supabase.rpc('get_error_rate_metrics', {
      start_date: validated.start,
      end_date: validated.end,
    }),
  ])

  if (tatError) {
    console.error('Error fetching TAT metrics:', tatError)
    throw new Error(`Failed to fetch TAT metrics: ${tatError.message}`)
  }

  if (statusError) {
    console.error('Error fetching status distribution:', statusError)
    throw new Error(`Failed to fetch status distribution: ${statusError.message}`)
  }

  if (approvalError) {
    console.error('Error fetching approval metrics:', approvalError)
    throw new Error(`Failed to fetch approval metrics: ${approvalError.message}`)
  }

  if (errorError) {
    console.error('Error fetching error rate:', errorError)
    throw new Error(`Failed to fetch error rate: ${errorError.message}`)
  }

  // Calculate WIP (received + assigned + in_progress + review)
  const wipCount = statusData
    ?.filter((s: { status: string }) =>
      ['received', 'assigned', 'in_progress', 'review'].includes(s.status)
    )
    .reduce((sum: number, s: { count: number | bigint }) => sum + Number(s.count), 0) || 0

  // Calculate on-time delivery rate
  const tatRecord = tatData?.[0]
  const onTimeRate = tatRecord
    ? (Number(tatRecord.on_time_count) / Number(tatRecord.sample_count)) * 100
    : 0

  return {
    avgTAT: {
      value: Number(tatRecord?.avg_tat_hours || 0),
      unit: 'hours',
      trend: 0, // TODO: Compare with previous period
      previousValue: 0,
    },
    wipCount: {
      value: wipCount,
      breakdown: statusData?.map((s: { status: string; count: number | bigint }) => ({
        status: s.status,
        count: Number(s.count),
      })) || [],
    },
    pendingApprovals: {
      count: Number(approvalData?.[0]?.pending_count || 0),
      avgWaitHours: Number(approvalData?.[0]?.avg_wait_hours || 0),
      overdueCount: Number(approvalData?.[0]?.overdue_count || 0),
      isAlert: Number(approvalData?.[0]?.pending_count || 0) > 20 ||
        Number(approvalData?.[0]?.avg_wait_hours || 0) > 24,
    },
    onTimeRate: {
      value: onTimeRate,
      trend: 0, // TODO: Compare with previous period
      color: onTimeRate >= 90 ? 'green' : onTimeRate >= 80 ? 'yellow' : 'red',
    },
    errorRate: {
      value: Number(errorData?.[0]?.error_rate || 0),
      totalModifications: Number(errorData?.[0]?.total_modifications || 0),
      totalResults: Number(errorData?.[0]?.total_results || 0),
      trend: 0, // TODO: Compare with previous period
    },
  }
}

/**
 * Server-side helper to fetch TAT trend data for line chart.
 * Can be safely imported into Server Components.
 * Uses database-side aggregation for optimal performance.
 *
 * @param dateRange - Start and end date range for filtering
 * @returns Array of daily TAT averages
 */
export async function fetchTATTrendData(dateRange: DateRange): Promise<TATTrendData[]> {
  // Validate input
  const validated = DateRangeSchema.parse(dateRange)

  const supabase = await createClient()

  // Use database-side aggregation for better performance
  const { data, error } = await supabase.rpc('get_tat_trend_daily', {
    start_date: validated.start,
    end_date: validated.end,
  })

  if (error) {
    console.error('Error fetching TAT trend data:', error)
    throw new Error(`Failed to fetch TAT trend data: ${error.message}`)
  }

  return (
    data?.map((item: { date: string; avg_tat_hours: number; sample_count: number | bigint }) => ({
      date: item.date,
      avgTATHours: Number(item.avg_tat_hours),
      sampleCount: Number(item.sample_count),
    })) || []
  )
}

/**
 * Server-side helper to fetch sample status distribution for bar chart.
 * Can be safely imported into Server Components.
 *
 * @param dateRange - Start and end date range for filtering
 * @returns Array of status counts
 */
export async function fetchSampleStatusDistribution(
  dateRange: DateRange
): Promise<SampleStatusData[]> {
  // Validate input
  const validated = DateRangeSchema.parse(dateRange)

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_samples_by_status', {
    start_date: validated.start,
    end_date: validated.end,
  })

  if (error) {
    console.error('Error fetching sample status distribution:', error)
    throw new Error(`Failed to fetch status distribution: ${error.message}`)
  }

  return (
    data?.map((item: { status: string; count: number | bigint }) => ({
      status: item.status,
      count: Number(item.count),
    })) || []
  )
}

/**
 * Server-side helper to fetch CoA generation statistics for donut chart.
 * Can be safely imported into Server Components.
 *
 * @param dateRange - Start and end date range for filtering
 * @returns Array of CoA statistics with percentages
 */
export async function fetchCoAStatistics(dateRange: DateRange): Promise<CoAStatistics[]> {
  // Validate input
  const validated = DateRangeSchema.parse(dateRange)

  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_coa_statistics', {
    start_date: validated.start,
    end_date: validated.end,
  })

  if (error) {
    console.error('Error fetching CoA statistics:', error)
    throw new Error(`Failed to fetch CoA statistics: ${error.message}`)
  }

  return (
    data?.map((item: { segment: string; count: number | bigint; percentage: number }) => ({
      segment: item.segment,
      count: Number(item.count),
      percentage: Number(item.percentage),
    })) || []
  )
}

/**
 * Server-side helper to fetch staff productivity data for manager-only comparison chart.
 * Throws error if called by non-manager role.
 * Can be safely imported into Server Components.
 *
 * @param dateRange - Start and end date range for filtering
 * @returns Array of analyst productivity metrics
 */
export async function fetchStaffProductivity(
  dateRange: DateRange
): Promise<StaffProductivityData[]> {
  // Validate input
  const validated = DateRangeSchema.parse(dateRange)

  const supabase = await createClient()

  // This RPC function checks role internally and throws if not manager
  const { data, error } = await supabase.rpc('get_staff_productivity', {
    start_date: validated.start,
    end_date: validated.end,
  })

  if (error) {
    console.error('Error fetching staff productivity:', error)
    throw new Error(`Failed to fetch staff productivity: ${error.message}`)
  }

  return (
    data?.map((item: { analyst_id: string; analyst_name: string; tests_completed: number | bigint; results_modified: number | bigint }) => ({
      analystId: item.analyst_id,
      analystName: item.analyst_name,
      testsCompleted: Number(item.tests_completed),
      resultsModified: Number(item.results_modified),
    })) || []
  )
}

/**
 * Server-side helper to fetch recent samples for data table with optional status filter.
 * Returns paginated results (default 50 per page).
 * Can be safely imported into Server Components.
 *
 * @param dateRange - Start and end date range for filtering
 * @param filters - Optional status, page, and pageSize filters
 * @returns Object with samples array and total count
 */
export async function fetchRecentSamples(
  dateRange: DateRange,
  filters?: {
    status?: string
    page?: number
    pageSize?: number
  }
): Promise<{ samples: RecentSample[]; total: number }> {
  // Validate input
  const validated = DateRangeSchema.parse(dateRange)

  // Validate page number (must be at least 1)
  const page = Math.max(1, filters?.page || 1)
  const pageSize = filters?.pageSize || 50
  const offset = (page - 1) * pageSize

  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('samples')
    .select('id, sample_id, client_name, received_at, completed_at, status, deleted_at', {
      count: 'exact',
    })
    .gte('received_at', validated.start)
    .lte('received_at', validated.end)
    .is('deleted_at', null)
    .order('completed_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + pageSize - 1)

  // Apply status filter if provided
  if (filters?.status) {
    query = query.eq('status', filters.status)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching recent samples:', error)
    throw new Error(`Failed to fetch recent samples: ${error.message}`)
  }

  // Calculate TAT for each sample
  const samples: RecentSample[] =
    data?.map((sample: {
      id: string
      sample_id: string
      client_name: string
      received_at: string
      completed_at: string | null
      status: string
    }) => {
      let tatHours = null
      if (sample.completed_at && sample.received_at) {
        tatHours =
          (new Date(sample.completed_at).getTime() -
            new Date(sample.received_at).getTime()) /
          (1000 * 60 * 60)
      }

      return {
        id: sample.id,
        sampleId: sample.sample_id,
        clientName: sample.client_name,
        receivedAt: sample.received_at,
        completedAt: sample.completed_at || null,
        status: sample.status as any, // TypeScript will validate this against SampleStatus
        tatHours,
      }
    }) || []

  return {
    samples,
    total: count || 0,
  }
}
