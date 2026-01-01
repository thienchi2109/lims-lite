import { z } from 'zod'
import { QCLevel } from '@/types/qc'

// ============================================================================
// TYPES & CONSTANTS
// ============================================================================

export const MINIMUM_CROSSOVER_POINTS = 10

export interface CrossoverDataPoint {
    id: string
    oldLotValue: number
    newLotValue: number
    date: string
}

export interface CurrentMaterial {
    id: string
    name: string
    manufacturer: string
    lot_number: string
    level: string
    expiry_date: string
}

export interface CurrentDefinition {
    id: string
    mean: number
    sd: number
    cv_percent: number | null
    assay: { id: string; name: string; units: string | null } | null
}

export interface LotChangeoverDialogProps {
    currentMaterial: CurrentMaterial
    definitions: CurrentDefinition[]
    onSuccess?: () => void
    trigger?: React.ReactNode
}

// ============================================================================
// SCHEMA
// ============================================================================

export const NewLotFormSchema = z.object({
    name: z.string().min(1, 'Tên vật liệu là bắt buộc'),
    manufacturer: z.string().min(1, 'Nhà sản xuất là bắt buộc'),
    lot_number: z.string().min(1, 'Số lô mới là bắt buộc'),
    expiry_date: z.string().min(1, 'Ngày hết hạn là bắt buộc'),
    level: QCLevel,
    notes: z.string().max(2000).optional(),
})

export type NewLotForm = z.infer<typeof NewLotFormSchema>

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

export interface CrossoverStats {
    mean: number
    sd: number
    cv: number
}

export function calculateStats(values: number[]): CrossoverStats | null {
    if (values.length < 2) return null
    const n = values.length
    const mean = values.reduce((a, b) => a + b, 0) / n
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1)
    const sd = Math.sqrt(variance)
    const cv = (sd / mean) * 100
    return {
        mean: Math.round(mean * 10000) / 10000,
        sd: Math.round(sd * 10000) / 10000,
        cv: Math.round(cv * 100) / 100,
    }
}
