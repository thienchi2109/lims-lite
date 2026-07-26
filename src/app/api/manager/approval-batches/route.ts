import { ApprovalBatchSubmissionRequestSchema } from '@/types'
import { isBackgroundBatchResultApprovalEnabled } from '@/lib/approval-batches/config'
import { submitApprovalBatch } from '@/lib/approval-batches/server'
import { isSameOriginRequest } from '@/app/api/manager/otp/request-guards'
import {
    batchDisabledResponse,
    invalidOriginResponse,
    invalidRequestResponse,
    serverResultResponse,
} from './responses'

export async function POST(request: Request) {
    if (!isBackgroundBatchResultApprovalEnabled()) {
        return batchDisabledResponse()
    }
    if (!isSameOriginRequest(request)) {
        return invalidOriginResponse()
    }

    const parsed = ApprovalBatchSubmissionRequestSchema.safeParse(
        await request.json().catch(() => null),
    )
    if (!parsed.success) {
        return invalidRequestResponse()
    }

    return serverResultResponse(
        await submitApprovalBatch(request, parsed.data),
        202,
    )
}
