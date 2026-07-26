import { z } from 'zod'
import { getApprovalBatchDetail } from '@/lib/approval-batches/server'
import {
    invalidRequestResponse,
    serverResultResponse,
} from '../responses'

type RouteContext = {
    params: Promise<{
        batchId?: string
    }>
}

const PaginationSchema = z.object({
    page: z.coerce.number().int().positive().default(1),
    pageSize: z.coerce.number().int().positive().max(100).default(50),
})

export async function GET(request: Request, context: RouteContext) {
    const { batchId } = await context.params
    const parsedBatchId = z.string().uuid().safeParse(batchId)
    const url = new URL(request.url)
    const pagination = PaginationSchema.safeParse({
        page: url.searchParams.get('page') ?? undefined,
        pageSize: url.searchParams.get('pageSize') ?? undefined,
    })

    if (!parsedBatchId.success || !pagination.success) {
        return invalidRequestResponse()
    }

    return serverResultResponse(
        await getApprovalBatchDetail(
            request,
            parsedBatchId.data,
            pagination.data,
        ),
    )
}
