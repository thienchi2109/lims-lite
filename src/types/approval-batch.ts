/**
 * Typed approval contracts introduced by Phase P0.
 *
 * Current path: approval-dialog -> approveResultsClient -> client-action
 * OTP guard -> approveResults. Database audit triggers and
 * sample-submission/CoA provenance RPCs remain unchanged.
 *
 * Later queue UI phases must extend the existing approvalKeys.list hierarchy
 * and cache-first useApprovalQueue contract with pagination parameters instead
 * of creating a parallel queue cache. These schemas are not wired yet.
 */

import { z } from 'zod'

export const APPROVAL_BATCH_MAX_SAMPLES = 200

const UuidSchema = z.string().uuid().transform((value) => value.toLowerCase())
const TimestampSchema = z.string().datetime({ offset: true })
const ApprovalNoteSchema = z.string().max(500).optional()

function uniqueUuidArray(minimum: number, maximum?: number) {
    let schema = z.array(UuidSchema).min(minimum)
    if (maximum !== undefined) {
        schema = schema.max(maximum)
    }

    return schema.superRefine((values, context) => {
        if (new Set(values).size !== values.length) {
            context.addIssue({
                code: 'custom',
                message: 'Danh sách không được chứa mã trùng lặp',
            })
        }
    })
}

export const SingleApprovalRequestSchema = z.object({
    sampleId: UuidSchema,
    resultIds: uniqueUuidArray(1),
    note: ApprovalNoteSchema,
}).strict()

export const SingleApprovalSuccessSchema = z.object({
    success: z.literal(true),
    approvedCount: z.number().int().positive(),
}).strict()

export const ApprovalSelectionModeSchema = z.enum([
    'selected',
    'all_pending',
])

export const ApprovalBatchSubmissionRequestSchema = z.object({
    requestKey: UuidSchema,
    selectionMode: ApprovalSelectionModeSchema,
    sampleIds: uniqueUuidArray(2, APPROVAL_BATCH_MAX_SAMPLES),
    note: ApprovalNoteSchema,
}).strict()

export const ApprovalBatchSubmissionResponseSchema = z.object({
    batchId: UuidSchema,
}).strict()

export const ApprovalSelectAllResponseSchema = z.object({
    sampleIds: uniqueUuidArray(0),
    count: z.number().int().nonnegative(),
}).strict().superRefine((value, context) => {
    if (value.count !== value.sampleIds.length) {
        context.addIssue({
            code: 'custom',
            path: ['count'],
            message: 'Số lượng mẫu không khớp với ảnh chụp lựa chọn',
        })
    }
})

export const ApprovalBatchStatusSchema = z.enum([
    'queued',
    'processing',
    'completed',
    'completed_with_failures',
])

export const ApprovalBatchItemStatusSchema = z.enum([
    'queued',
    'processing',
    'retry_wait',
    'succeeded',
    'failed',
])

export const ApprovalErrorCodeSchema = z.enum([
    'NOT_AUTHENTICATED',
    'MANAGER_REQUIRED',
    'OTP_STEP_UP_REQUIRED',
    'CONFIDENTIAL_ACCESS_REQUIRED',
    'SAMPLE_NOT_REVIEW',
    'RESULT_NOT_FOUND',
    'RESULT_NOT_ENTERED',
    'RESULT_SAMPLE_MISMATCH',
    'QC_BLOCKED',
    'QC_RESPONSE_INVALID',
    'REQUEST_CONFLICT',
    'BATCH_NOT_FOUND',
    'BATCH_DISABLED',
    'DATABASE_UNAVAILABLE',
    'INTERNAL_ERROR',
])

export type ApprovalErrorCode = z.infer<typeof ApprovalErrorCodeSchema>

const ApprovalErrorParamsSchema = z.object({
    blockedCount: z.number().int().positive().optional(),
    retryAfterSeconds: z.number().int().nonnegative().optional(),
}).strict()

export const ApprovalErrorSchema = z.object({
    code: ApprovalErrorCodeSchema,
    params: ApprovalErrorParamsSchema.optional(),
}).strict()

export type ApprovalError = z.infer<typeof ApprovalErrorSchema>

export const SingleApprovalFailureSchema = z.object({
    success: z.literal(false),
    error: ApprovalErrorSchema,
}).strict()

export const SingleApprovalResponseSchema = z.discriminatedUnion('success', [
    SingleApprovalSuccessSchema,
    SingleApprovalFailureSchema,
])

