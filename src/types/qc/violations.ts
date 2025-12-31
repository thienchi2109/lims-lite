import { z } from 'zod'
import { WestgardRule, QCSessionMode, QCLevel, QCStatus } from './enums'

// ============================================================================
// QC VIOLATIONS - Rule violations requiring corrective action
// ============================================================================

export const QCViolationSchema = z.object({
    id: z.string().uuid(),
    result_id: z.string().uuid(),
    session_id: z.string().uuid(),
    rule_violated: WestgardRule,
    z_score_at_violation: z.number(),
    corrective_action: z.string().nullable().optional(),
    resolved_at: z.string().datetime().nullable().optional(),
    resolved_by: z.string().uuid().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type QCViolation = z.infer<typeof QCViolationSchema>

export const ResolveViolationSchema = z.object({
    violation_id: z.string().uuid(),
    corrective_action: z.string()
        .min(10, 'Hành động khắc phục phải có ít nhất 10 ký tự')
        .max(2000, 'Hành động khắc phục tối đa 2000 ký tự'),
})

export type ResolveViolation = z.infer<typeof ResolveViolationSchema>

// Extended schema with result and session details
export const QCViolationWithDetailsSchema = QCViolationSchema.extend({
    assay_name: z.string(),
    material_name: z.string(),
    material_level: QCLevel,
    value: z.number(),
    mean: z.number(),
    sd: z.number(),
    session_mode: QCSessionMode,
    resolved_by_name: z.string().nullable().optional(),
})

export type QCViolationWithDetails = z.infer<typeof QCViolationWithDetailsSchema>

// ============================================================================
// QC TEA STANDARDS - Total Allowable Error for Six Sigma
// ============================================================================

export const QCTEAStandardSchema = z.object({
    id: z.string().uuid(),
    assay_id: z.string().uuid(),
    tea_percent: z.number().positive(),
    source: z.string().nullable().optional(), // e.g., "CLIA", "RCPA", "Ricos"
    effective_from: z.string(), // DATE
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
})

export type QCTEAStandard = z.infer<typeof QCTEAStandardSchema>

export const CreateQCTEAStandardSchema = z.object({
    assay_id: z.string().uuid('ID xét nghiệm không hợp lệ'),
    tea_percent: z.number().positive('TEa% phải lớn hơn 0'),
    source: z.string().max(100).optional(),
    effective_from: z.string().refine((val) => !isNaN(Date.parse(val)), {
        message: 'Ngày hiệu lực không hợp lệ'
    }),
})

export type CreateQCTEAStandard = z.infer<typeof CreateQCTEAStandardSchema>

// ============================================================================
// QC APPROVAL CHECK - For blocking patient result approval
// ============================================================================

export const QCApprovalCheckResultSchema = z.object({
    can_approve: z.boolean(),
    session_id: z.string().uuid().nullable(),
    session_status: QCStatus.nullable(),
    blocked_reason: z.string().nullable(),
    unresolved_violations: z.number().int(),
})

export type QCApprovalCheckResult = z.infer<typeof QCApprovalCheckResultSchema>
