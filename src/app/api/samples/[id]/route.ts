import { NextResponse } from 'next/server'
import { getSample } from '@/app/actions/samples'

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
        const status = result.error === 'Unauthorized' ? 401 : 404
        return NextResponse.json({ error: result.error }, { status })
    }

    return NextResponse.json({ data: result.data })
}
