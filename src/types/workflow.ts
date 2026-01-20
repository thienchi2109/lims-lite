import { z } from 'zod'
import { Gender } from './core'
import { SampleDataSchema } from './lab'

// ============================================================================
// APPROVAL ACTIONS
// ============================================================================

export const ApproveResultsSchema = z.object({
    sampleId: z.string().uuid(),
    resultIds: z.array(z.string().uuid()).min(1, 'At least one result must be selected'),
    note: z.string().max(500).optional(),
})

export type ApproveResults = z.infer<typeof ApproveResultsSchema>

export const CancelApprovalSchema = z.object({
    sampleId: z.string().uuid(),
    resultIds: z.array(z.string().uuid()).min(1, 'At least one result must be selected'),
    reason: z.string().min(3, 'Reason is required (min 3 characters)').max(500),
})

export type CancelApproval = z.infer<typeof CancelApprovalSchema>

export const RejectSampleSchema = z.object({
    sampleId: z.string().uuid(),
    reason: z.string().min(1, 'Lý do từ chối là bắt buộc'),
})

export type RejectSample = z.infer<typeof RejectSampleSchema>

export const DiscardSampleSchema = z.object({
    sampleId: z.string().uuid(),
    reason: z.string().min(1, 'Lý do loại bỏ là bắt buộc'),
})

export type DiscardSample = z.infer<typeof DiscardSampleSchema>

// ============================================================================
// USER SIGNATURE SCHEMAS
// ============================================================================

