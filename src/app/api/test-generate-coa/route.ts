/**
 * CoA Generation Test API
 *
 * Temporary endpoint for testing CoA generation
 * POST /api/test-generate-coa
 */

import { NextRequest, NextResponse } from 'next/server'
import { generateCoA } from '@/app/actions/coa'

export async function POST(request: NextRequest) {
    try {
        const { sampleId } = await request.json()

        if (!sampleId) {
            return NextResponse.json(
                { success: false, error: 'Sample ID is required' },
                { status: 400 }
            )
        }

        const result = await generateCoA(sampleId)

        if (result.success) {
            return NextResponse.json({
                success: true,
                coaId: result.coaId,
                filePath: result.filePath
            })
        } else {
            return NextResponse.json({
                success: false,
                error: result.error
            })
        }
    } catch (error) {
        console.error('Test CoA generation error:', error)
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        )
    }
}
