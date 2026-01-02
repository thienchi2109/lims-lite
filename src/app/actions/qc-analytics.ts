'use server'

import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import type { QCResultStatus } from '@/types/qc'

// ============================================================================
// TYPES
// ============================================================================

export interface QCResultForAnalytics {
    id: string
    value: number
    z_score: number | null
    status: QCResultStatus
    measured_at: string
    rule_violated: string | null
}

/** Minimal data point for mini L-J chart */
export interface MiniChartDataPoint {
    id: string
    value: number
    status: QCResultStatus
    measuredAt: string
}

export interface FetchOlderQCResultsResponse {
    data: QCResultForAnalytics[]
    hasMore: boolean
    nextCursor: string | null
}

// ============================================================================
// VALIDATION SCHEMA
// ============================================================================

const fetchOlderQCResultsSchema = z.object({
    definitionId: z.string().uuid(),
    cursor: z.string().datetime(), // oldest date from current data
    limit: z.number().min(1).max(100).default(50),
})

// ============================================================================
// SERVER ACTION
// ============================================================================

/**
 * Fetches older QC results using cursor-based pagination.
 * Used for "load more" functionality in the analytics tab.
 *
 * @param input - Contains definitionId, cursor (oldest date), and limit
 * @returns Paginated results with hasMore flag and next cursor
 */
export async function fetchOlderQCResults(
    input: z.infer<typeof fetchOlderQCResultsSchema>
): Promise<FetchOlderQCResultsResponse | { error: string }> {
    try {
        const validated = fetchOlderQCResultsSchema.parse(input)
        const supabase = await createClient()

        const { data, error } = await supabase
            .from('qc_results')
            .select('id, definition_id, value, z_score, status, measured_at, rule_violated')
            .eq('definition_id', validated.definitionId)
            .lt('measured_at', validated.cursor)
            .order('measured_at', { ascending: false })
            .limit(validated.limit)

        if (error) {
            console.error('Error fetching older QC results:', error)
            return { error: error.message }
        }

        const results: QCResultForAnalytics[] = (data || []).map((r) => ({
            id: r.id,
            value: r.value,
            z_score: r.z_score,
            status: r.status as QCResultStatus,
            measured_at: r.measured_at,
            rule_violated: r.rule_violated,
        }))

        // Determine if there are more results
        const hasMore = results.length === validated.limit
        const nextCursor = results.length > 0
            ? results[results.length - 1].measured_at
            : null

        return {
            data: results,
            hasMore,
            nextCursor,
        }
    } catch (error) {
        if (error instanceof z.ZodError) {
            return { error: 'Invalid input parameters' }
        }
        console.error('Error in fetchOlderQCResults:', error)
        return { error: 'An unexpected error occurred' }
    }
}
