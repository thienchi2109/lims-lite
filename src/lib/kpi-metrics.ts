import type { KPIMetrics } from '@/types'

export const KPI_RPC_NAME = 'get_kpi_metrics'

type RpcRecord = Record<string, unknown>

type ConsolidatedKpiRpcRow = RpcRecord & {
  avg_tat_hours?: number | string | null
  sample_count?: number | string | null
  on_time_count?: number | string | null
  status_breakdown?: unknown
  pending_count?: number | string | null
  avg_wait_hours?: number | string | null
  overdue_count?: number | string | null
  error_rate?: number | string | null
  total_modifications?: number | string | null
  total_results?: number | string | null
}

function getFirstRecord<T extends RpcRecord>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) {
    return data[0] ?? null
  }

  return data ?? null
}

function toNumber(value: unknown): number {
  const numericValue = Number(value ?? 0)
  return Number.isFinite(numericValue) ? numericValue : 0
}

function mapStatusBreakdown(
  statusBreakdown: unknown
): KPIMetrics['wipCount']['breakdown'] {
  if (!Array.isArray(statusBreakdown)) {
    return []
  }

  return statusBreakdown
    .filter(
      (
        statusRecord
      ): statusRecord is { status: string; count?: number | string | null } =>
        Boolean(statusRecord) &&
        typeof statusRecord === 'object' &&
        'status' in statusRecord &&
        typeof statusRecord.status === 'string'
    )
    .map((statusRecord) => ({
      status: statusRecord.status,
      count: toNumber(statusRecord.count),
    }))
}

export function normalizeRpcError(error: unknown, rpcName: string): Error {
  if (error instanceof Error) {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    const message =
      typeof error.message === 'string'
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

export function mapConsolidatedKpiMetrics(
  data: ConsolidatedKpiRpcRow | ConsolidatedKpiRpcRow[] | null | undefined
): KPIMetrics {
  const kpiRow = getFirstRecord(data)
  const statusBreakdown = mapStatusBreakdown(kpiRow?.status_breakdown)
  const sampleCount = toNumber(kpiRow?.sample_count)
  const onTimeCount = toNumber(kpiRow?.on_time_count)
  const pendingCount = toNumber(kpiRow?.pending_count)
  const avgWaitHours = toNumber(kpiRow?.avg_wait_hours)
  const onTimeRate = sampleCount > 0 ? (onTimeCount / sampleCount) * 100 : 0
  const wipCount = statusBreakdown
    .filter((statusRecord) =>
      ['received', 'assigned', 'in_progress', 'review'].includes(statusRecord.status)
    )
    .reduce((totalCount, statusRecord) => totalCount + statusRecord.count, 0)

  return {
    avgTAT: {
      value: toNumber(kpiRow?.avg_tat_hours),
      unit: 'hours',
      trend: 0,
      previousValue: 0,
    },
    wipCount: {
      value: wipCount,
      breakdown: statusBreakdown,
    },
    pendingApprovals: {
      count: pendingCount,
      avgWaitHours,
      overdueCount: toNumber(kpiRow?.overdue_count),
      isAlert: pendingCount > 20 || avgWaitHours > 24,
    },
    onTimeRate: {
      value: onTimeRate,
      trend: 0,
      color: onTimeRate >= 90 ? 'green' : onTimeRate >= 80 ? 'yellow' : 'red',
    },
    errorRate: {
      value: toNumber(kpiRow?.error_rate),
      totalModifications: toNumber(kpiRow?.total_modifications),
      totalResults: toNumber(kpiRow?.total_results),
      trend: 0,
    },
  }
}
