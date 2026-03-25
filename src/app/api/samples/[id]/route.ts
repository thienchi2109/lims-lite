import { NextResponse } from 'next/server'
import { getSample } from '@/app/actions/samples'
import { SAMPLE_NOT_FOUND_ERROR } from '@/lib/data/confidential-samples'

type RouteContext = {
    params: Promise<{
        id?: string
    }>
}

export async function GET(_request: Request, context: RouteContext) {
    const { id: sampleId } = await context.params

    if (!sampleId) {
        return NextResponse.json({ error: 'Sample ID is required' }, { status: 400 })
    }

    const result = await getSample(sampleId)

    if ('error' in result) {
        return NextResponse.json({ error: SAMPLE_NOT_FOUND_ERROR }, { status: 404 })
    }

    return NextResponse.json({ data: result.data })
}