export const APPROVAL_ERROR_MESSAGES_VI = {
    NOT_AUTHENTICATED: 'Phiên đăng nhập không hợp lệ.',
    MANAGER_REQUIRED: 'Chỉ quản lý mới được phê duyệt kết quả.',
    OTP_STEP_UP_REQUIRED: 'Vui lòng xác thực OTP quản lý trước khi phê duyệt.',
    CONFIDENTIAL_ACCESS_REQUIRED: 'Không có quyền phê duyệt kết quả bảo mật.',
    SAMPLE_NOT_REVIEW: 'Chỉ có thể phê duyệt mẫu đang chờ duyệt.',
    RESULT_NOT_FOUND: 'Không thể phê duyệt một hoặc nhiều kết quả đã chọn.',
    RESULT_NOT_ENTERED: 'Chỉ có thể phê duyệt kết quả đang chờ duyệt.',
    RESULT_SAMPLE_MISMATCH: 'Một hoặc nhiều kết quả không thuộc mẫu cần phê duyệt.',
    QC_BLOCKED: 'Không thể phê duyệt vì kết quả bị chặn bởi QC.',
    QC_RESPONSE_INVALID: 'Không thể xác minh trạng thái QC để phê duyệt.',
    REQUEST_CONFLICT: 'Yêu cầu phê duyệt trùng mã nhưng khác nội dung.',
    BATCH_NOT_FOUND: 'Không tìm thấy đợt phê duyệt.',
    BATCH_DISABLED: 'Chức năng phê duyệt hàng loạt đang tạm khóa.',
    DATABASE_UNAVAILABLE: 'Không thể kết nối cơ sở dữ liệu để phê duyệt.',
    INTERNAL_ERROR: 'Không thể hoàn tất phê duyệt. Vui lòng thử lại.',
} satisfies Record<ApprovalErrorCode, string>

export function getApprovalErrorMessageVi(error: ApprovalError) {
    if (error.code === 'QC_BLOCKED' && error.params?.blockedCount) {
        return `Không thể phê duyệt vì ${error.params.blockedCount} kết quả bị chặn bởi QC.`
    }

    return APPROVAL_ERROR_MESSAGES_VI[error.code]
}

export const ApprovalBatchProgressSchema = z.object({
    batchId: UuidSchema,
    status: ApprovalBatchStatusSchema,
    totalCount: z.number().int().positive(),
    queuedCount: z.number().int().nonnegative(),
    processingCount: z.number().int().nonnegative(),
    retryWaitCount: z.number().int().nonnegative(),
    succeededCount: z.number().int().nonnegative(),
    failedCount: z.number().int().nonnegative(),
    createdAt: TimestampSchema,
    startedAt: TimestampSchema.nullable(),
    completedAt: TimestampSchema.nullable(),
    updatedAt: TimestampSchema,
}).strict().superRefine((value, context) => {
    const accountedCount = value.queuedCount
        + value.processingCount
        + value.retryWaitCount
        + value.succeededCount
        + value.failedCount

    if (accountedCount !== value.totalCount) {
        context.addIssue({
            code: 'custom',
            path: ['totalCount'],
            message: 'Tổng tiến độ không khớp với số lượng mẫu',
        })
    }

    const activeCount = value.queuedCount
        + value.processingCount
        + value.retryWaitCount
    const terminal = value.status === 'completed'
        || value.status === 'completed_with_failures'

    if (terminal && activeCount > 0) {
        context.addIssue({
            code: 'custom',
            path: ['status'],
            message: 'Đợt đã hoàn tất không được còn mẫu đang xử lý',
        })
    }
    if (terminal && value.completedAt === null) {
        context.addIssue({
            code: 'custom',
            path: ['completedAt'],
            message: 'Đợt đã hoàn tất phải có thời điểm hoàn tất',
        })
    }
    if (!terminal && value.completedAt !== null) {
        context.addIssue({
            code: 'custom',
            path: ['completedAt'],
            message: 'Đợt chưa hoàn tất không được có thời điểm hoàn tất',
        })
    }
    if (value.status === 'completed' && value.failedCount > 0) {
        context.addIssue({
            code: 'custom',
            path: ['status'],
            message: 'Đợt có mẫu thất bại phải dùng trạng thái hoàn tất có lỗi',
        })
    }
    if (value.status === 'completed_with_failures' && value.failedCount === 0) {
        context.addIssue({
            code: 'custom',
            path: ['status'],
            message: 'Trạng thái hoàn tất có lỗi phải có ít nhất một mẫu thất bại',
        })
    }
})

