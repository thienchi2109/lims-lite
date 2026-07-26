import { z } from 'zod'
import {
    ApprovalBatchOutcomePageSchema,
    ApprovalBatchProgressSchema,
    ApprovalBatchSubmissionRequestSchema,
    ApprovalBatchSubmissionResponseSchema,
    ApprovalErrorSchema,
    ApprovalSelectAllResponseSchema,
    RetryApprovalBatchRequestSchema,
    getApprovalErrorMessageVi,
    type ApprovalBatchSubmissionRequest,
    type RetryApprovalBatchRequest,
} from '@/types'

const ApprovalBatchDetailResponseSchema = z.object({
    progress: ApprovalBatchProgressSchema,
    outcomes: ApprovalBatchOutcomePageSchema,
}).strict()

type Schema<T> = {
    safeParse(value: unknown):
        | { success: true; data: T }
        | { success: false }
}

async function callApprovalBatchApi<T>(
    endpoint: string,
    schema: Schema<T>,
    init: RequestInit = {},
): Promise<T> {
    const response = await fetch(endpoint, {
        cache: 'no-store',
        credentials: 'include',
        ...init,
    })
    const body = await response.json().catch(() => null)

    if (!response.ok) {
        const parsedError = ApprovalErrorSchema.safeParse(
            body && typeof body === 'object' && 'error' in body
                ? body.error
                : null,
        )
        if (parsedError.success) {
            throw new Error(getApprovalErrorMessageVi(parsedError.data))
        }
        throw new Error('Không thể kết nối đến máy chủ')
    }

    const parsed = schema.safeParse(body)
    if (!parsed.success) {
        throw new Error('Phản hồi phê duyệt hàng loạt không hợp lệ')
    }
    return parsed.data
}

function jsonPost(body: unknown): RequestInit {
    return {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    }
}

export function fetchApprovalSelectAllClient() {
    return callApprovalBatchApi(
        '/api/manager/approval-batches/select-all',
        ApprovalSelectAllResponseSchema,
    )
}

export function submitApprovalBatchClient(
    input: ApprovalBatchSubmissionRequest,
) {
    const parsed = ApprovalBatchSubmissionRequestSchema.parse(input)
    return callApprovalBatchApi(
        '/api/manager/approval-batches',
        ApprovalBatchSubmissionResponseSchema,
        jsonPost(parsed),
    )
}

export function fetchApprovalBatchClient(
    batchId: string,
    options: {
        page?: number
        pageSize?: number
        signal?: AbortSignal
    } = {},
) {
    const params = new URLSearchParams({
        page: String(options.page ?? 1),
        pageSize: String(options.pageSize ?? 50),
    })
    return callApprovalBatchApi(
        `/api/manager/approval-batches/${encodeURIComponent(batchId)}?${params}`,
        ApprovalBatchDetailResponseSchema,
        { signal: options.signal },
    )
}

export function retryApprovalBatchClient(input: RetryApprovalBatchRequest) {
    const parsed = RetryApprovalBatchRequestSchema.parse(input)
    return callApprovalBatchApi(
        `/api/manager/approval-batches/${encodeURIComponent(
            parsed.parentBatchId,
        )}/retry`,
        ApprovalBatchSubmissionResponseSchema,
        jsonPost(parsed),
    )
}
