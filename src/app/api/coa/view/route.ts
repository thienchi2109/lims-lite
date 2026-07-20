/**
 * CoA View Endpoint for Internal Staff
 *
 * GET /api/coa/view?sample_id={uuid}
 *
 * Serves CoA HTML file for authenticated staff (analysts, managers, doctors).
 * Uses Supabase session authentication, not client JWT tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    loadAuthorizedStaffCoA,
    type StaffCoAAccessFailureReason,
} from '@/lib/coa/staff-access'

const COA_NOT_FOUND_ERROR = 'Không tìm thấy phiếu kết quả'

/**
 * GET /api/coa/view
 *
 * View CoA HTML file with Supabase session authorization (for staff only)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const { searchParams } = new URL(request.url)
        const sampleId = searchParams.get('sample_id')
        const access = await loadAuthorizedStaffCoA(supabase, sampleId)

        if (!access.ok) {
            return createAccessFailureResponse(access.reason)
        }

        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('coa-reports')
            .download(access.report.filePath)

        if (downloadError || !fileData) {
            console.error('Download error:', downloadError)
            return NextResponse.json(
                { error: 'Không thể tải xuống file' },
                { status: 500 }
            )
        }

        const htmlContent = await fileData.text()

        return new NextResponse(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'private, no-store',
            },
        })

    } catch (error) {
        console.error('CoA view error:', error)
        return NextResponse.json(
            { error: 'Đã xảy ra lỗi hệ thống' },
            { status: 500 }
        )
    }
}

function createAccessFailureResponse(
    reason: StaffCoAAccessFailureReason,
): NextResponse {
    switch (reason) {
        case 'unauthenticated':
            return NextResponse.json(
                { error: 'Vui lòng đăng nhập' },
                { status: 401 },
            )
        case 'user-not-found':
            return NextResponse.json(
                { error: 'Không tìm thấy thông tin người dùng' },
                { status: 403 },
            )
        case 'role-forbidden':
            return NextResponse.json(
                { error: 'Bạn không có quyền xem phiếu kết quả' },
                { status: 403 },
            )
        case 'missing-sample-id':
            return NextResponse.json(
                { error: 'Thiếu mã mẫu' },
                { status: 400 },
            )
        case 'confidential-access-error':
            return NextResponse.json(
                { error: 'Không thể xác minh quyền truy cập' },
                { status: 500 },
            )
        case 'not-found':
            return NextResponse.json(
                { error: COA_NOT_FOUND_ERROR },
                { status: 404 },
            )
        case 'sample-not-completed':
            return NextResponse.json(
                { error: 'Mẫu chưa hoàn thành xét nghiệm' },
                { status: 400 },
            )
        case 'report-not-ready':
            return NextResponse.json(
                { error: 'Phiếu kết quả chưa được tạo' },
                { status: 404 },
            )
    }
}
