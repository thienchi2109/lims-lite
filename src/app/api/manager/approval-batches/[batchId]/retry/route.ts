import { RetryApprovalBatchRequestSchema } from '@/types'
import { isBackgroundBatchResultApprovalEnabled } from '@/lib/approval-batches/config'
import { retryFailedApprovalBatch } from '@/lib/approval-batches/server'
import { isSameOriginRequest } from '@/app/api/manager/otp/request-guards'
import {
    batchDisabledResponse,
    invalidOriginResponse,
    invalidRequestResponse,
    serverResultResponse,
} from '../../responses'

type RouteContext = {
    params: Promise<{
        batchId?: string
    }>
}

export async function POST(request: Request, context: RouteContext) {
    if (!isBackgroundBatchResultApprovalEnabled()) {
        return batchDisabledResponse()
    }
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse()
    }

    const { batchId } = await context.params
    const parsed = RetryApprovalBatchRequestSchema.safeParse(
        await request.json().catch(() => null),
    )
    if (!parsed.success || parsed.data.parentBatchId !== batchId) {
        return invalidRequestResponse()
    }

    return serverResultResponse(
        await retryFailedApprovalBatch(request, parsed.data),
        202,
    )
}
