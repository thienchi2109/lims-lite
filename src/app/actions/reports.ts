'use server'

import { createClient } from '@/lib/supabase/server'
import type {
  DateRange,
  KPIMetrics,
  TATTrendData,
  SampleAccessionTrendData,
  SampleStatusData,
  CoAStatistics,
  StaffProductivityData,
  RecentSample,
  SpecialtySampleData,
  SampleStatus,
} from '@/types'
import { DateRangeSchema } from '@/types'
import { z } from 'zod'
import * as XLSX from 'xlsx'

type RpcRecord = Record<string, unknown>

function getFirstRecord<T extends RpcRecord>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) {
    return data[0] ?? null
  }

  return data ?? null
}

function getRecordList<T extends RpcRecord>(data: T[] | T | null | undefined): T[] {
  if (Array.isArray(data)) {
    return data
  }

  return []
}

function normalizeRpcError(error: unknown, rpcName: string): Error {
  if (error instanceof Error) {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message = typeof error.message === 'string'
      ? error.message
      : `KPI metrics RPC failed: ${rpcName}`
    const normalizedError = new Error(message)

    if ('code' in error && typeof error.code === 'string') {
      ;(normalizedError as Error & { code?: string }).code = error.code
    }

    return normalizedError
  }

  return new Error(`KPI metrics RPC failed: ${rpcName}`)
}

/**
 * Fetches all 5 KPI metrics for the dashboard
 * Returns: Average TAT, WIP count, pending approvals, on-time rate, error rate
 */
export async function getKPIMetrics(dateRange: DateRange): Promise<KPIMetrics> {
  try {
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

    const tatRecord = tatError ? null : getFirstRecord(tatData)
    const statusRecords = statusError ? [] : getRecordList(statusData)
    const approvalRecord = approvalError ? null : getFirstRecord(approvalData)
    const errorRecord = errorError ? null : getFirstRecord(errorData)

    const rpcFailures = [
      { rpcName: 'calculate_average_tat', error: tatError },
      { rpcName: 'get_samples_by_status', error: statusError },
      { rpcName: 'get_approval_queue_metrics', error: approvalError },
      { rpcName: 'get_error_rate_metrics', error: errorError },
    ].filter((failure) => failure.error !== null)

    if (rpcFailures.length > 0) {
      rpcFailures.forEach(({ rpcName, error }) => {
        console.error(`KPI metrics RPC failed: ${rpcName}`, error)
      })

      const firstFailure = rpcFailures[0]
      throw normalizeRpcError(firstFailure.error, firstFailure.rpcName)
    }

    // Calculate WIP (received + assigned + in_progress + review)
    const wipCount = statusRecords
      .filter((s: { status: string }) =>
        ['received', 'assigned', 'in_progress', 'review'].includes(s.status)
      )
      .reduce((sum: number, s: { count: number | bigint }) => sum + Number(s.count), 0)

    // Calculate on-time delivery rate
    const onTimeRate = tatRecord && Number(tatRecord.sample_count) > 0
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
        breakdown: statusRecords.map((s: { status: string; count: number | bigint }) => ({
          status: s.status,
          count: Number(s.count),
        })),
      },
      pendingApprovals: {
        count: Number(approvalRecord?.pending_count || 0),
        avgWaitHours: Number(approvalRecord?.avg_wait_hours || 0),
        overdueCount: Number(approvalRecord?.overdue_count || 0),
        isAlert: Number(approvalRecord?.pending_count || 0) > 20 ||
          Number(approvalRecord?.avg_wait_hours || 0) > 24,
      },
      onTimeRate: {
        value: onTimeRate,
        trend: 0, // TODO: Compare with previous period
        color: onTimeRate >= 90 ? 'green' : onTimeRate >= 80 ? 'yellow' : 'red',
      },
      errorRate: {
        value: Number(errorRecord?.error_rate || 0),
        totalModifications: Number(errorRecord?.total_modifications || 0),
        totalResults: Number(errorRecord?.total_results || 0),
        trend: 0, // TODO: Compare with previous period
      },
    }
  } catch (error) {
    console.error('Error fetching KPI metrics:', error)
    throw error
  }
}

