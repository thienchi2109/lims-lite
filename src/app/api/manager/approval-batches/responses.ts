import { NextResponse } from 'next/server'
import { ApprovalErrorSchema } from '@/types'
import type { ApprovalBatchServerResult } from '@/lib/approval-batches/server'

export function batchDisabledResponse() {
    return NextResponse.json(
        { error: { code: 'BATCH_DISABLED' } },
        { status: 403 },
    )
}

export function invalidRequestResponse() {
    return NextResponse.json(
        { error: { code: 'INTERNAL_ERROR' } },
        { status: 400 },
    )
}

export function invalidOriginResponse() {
    return NextResponse.json(
        { error: { code: 'NOT_AUTHENTICATED' } },
        { status: 403 },
    )
}

export function serverResultResponse<T>(
    result: ApprovalBatchServerResult<T>,
    successStatus = 200,
) {
    if (result.ok) {
        return NextResponse.json(result.data, { status: successStatus })
    }

    return NextResponse.json(
        { error: ApprovalErrorSchema.parse(result.error) },
        { status: result.status },
    )
}
