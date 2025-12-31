import { z } from 'zod'
import { QCSessionMode, QCStatus } from './enums'

// ============================================================================
// QC SESSIONS - Session-based QC linking to patient results
// ============================================================================

export const QCSessionSchema = z.object({
    id: z.string().uuid(),
    assay_id: z.string().uuid(),
    session_mode: QCSessionMode,
    qc_status: QCStatus,
    started_at: z.string().datetime(),
    started_by: z.string().uuid(),
    ended_at: z.string().datetime().nullable().optional(),
    ended_by: z.string().uuid().nullable().optional(),
    notes: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type QCSession = z.infer<typeof QCSessionSchema>

export const CreateQCSessionSchema = z.object({
    assay_id: z.string().uuid('ID xét nghiệm không hợp lệ'),
    session_mode: QCSessionMode,
    notes: z.string().max(500).optional(),
})

export type CreateQCSession = z.infer<typeof CreateQCSessionSchema>

export const EndQCSessionSchema = z.object({
    session_id: z.string().uuid(),
    notes: z.string().max(500).optional(),
})

export type EndQCSession = z.infer<typeof EndQCSessionSchema>

// Extended schema with assay details and summary stats
export const QCSessionWithDetailsSchema = QCSessionSchema.extend({
    assay_name: z.string(),
    started_by_name: z.string(),
    ended_by_name: z.string().nullable().optional(),
    results_count: z.number().int(),
    violations_count: z.number().int(),
})

export type QCSessionWithDetails = z.infer<typeof QCSessionWithDetailsSchema>

// ============================================================================
// QC SESSION QUERY PARAMETERS
// ============================================================================

export const QCSessionListParamsSchema = z.object({
    assay_id: z.string().uuid().optional(),
    status: QCStatus.optional(),
    from_date: z.string().optional(),
    to_date: z.string().optional(),
    page: z.number().int().positive().default(1),
    page_size: z.number().int().positive().max(100).default(20),
})

export type QCSessionListParams = z.infer<typeof QCSessionListParamsSchema>
