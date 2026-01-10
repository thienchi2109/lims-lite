import { z } from 'zod'
import { QCLevel } from './enums'

// ============================================================================
// QC DEFINITIONS - Control limits for assay+material combinations
// ============================================================================

export const QCDefinitionSchema = z.object({
    id: z.string().uuid(),
    assay_id: z.string().uuid(),
    material_id: z.string().uuid(),
    mean: z.number(), // NUMERIC(15,4)
    sd: z.number().positive(), // Must be positive for Z-score calculation
    cv_percent: z.number().nullable().optional(), // Coefficient of variation
    target_sigma: z.number().nullable().optional(), // Six Sigma target
    active_from: z.string(), // DATE when limits became active
    active_until: z.string().nullable().optional(), // DATE when limits expired
    is_active: z.boolean(),
    established_by: z.string().uuid().nullable().optional(),
    established_at: z.string().datetime().nullable().optional(),
    data_points_count: z.number().int().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type QCDefinition = z.infer<typeof QCDefinitionSchema>

export const CreateQCDefinitionSchema = z.object({
    assay_id: z.string().uuid('ID xét nghiệm không hợp lệ'),
    material_id: z.string().uuid('ID vật liệu QC không hợp lệ'),
    mean: z.number(),
    sd: z.number().positive('Độ lệch chuẩn phải lớn hơn 0'),
    cv_percent: z.number().optional(),
    target_sigma: z.number().optional(),
    active_from: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày bắt đầu không hợp lệ'
    }),
    data_points_count: z.number().int().min(20, 'Cần ít nhất 20 điểm dữ liệu').optional(),
})

export type CreateQCDefinition = z.infer<typeof CreateQCDefinitionSchema>

export const UpdateQCDefinitionSchema = z.object({
    id: z.string().uuid(),
    mean: z.number().optional(),
    sd: z.number().positive('Độ lệch chuẩn phải lớn hơn 0').optional(),
    cv_percent: z.number().optional(),
    target_sigma: z.number().optional(),
    active_until: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày kết thúc không hợp lệ'
    }).optional(),
    is_active: z.boolean().optional(),
})

export type UpdateQCDefinition = z.infer<typeof UpdateQCDefinitionSchema>

// Extended schema with assay and material details (for UI display)
export const QCDefinitionWithDetailsSchema = QCDefinitionSchema.extend({
    assay_name: z.string(),
    assay_units: z.string().nullable(),
    material_name: z.string(),
    material_lot: z.string(),
    material_level: QCLevel,
})

export type QCDefinitionWithDetails = z.infer<typeof QCDefinitionWithDetailsSchema>

// ============================================================================
// PAGINATION TYPES
// ============================================================================

export interface QCDefinitionsFilters {
    page?: number           // Default: 1
    page_size?: number      // Default: 20
    status?: 'active' | 'inactive' | null  // Filter by is_active
}

export interface QCDefinitionsResult {
    data: QCDefinitionWithDetails[]
    total: number
    page: number
    page_size: number
    total_pages: number
}
