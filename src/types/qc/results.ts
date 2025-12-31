import { z } from 'zod'
import { QCResultStatus, QCLevel, WestgardRule } from './enums'

// ============================================================================
// QC RESULTS - Individual QC measurements
// ============================================================================

export const QCResultSchema = z.object({
    id: z.string().uuid(),
    session_id: z.string().uuid(),
    definition_id: z.string().uuid(),
    value: z.number(), // NUMERIC(15,4)
    z_score: z.number().nullable().optional(), // Auto-calculated by trigger
    status: QCResultStatus,
    measured_at: z.string().datetime(),
    entered_by: z.string().uuid(),
    notes: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type QCResult = z.infer<typeof QCResultSchema>

export const CreateQCResultSchema = z.object({
    session_id: z.string().uuid('ID phiên QC không hợp lệ'),
    definition_id: z.string().uuid('ID định nghĩa QC không hợp lệ'),
    value: z.number(),
    measured_at: z.string().datetime().optional(), // Defaults to now()
    notes: z.string().max(500).optional(),
})

export type CreateQCResult = z.infer<typeof CreateQCResultSchema>

// Extended schema with definition and material details
export const QCResultWithDetailsSchema = QCResultSchema.extend({
    assay_name: z.string(),
    assay_units: z.string().nullable(),
    material_name: z.string(),
    material_level: QCLevel,
    mean: z.number(),
    sd: z.number(),
    entered_by_name: z.string(),
})

export type QCResultWithDetails = z.infer<typeof QCResultWithDetailsSchema>

// ============================================================================
// QC CHART DATA - For Levey-Jennings charts
// ============================================================================

export const QCChartDataPointSchema = z.object({
    id: z.string().uuid(),
    value: z.number(),
    z_score: z.number().nullable(),
    status: QCResultStatus,
    measured_at: z.string().datetime(),
    level: QCLevel,
    rule_violated: WestgardRule.nullable().optional(),
})

export type QCChartDataPoint = z.infer<typeof QCChartDataPointSchema>

export const QCChartDataSchema = z.object({
    definition_id: z.string().uuid(),
    assay_name: z.string(),
    material_name: z.string(),
    level: QCLevel,
    mean: z.number(),
    sd: z.number(),
    data_points: z.array(QCChartDataPointSchema),
})

export type QCChartData = z.infer<typeof QCChartDataSchema>

export const QCHistoryParamsSchema = z.object({
    definition_id: z.string().uuid(),
    days: z.number().int().min(1).max(365).default(30),
})

export type QCHistoryParams = z.infer<typeof QCHistoryParamsSchema>
