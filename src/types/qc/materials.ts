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
