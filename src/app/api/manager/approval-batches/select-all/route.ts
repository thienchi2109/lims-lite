import { isBackgroundBatchResultApprovalEnabled } from '@/lib/approval-batches/config'
import { getApprovalSelectAllSnapshot } from '@/lib/approval-batches/server'
import {
    batchDisabledResponse,
    serverResultResponse,
} from '../responses'

export async function GET(request: Request) {
    if (!isBackgroundBatchResultApprovalEnabled()) {
        return batchDisabledResponse()
    }

    return serverResultResponse(await getApprovalSelectAllSnapshot(request))
}
