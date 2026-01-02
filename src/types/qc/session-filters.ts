import { z } from 'zod'
import { QCSessionMode, QCStatus } from './enums'

// ============================================================================
// QC SESSION FILTERS - For paginated listing
// ============================================================================

export const QCSessionFiltersSchema = z.object({
    status: QCStatus.optional(),
    session_mode: QCSessionMode.optional(),
    assay_id: z.string().uuid().optional(),
    specialty_id: z.string().uuid().optional(),
    active_only: z.boolean().optional(),
    search: z.string().optional(),
    page: z.number().int().positive().default(1),
    page_size: z.number().int().positive().max(100).default(20),
})

export type QCSessionFilters = z.infer<typeof QCSessionFiltersSchema>

export interface QCSessionRow {
    id: string
    assay_id: string
    session_mode: string
    qc_status: string
    started_at: string
    ended_at: string | null
    notes: string | null
    assay_name: string
    assay_units: string | null
    specialty_id: string | null
    specialty_name: string | null
    started_by_name: string | null
    ended_by_name: string | null
    results_count: number
    violations_count: number
}

export interface QCSessionsResult {
    data: QCSessionRow[]
    total: number
    page: number
    page_size: number
    total_pages: number
}
