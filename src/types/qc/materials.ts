import { z } from 'zod'
import { QCLevel } from './enums'

// ============================================================================
// QC MATERIALS - Control materials (Bio-Rad, manufacturer controls)
// ============================================================================

export const QCMaterialSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200),
    manufacturer: z.string().min(1).max(200),
    lot_number: z.string().min(1).max(100),
    expiry_date: z.string(), // DATE type
    level: QCLevel,
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type QCMaterial = z.infer<typeof QCMaterialSchema>

export const CreateQCMaterialSchema = z.object({
    name: z.string().min(1, 'Tên vật liệu QC là bắt buộc').max(200),
    manufacturer: z.string().min(1, 'Nhà sản xuất là bắt buộc').max(200),
    lot_number: z.string().min(1, 'Số lô là bắt buộc').max(100),
    expiry_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày hết hạn không hợp lệ'
    }),
    level: QCLevel,
})

export type CreateQCMaterial = z.infer<typeof CreateQCMaterialSchema>

export const UpdateQCMaterialSchema = z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(200).optional(),
    manufacturer: z.string().min(1).max(200).optional(),
    lot_number: z.string().min(1).max(100).optional(),
    expiry_date: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày hết hạn không hợp lệ'
    }).optional(),
    level: QCLevel.optional(),
})

export type UpdateQCMaterial = z.infer<typeof UpdateQCMaterialSchema>

// ============================================================================
// LOT CHANGEOVER - Transfer control limits to new lot
// ============================================================================

export const CompleteLotChangeoverSchema = z.object({
    /** Current material ID being replaced */
    old_material_id: z.string().uuid('ID vật liệu cũ không hợp lệ'),
    /** New material to transfer limits to */
    new_material: CreateQCMaterialSchema,
    /** New mean calculated from crossover data */
    new_mean: z.number().positive('Mean mới phải lớn hơn 0'),
    /** CV% transferred from old lot (SD calculated from CV * new_mean) */
    transfer_cv_percent: z.number().positive('CV% phải lớn hơn 0'),
    /** Number of crossover data points collected */
    crossover_data_points: z.number().int().min(10, 'Cần ít nhất 10 điểm dữ liệu chéo'),
    /** Optional notes about the changeover */
    notes: z.string().max(2000).optional(),
})

export type CompleteLotChangeover = z.infer<typeof CompleteLotChangeoverSchema>