export const UserSignatureSchema = z.object({
    id: z.string().uuid(),
    user_id: z.string().uuid(),
    signature_path: z.string(),
    signature_hash: z.string(),
    file_size: z.number().int(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
    uploaded_at: z.string().datetime(),
    is_active: z.boolean(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type UserSignature = z.infer<typeof UserSignatureSchema>

export const SIGNATURE_VALIDATION = {
    maxFileSize: 500 * 1024,
    allowedMimeTypes: ['image/png', 'image/jpeg'] as const,
    minWidth: 200,
    minHeight: 80,
    maxWidth: 800,
    maxHeight: 400,
} as const

export const SignatureFileValidationSchema = z.object({
    size: z.number()
        .max(SIGNATURE_VALIDATION.maxFileSize, 'Kích thước file tối đa 500KB'),
    type: z.enum(['image/png', 'image/jpeg'], {
        message: 'Chỉ chấp nhận file PNG hoặc JPEG'
    }),
})

export type SignatureFileValidation = z.infer<typeof SignatureFileValidationSchema>

/**
 * Schema for client-side signature upload validation.
 *
 * NOTE: Uses browser-only `File` type intentionally. This schema is designed
 * exclusively for client-side form validation in React components. Do not use
 * in Server Actions or API routes where `File` is not available.
 *
 * For server-side file metadata validation, use `SignatureFileValidationSchema` instead.
 */
export const UploadSignatureSchema = z.object({
    file: z.instanceof(File)
        .refine(f => f.size <= SIGNATURE_VALIDATION.maxFileSize, 'Kích thước file tối đa 500KB')
        .refine(f => SIGNATURE_VALIDATION.allowedMimeTypes.includes(f.type as any), 'Chỉ chấp nhận file PNG hoặc JPEG'),
    width: z.number()
        .min(SIGNATURE_VALIDATION.minWidth, `Chiều rộng tối thiểu ${SIGNATURE_VALIDATION.minWidth}px`)
        .max(SIGNATURE_VALIDATION.maxWidth, `Chiều rộng tối đa ${SIGNATURE_VALIDATION.maxWidth}px`),
    height: z.number()
        .min(SIGNATURE_VALIDATION.minHeight, `Chiều cao tối thiểu ${SIGNATURE_VALIDATION.minHeight}px`)
        .max(SIGNATURE_VALIDATION.maxHeight, `Chiều cao tối đa ${SIGNATURE_VALIDATION.maxHeight}px`),
})

export type UploadSignature = z.infer<typeof UploadSignatureSchema>

export const ActiveSignatureSchema = z.object({
    id: z.string().uuid(),
    signature_path: z.string(),
    signature_hash: z.string(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
    uploaded_at: z.coerce.date(),
})

export type ActiveSignature = z.infer<typeof ActiveSignatureSchema>

export const SignatureHistoryItemSchema = z.object({
    id: z.string().uuid(),
    uploaded_at: z.coerce.date(),
    is_active: z.boolean(),
    file_size: z.number().int(),
    mime_type: z.enum(['image/png', 'image/jpeg']),
})

export type SignatureHistoryItem = z.infer<typeof SignatureHistoryItemSchema>

// ============================================================================
// SAMPLE SUBMISSION SCHEMAS
// ============================================================================

/**
 * Sample submission record for analyst e-signature tracking
 * 21 CFR Part 11 compliant audit trail
 */
export const SampleSubmissionSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    user_id: z.string().uuid(),
    signature_id: z.string().uuid(),
    submitted_at: z.string().datetime(),
    submission_number: z.number().int().positive(),
    superseded_by: z.string().uuid().nullable().optional(),
    signature_meaning: z.string(),
    created_at: z.string().datetime(),
})

export type SampleSubmission = z.infer<typeof SampleSubmissionSchema>

/**
 * Latest submission with performer (analyst) details
 * Used for CoA generation - includes joined data from users and user_signatures
 */
export const LatestSubmissionSchema = z.object({
    submissionId: z.string().uuid(),
    performerId: z.string().uuid(),
    performerName: z.string().nullable(),
    signatureId: z.string().uuid(),
    signatureHash: z.string(),
    submittedAt: z.string(),
    submissionNumber: z.number().int().positive(),
    signatureMeaning: z.string(),
})

export type LatestSubmission = z.infer<typeof LatestSubmissionSchema>

// ============================================================================
// COA AUTHENTICATION SCHEMAS
// ============================================================================

export const CoAAuthRequestSchema = z.object({
    phone: z.string()
        .min(10, 'Số điện thoại không hợp lệ')
        .max(15, 'Số điện thoại không hợp lệ'),
})

export type CoAAuthRequest = z.infer<typeof CoAAuthRequestSchema>

export const CoASampleInfoSchema = z.object({
    id: z.string().uuid(),
    sample_id_display: z.string(),
    sample_type: z.string().nullable(),
    received_date: z.string().nullable(),
    approved_at: z.string().nullable(),
    has_coa: z.boolean(),
})

export type CoASampleInfo = z.infer<typeof CoASampleInfoSchema>

export const CoAAuthResponseSchema = z.object({
    success: z.boolean(),
    client_id: z.string().uuid().optional(),
    client_name: z.string().optional(),
    samples: z.array(CoASampleInfoSchema).optional(),
    token: z.string().optional(),
    error: z.string().optional(),
})

export type CoAAuthResponse = z.infer<typeof CoAAuthResponseSchema>

export const CoADownloadTokenSchema = z.object({
    client_id: z.string().uuid(),
    sample_id: z.string().uuid().optional(),
    exp: z.number(),
})

export type CoADownloadToken = z.infer<typeof CoADownloadTokenSchema>

export const CoADownloadRequestSchema = z.object({
    sample_id: z.string().uuid(),
    token: z.string(),
})

export type CoADownloadRequest = z.infer<typeof CoADownloadRequestSchema>

// ============================================================================
// COA MANAGEMENT SCHEMAS
// ============================================================================

export const CoAReportStatusSchema = z.enum(['pending', 'ready', 'failed'])
export type CoAReportStatus = z.infer<typeof CoAReportStatusSchema>

export const CoAReportSchema = z.object({
    id: z.string().uuid(),
    sample_id: z.string().uuid(),
    file_path: z.string(),
    file_hash: z.string(),
    version: z.number().int().default(1),
    status: CoAReportStatusSchema,
    superseded_by: z.string().uuid().nullable().optional(),
    error_message: z.string().nullable().optional(),
    signature_id: z.string().uuid().nullable().optional(),
    generated_at: z.string().datetime(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type CoAReport = z.infer<typeof CoAReportSchema>

export const CoAAccessLogSchema = z.object({
    id: z.string().uuid(),
    client_id: z.string().uuid().nullable().optional(),
    sample_id: z.string().uuid().nullable().optional(),
    coa_report_id: z.string().uuid().nullable().optional(),
    accessed_at: z.string().datetime(),
    ip_address: z.string().nullable().optional(),
    user_agent: z.string().nullable().optional(),
    success: z.boolean(),
    failure_reason: z.string().nullable().optional(),
    created_at: z.string().datetime(),
    updated_at: z.string().datetime(),
    deleted_at: z.string().datetime().nullable().optional(),
})

export type CoAAccessLog = z.infer<typeof CoAAccessLogSchema>

export const CoAAccessLogWithClientSchema = CoAAccessLogSchema.extend({
    client_name: z.string(),
    sample_id_display: z.string(),
})

export type CoAAccessLogWithClient = z.infer<typeof CoAAccessLogWithClientSchema>

// ============================================================================
// COA MANUAL INPUTS
// ============================================================================

export const CoAManualInputsSchema = z.object({
    referrer: z.string()
        .min(1, 'Bác sĩ chỉ định là bắt buộc')
        .max(200, 'Tên bác sĩ chỉ định tối đa 200 ký tự'),
    sampleQuality: z.enum(['Tốt', 'Đạt', 'Không đạt'], {
        message: 'Chất lượng mẫu không hợp lệ'
    }),
})

export type CoAManualInputs = z.infer<typeof CoAManualInputsSchema>

export const CoADataSchema = z.object({
    sample: SampleDataSchema,
    results: z.array(z.object({
        assay_name: z.string(),
        value: z.string().nullable(),
        unit: z.string().nullable(),
        normal_range: z.string().nullable(),
        method_name: z.string().nullable(),
        lab_specialty_name: z.string().nullable(),
    })),
    approverName: z.string(),
    approverSignature: z.string().nullable(),
    signatureId: z.string().uuid().nullable(),
    approvalDate: z.string(),
    testingDate: z.string().nullable().optional(),
    manualInputs: CoAManualInputsSchema.optional(),
    performerName: z.string().nullable().optional(),
    performerSignature: z.string().nullable().optional(),
    performerSignatureId: z.string().uuid().nullable().optional(),
    performerSignatureMeaning: z.string().nullable().optional(),
})

export type CoAData = z.infer<typeof CoADataSchema>