export const ApprovalBatchItemOutcomeSchema = z.object({
    itemId: UuidSchema,
    sampleId: UuidSchema,
    status: ApprovalBatchItemStatusSchema,
    attemptCount: z.number().int().nonnegative(),
    error: ApprovalErrorSchema.nullable(),
    completedAt: TimestampSchema.nullable(),
}).strict().superRefine((value, context) => {
    const terminal = value.status === 'succeeded' || value.status === 'failed'

    if (value.status === 'failed' && value.error === null) {
        context.addIssue({
            code: 'custom',
            path: ['error'],
            message: 'Mẫu thất bại phải có mã lỗi đã làm sạch',
        })
    }
    if (value.status === 'succeeded' && value.error !== null) {
        context.addIssue({
            code: 'custom',
            path: ['error'],
            message: 'Mẫu thành công không được có lỗi',
        })
    }
    if (terminal && value.completedAt === null) {
        context.addIssue({
            code: 'custom',
            path: ['completedAt'],
            message: 'Mẫu đã kết thúc phải có thời điểm hoàn tất',
        })
    }
    if (!terminal && value.completedAt !== null) {
        context.addIssue({
            code: 'custom',
            path: ['completedAt'],
            message: 'Mẫu chưa kết thúc không được có thời điểm hoàn tất',
        })
    }
    if (!terminal && value.error !== null) {
        context.addIssue({
            code: 'custom',
            path: ['error'],
            message: 'Mẫu chưa kết thúc không được có lỗi cuối cùng',
        })
    }
})

export const ApprovalBatchOutcomePageSchema = z.object({
    batchId: UuidSchema,
    items: z.array(ApprovalBatchItemOutcomeSchema),
    page: z.number().int().positive(),
    pageSize: z.number().int().positive().max(100),
    totalCount: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
}).strict().superRefine((value, context) => {
    if (value.items.length > value.pageSize) {
        context.addIssue({
            code: 'custom',
            path: ['items'],
            message: 'Số kết quả trả về vượt quá kích thước trang',
        })
    }
    if (value.items.length > value.totalCount) {
        context.addIssue({
            code: 'custom',
            path: ['totalCount'],
            message: 'Tổng số kết quả nhỏ hơn số phần tử trên trang',
        })
    }

    const expectedTotalPages = Math.ceil(value.totalCount / value.pageSize)
    if (value.totalPages !== expectedTotalPages) {
        context.addIssue({
            code: 'custom',
            path: ['totalPages'],
            message: 'Tổng số trang không khớp với tổng số kết quả',
        })
    }
    if (value.totalPages > 0 && value.page > value.totalPages) {
        context.addIssue({
            code: 'custom',
            path: ['page'],
            message: 'Trang yêu cầu vượt quá tổng số trang',
        })
    }
    if (value.totalPages === 0 && value.page !== 1) {
        context.addIssue({
            code: 'custom',
            path: ['page'],
            message: 'Trang rỗng phải dùng số trang 1',
        })
    }
})

export const RetryApprovalBatchRequestSchema = z.object({
    parentBatchId: UuidSchema,
    requestKey: UuidSchema,
}).strict()

export type SingleApprovalRequest = z.infer<typeof SingleApprovalRequestSchema>
export type SingleApprovalResponse = z.infer<typeof SingleApprovalResponseSchema>
export type ApprovalBatchSubmissionRequest = z.infer<
    typeof ApprovalBatchSubmissionRequestSchema
>
export type ApprovalBatchSubmissionResponse = z.infer<
    typeof ApprovalBatchSubmissionResponseSchema
>
export type ApprovalSelectAllResponse = z.infer<
    typeof ApprovalSelectAllResponseSchema
>
export type ApprovalBatchProgress = z.infer<typeof ApprovalBatchProgressSchema>
export type ApprovalBatchItemOutcome = z.infer<
    typeof ApprovalBatchItemOutcomeSchema
>
export type ApprovalBatchOutcomePage = z.infer<
    typeof ApprovalBatchOutcomePageSchema
>
export type RetryApprovalBatchRequest = z.infer<
    typeof RetryApprovalBatchRequestSchema
>