/**
 * Fetches TAT trend data for line chart (daily averages over date range)
 * Uses database-side aggregation for optimal performance
 */
export async function getTATTrendData(dateRange: DateRange): Promise<TATTrendData[]> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    const supabase = await createClient()

    // Use database-side aggregation for better performance
    const { data, error } = await supabase.rpc('get_tat_trend_daily', {
      start_date: validated.start,
      end_date: validated.end,
    })

    if (error) throw error

    return (
      data?.map((item: { date: string; avg_tat_hours: number; sample_count: number | bigint }) => ({
        date: item.date,
        avgTATHours: Number(item.avg_tat_hours),
        sampleCount: Number(item.sample_count),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching TAT trend data:', error)
    throw error
  }
}

/**
 * Fetches sample accession trend data with cumulative totals
 * Automatically adjusts granularity based on date range:
 * - ≤ 31 days → Daily aggregation
 * - ≤ 365 days → Monthly aggregation
 * - > 365 days → Yearly aggregation
 */
export async function getSampleAccessionTrend(
  dateRange: DateRange
): Promise<SampleAccessionTrendData[]> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    const supabase = await createClient()

    // Call RPC function (auto-determines granularity)
    const { data, error } = await supabase.rpc('get_sample_accession_trend', {
      start_date: validated.start,
      end_date: validated.end,
    })

    if (error) throw error

    // Transform to match TypeScript types
    return (
      data?.map((item: {
        period: string
        sample_count: number | bigint
        cumulative_count: number | bigint
      }) => ({
        period: item.period,
        sampleCount: Number(item.sample_count),
        cumulativeCount: Number(item.cumulative_count),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching sample accession trend:', error)
    throw error
  }
}

/**
 * Fetches sample status distribution for bar chart
 */
export async function getSampleStatusDistribution(
  dateRange: DateRange
): Promise<SampleStatusData[]> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_samples_by_status', {
      start_date: validated.start,
      end_date: validated.end,
    })

    if (error) throw error

    return (
      data?.map((item: { status: string; count: number | bigint }) => ({
        status: item.status,
        count: Number(item.count),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching sample status distribution:', error)
    throw error
  }
}

/**
 * Fetches CoA generation statistics for donut chart
 */
export async function getCoAStatistics(dateRange: DateRange): Promise<CoAStatistics[]> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_coa_statistics', {
      start_date: validated.start,
      end_date: validated.end,
    })

    if (error) throw error

    return (
      data?.map((item: { segment: string; count: number | bigint; percentage: number }) => ({
        segment: item.segment,
        count: Number(item.count),
        percentage: Number(item.percentage),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching CoA statistics:', error)
    throw error
  }
}

/**
 * Fetches staff productivity data for manager-only comparison chart
 * Throws error if called by non-manager role
 */
export async function getStaffProductivity(
  dateRange: DateRange
): Promise<StaffProductivityData[]> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    const supabase = await createClient()

    // This RPC function checks role internally and throws if not manager
    const { data, error } = await supabase.rpc('get_staff_productivity', {
      start_date: validated.start,
      end_date: validated.end,
    })

    if (error) throw error

    return (
      data?.map((item: { analyst_id: string; analyst_name: string; tests_completed: number | bigint; results_modified: number | bigint }) => ({
        analystId: item.analyst_id,
        analystName: item.analyst_name,
        testsCompleted: Number(item.tests_completed),
        resultsModified: Number(item.results_modified),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching staff productivity:', error)
    throw error
  }
}

/**
 * Fetches sample statistics grouped by lab specialty and status
 * Used by the "Thống kê Mẫu theo Nhóm Kỹ Thuật" chart on Reports page
 */
export async function getSpecialtySampleStats(
  dateRange: DateRange,
  statuses: SampleStatus[]
): Promise<SpecialtySampleData[]> {
  try {
    // Validate date range
    const validated = DateRangeSchema.parse(dateRange)

    // If no statuses provided, return empty array (no data to show)
    if (!statuses || statuses.length === 0) {
      return []
    }

    const supabase = await createClient()

    const { data, error } = await supabase.rpc('get_specialty_sample_stats', {
      p_from_date: validated.start,
      p_to_date: validated.end,
      p_statuses: statuses,
    })

    if (error) throw error

    return (
      data?.map((item: {
        specialty_code: string
        specialty_name: string
        status: string
        sample_count: number | bigint
        test_count: number | bigint
      }) => ({
        specialtyCode: item.specialty_code,
        specialtyName: item.specialty_name,
        status: item.status as SampleStatus,
        sampleCount: Number(item.sample_count),
        testCount: Number(item.test_count),
      })) || []
    )
  } catch (error) {
    console.error('Error fetching specialty sample stats:', error)
    throw error
  }
}

/**
 * Fetches recent samples for data table with optional status filter
 * Returns paginated results (default 50 per page)
 */
export async function getRecentSamples(
  dateRange: DateRange,
  filters?: {
    status?: string
    page?: number
    pageSize?: number
  }
): Promise<{ samples: RecentSample[]; total: number }> {
  try {
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

    if (error) throw error

    // Calculate TAT for each sample
    const samples: RecentSample[] =
      data?.map((sample) => {
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
          status: sample.status,
          tatHours,
        }
      }) || []

    return {
      samples,
      total: count || 0,
    }
  } catch (error) {
    console.error('Error fetching recent samples:', error)
    throw error
  }
}

/**
 * Generates Excel workbook with 3 sheets: KPI Overview, Sample Details, CoA Statistics
 * Returns base64 encoded workbook for download
 */
export async function exportReportsToExcel(dateRange: DateRange): Promise<string> {
  try {
    // Validate input
    const validated = DateRangeSchema.parse(dateRange)

    // Fetch all data
    const kpiMetrics = await getKPIMetrics(validated)
    const recentSamples = await getRecentSamples(validated, { pageSize: 10000 })
    const coaStats = await getCoAStatistics(validated)

    // Create workbook
    const workbook = XLSX.utils.book_new()

    // Sheet 1: KPI Overview
    const kpiData = [
      { 'Chỉ số': 'TAT Trung Bình', 'Giá trị': `${kpiMetrics.avgTAT.value.toFixed(2)} giờ` },
      { 'Chỉ số': 'Mẫu Đang Xử Lý', 'Giá trị': kpiMetrics.wipCount.value },
      { 'Chỉ số': 'Chờ Phê Duyệt', 'Giá trị': kpiMetrics.pendingApprovals.count },
      { 'Chỉ số': 'Tỷ Lệ Đúng Hạn', 'Giá trị': `${kpiMetrics.onTimeRate.value.toFixed(2)}%` },
      { 'Chỉ số': 'Tỷ Lệ Lỗi', 'Giá trị': `${kpiMetrics.errorRate.value.toFixed(2)}%` },
    ]
    const kpiSheet = XLSX.utils.json_to_sheet(kpiData)
    XLSX.utils.book_append_sheet(workbook, kpiSheet, 'Tổng quan KPI')

    // Sheet 2: Sample Details
    const sampleData = recentSamples.samples.map((s) => ({
      'Mã mẫu': s.sampleId,
      'Khách hàng': s.clientName,
      'Ngày nhận': new Date(s.receivedAt).toLocaleDateString('vi-VN'),
      'Ngày hoàn thành': s.completedAt
        ? new Date(s.completedAt).toLocaleDateString('vi-VN')
        : '',
      'TAT (giờ)': s.tatHours?.toFixed(2) || '',
      'Trạng thái': s.status,
    }))
    const sampleSheet = XLSX.utils.json_to_sheet(sampleData)
    XLSX.utils.book_append_sheet(workbook, sampleSheet, 'Chi tiết mẫu')

    // Sheet 3: CoA Statistics
    const coaData = coaStats.map((stat) => ({
      'Phân loại': stat.segment,
      'Số lượng': stat.count,
      'Tỷ lệ': `${stat.percentage.toFixed(2)}%`,
    }))
    const coaSheet = XLSX.utils.json_to_sheet(coaData)
    XLSX.utils.book_append_sheet(workbook, coaSheet, 'Thống kê CoA')

    // Convert to base64
    const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
    return Buffer.from(excelBuffer).toString('base64')
  } catch (error) {
    console.error('Error exporting to Excel:', error)
    throw error
  }
}
