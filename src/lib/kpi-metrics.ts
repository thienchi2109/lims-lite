import type { KPIMetrics } from '@/types'
import { z } from 'zod'

export const KPI_RPC_NAME = 'get_kpi_metrics'

type RpcRecord = Record<string, unknown>

const NumericValueSchema = z.union([
  z.number(),
  z.string().refine((value) => value.trim().length > 0 && Number.isFinite(Number(value))),
])

const NullableNumericValueSchema = z.union([NumericValueSchema, z.null()])

const StatusBreakdownItemSchema = z.object({
  status: z.string(),
  count: NumericValueSchema,
})

const ConsolidatedKpiRpcRowSchema = z.object({
  avg_tat_hours: NullableNumericValueSchema,
  median_tat_hours: NullableNumericValueSchema,
  sample_count: NumericValueSchema,
  on_time_count: NumericValueSchema,
  status_breakdown: z.array(StatusBreakdownItemSchema),
  pending_count: NumericValueSchema,
  avg_wait_hours: NullableNumericValueSchema,
  overdue_count: NumericValueSchema,
  error_rate: NumericValueSchema,
  total_modifications: NumericValueSchema,
  total_results: NumericValueSchema,
})

type ConsolidatedKpiRpcRow = z.infer<typeof ConsolidatedKpiRpcRowSchema>

function getFirstRecord<T extends RpcRecord>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) {
    return data[0] ?? null
  }

  return data ?? null
}

function toNumber(value: unknown): number {
  const numericValue = Number(value ?? 0)
  if (!Number.isFinite(numericValue)) {
    throw new Error('Malformed KPI metrics payload')
  }

  return numericValue
}

function createEmptyKpiMetrics(): KPIMetrics {
  return {
    avgTAT: {
      value: 0,
      unit: 'hours',
      trend: 0,
      previousValue: 0,
    },
    wipCount: {
      value: 0,
      breakdown: [],
    },
    pendingApprovals: {
      count: 0,
      avgWaitHours: 0,
      overdueCount: 0,
      isAlert: false,
    },
    onTimeRate: {
      value: 0,
      trend: 0,
      color: 'red',
    },
    errorRate: {
      value: 0,
      totalModifications: 0,
      totalResults: 0,
      trend: 0,
    },
  }
}

function parseKpiRow(data: ConsolidatedKpiRpcRow | ConsolidatedKpiRpcRow[] | null | undefined) {
  const kpiRow = getFirstRecord(data)

  if (kpiRow === null) {
    return null
  }

  const parsedRow = ConsolidatedKpiRpcRowSchema.safeParse(kpiRow)

  if (!parsedRow.success) {
    throw new Error('Malformed KPI metrics payload')
  }

  return parsedRow.data
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
  const kpiRow = parseKpiRow(data)

  if (kpiRow === null) {
    return createEmptyKpiMetrics()
  }

  const statusBreakdown = kpiRow.status_breakdown.map((statusRecord) => ({
    status: statusRecord.status,
    count: toNumber(statusRecord.count),
  }))
  const sampleCount = toNumber(kpiRow.sample_count)
  const onTimeCount = toNumber(kpiRow.on_time_count)
  const pendingCount = toNumber(kpiRow.pending_count)
  const avgWaitHours = kpiRow.avg_wait_hours === null ? 0 : toNumber(kpiRow.avg_wait_hours)
  const onTimeRate = sampleCount > 0 ? (onTimeCount / sampleCount) * 100 : 0
  const wipCount = statusBreakdown
    .filter((statusRecord) =>
      ['received', 'assigned', 'in_progress', 'review'].includes(statusRecord.status)
    )
    .reduce((totalCount, statusRecord) => totalCount + statusRecord.count, 0)

  return {
    avgTAT: {
      value: kpiRow.avg_tat_hours === null ? 0 : toNumber(kpiRow.avg_tat_hours),
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
      overdueCount: toNumber(kpiRow.overdue_count),
      isAlert: pendingCount > 20 || avgWaitHours > 24,
    },
    onTimeRate: {
      value: onTimeRate,
      trend: 0,
      color: onTimeRate >= 90 ? 'green' : onTimeRate >= 80 ? 'yellow' : 'red',
    },
    errorRate: {
      value: toNumber(kpiRow.error_rate),
      totalModifications: toNumber(kpiRow.total_modifications),
      totalResults: toNumber(kpiRow.total_results),
      trend: 0,
    },
  }
}
