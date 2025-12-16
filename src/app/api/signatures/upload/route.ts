import { NextResponse } from 'next/server'
import { uploadManagerSignature } from '@/app/actions/signatures'

/**
 * POST /api/signatures/upload
 * Upload manager signature file
 * Accepts FormData with a 'file' field
 */
export async function POST(request: Request) {
    try {
        const formData = await request.formData()
        const file = formData.get('file')

        if (!file || !(file instanceof File)) {
            return NextResponse.json(
                { success: false, error: 'File không hợp lệ hoặc thiếu' },
                { status: 400 }
            )
        }

        const result = await uploadManagerSignature(formData)

        if (result && typeof result === 'object' && 'error' in result && result.error) {
            return NextResponse.json(result, { status: 400 })
        }

        return NextResponse.json(result ?? { success: true })
    } catch (error) {
        console.error('Signature upload error:', error)
        const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi khi tải lên chữ ký'
        return NextResponse.json({ success: false, error: message }, { status: 500 })
    }
}
