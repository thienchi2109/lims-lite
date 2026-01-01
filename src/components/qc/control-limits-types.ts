import { z } from 'zod'

// ============================================================================
// TYPES
// ============================================================================

export interface AssayOption {
    id: string
    name: string
    units?: string
}

export interface MaterialOption {
    id: string
    name: string
    lot_number: string
    level: string
}

export interface DataPoint {
    id: string
    value: number
    date: string
}

export interface ControlLimitsStats {
    count: number
    mean: number
    sd: number
    cv: number
    min: number
    max: number
}

// ============================================================================
// SCHEMAS
// ============================================================================

export const Step1Schema = z.object({
    assay_id: z.string().uuid('Chọn xét nghiệm'),
    material_id: z.string().uuid('Chọn vật liệu QC'),
})

export const DataPointSchema = z.object({
    value: z.number().positive('Giá trị phải lớn hơn 0'),
    date: z.string().min(1, 'Ngày là bắt buộc'),
})

// ============================================================================
// STATISTICS CALCULATION
// ============================================================================

export function calculateStatistics(values: number[]): ControlLimitsStats | null {
    if (values.length === 0) return null

    const n = values.length
    const mean = values.reduce((a, b) => a + b, 0) / n
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / (n - 1)
    const sd = Math.sqrt(variance)
    const cv = (sd / mean) * 100

    return {
        count: n,
        mean: Math.round(mean * 10000) / 10000,
        sd: Math.round(sd * 10000) / 10000,
        cv: Math.round(cv * 100) / 100,
        min: Math.min(...values),
        max: Math.max(...values),
    }
}

// ============================================================================
// CONSTANTS
// ============================================================================

export const MINIMUM_DATA_POINTS = 20
