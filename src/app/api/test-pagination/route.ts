import { NextResponse } from 'next/server'
import { getAssayDefinitions } from '@/app/actions/assay-queries'
import { fetchSamples } from '@/lib/data/samples'

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type')
    const page = Number(searchParams.get('page')) || 1
    const pageSize = Number(searchParams.get('pageSize')) || 10
    const search = searchParams.get('search') || ''

    try {
        let result
        if (type === 'assays') {
            result = await getAssayDefinitions({ page, pageSize, search })
        } else if (type === 'samples') {
            // Keep pagination checks on the full sample dataset.
            result = await fetchSamples({ page, pageSize, search, sortOrder: 'desc', scope: 'all' })
        } else {
            return NextResponse.json({ error: 'Invalid type. Use "assays" or "samples"' }, { status: 400 })
        }

        return NextResponse.json(result)
    } catch (error: unknown) {
        console.error('[api/test-pagination] GET failed', error)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
