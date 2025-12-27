import { z } from 'zod'
import { SampleStatus, ResultStatus } from './core'

// ============================================================================
// SEARCH SCHEMAS
// ============================================================================

export const SearchQuerySchema = z.object({
    query: z.string()
        .trim()
        .min(2, 'Từ khóa tìm kiếm phải có ít nhất 2 ký tự')
        .max(200, 'Từ khóa tìm kiếm tối đa 200 ký tự'),
    maxResults: z.number().int().min(1).max(100).optional().default(20),
})

export type SearchQuery = z.infer<typeof SearchQuerySchema>

export const SearchSampleResultSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string(),
    client_name: z.string(),
    type: z.string(),
    status: SampleStatus,
    received_at: z.string().datetime(),
    rank: z.number(),
})

export type SearchSampleResult = z.infer<typeof SearchSampleResultSchema>

export const SearchClientResultSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    phone: z.string(),
    address: z.string().nullable(),
    rank: z.number(),
})

export type SearchClientResult = z.infer<typeof SearchClientResultSchema>

export const SearchAssayResultSchema = z.object({
    id: z.string().uuid(),
    name: z.string(),
    units: z.string().nullable(),
    rank: z.number(),
})

export type SearchAssayResult = z.infer<typeof SearchAssayResultSchema>

export const SearchResultResultSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    assay_id: z.string().uuid(),
    value: z.string().nullable(),
    status: ResultStatus,
    rank: z.number(),
})

export type SearchResultResult = z.infer<typeof SearchResultResultSchema>

export const SearchAuditLogResultSchema = z.object({
    id: z.string().uuid(),
    operation: z.string(),
    table_name: z.string(),
    changed_at: z.string().datetime(),
    rank: z.number(),
})

export type SearchAuditLogResult = z.infer<typeof SearchAuditLogResultSchema>

export const GlobalSearchResultSchema = z.object({
    entity_type: z.enum(['sample', 'client', 'assay', 'result']),
    entity_id: z.string().uuid(),
    description: z.string(),
    rank: z.number(),
})

export type GlobalSearchResult = z.infer<typeof GlobalSearchResultSchema>

// ============================================================================
// REPORTS DASHBOARD SCHEMAS
// ============================================================================

export const DateRangeSchema = z.object({
    start: z.string().datetime(),
    end: z.string().datetime(),
})

export type DateRange = z.infer<typeof DateRangeSchema>

export const KPIMetricsSchema = z.object({
    avgTAT: z.object({
        value: z.number(),
        unit: z.enum(['hours', 'days']),
        trend: z.number(),
        previousValue: z.number(),
    }),
    wipCount: z.object({
        value: z.number(),
        breakdown: z.array(z.object({
            status: z.string(),
            count: z.number(),
        })),
    }),
    pendingApprovals: z.object({
        count: z.number(),
        avgWaitHours: z.number(),
        overdueCount: z.number(),
        isAlert: z.boolean(),
    }),
    onTimeRate: z.object({
        value: z.number(),
        trend: z.number(),
        color: z.enum(['green', 'yellow', 'red']),
    }),
    errorRate: z.object({
        value: z.number(),
        totalModifications: z.number(),
        totalResults: z.number(),
        trend: z.number(),
    }),
})

export type KPIMetrics = z.infer<typeof KPIMetricsSchema>

export const TATTrendDataSchema = z.object({
    date: z.string(),
    avgTATHours: z.number(),
    sampleCount: z.number(),
})

export type TATTrendData = z.infer<typeof TATTrendDataSchema>

export const SampleAccessionTrendDataSchema = z.object({
    period: z.string(),
    sampleCount: z.number(),
    cumulativeCount: z.number(),
})

export type SampleAccessionTrendData = z.infer<typeof SampleAccessionTrendDataSchema>

export const SampleStatusDataSchema = z.object({
    status: z.string(),
    count: z.number(),
})

export type SampleStatusData = z.infer<typeof SampleStatusDataSchema>

export const CoAStatisticsSchema = z.object({
    segment: z.string(),
    count: z.number(),
    percentage: z.number(),
})

export type CoAStatistics = z.infer<typeof CoAStatisticsSchema>

export const StaffProductivityDataSchema = z.object({
    analystId: z.string().uuid(),
    analystName: z.string(),
    testsCompleted: z.number(),
    resultsModified: z.number(),
})

export type StaffProductivityData = z.infer<typeof StaffProductivityDataSchema>

export const RecentSampleSchema = z.object({
    id: z.string().uuid(),
    sampleId: z.string(),
    clientName: z.string(),
    receivedAt: z.string().datetime(),
    completedAt: z.string().datetime().nullable(),
    status: SampleStatus,
    tatHours: z.number().nullable(),
})

export type RecentSample = z.infer<typeof RecentSampleSchema>

export const SpecialtySampleDataSchema = z.object({
    specialtyCode: z.string(),
    specialtyName: z.string(),
    status: SampleStatus,
    sampleCount: z.number(),
    testCount: z.number(),
})

export type SpecialtySampleData = z.infer<typeof SpecialtySampleDataSchema>
