/**
 * CoA View Endpoint for Internal Staff
 *
 * GET /api/coa/view?sample_id={uuid}
 *
 * Serves CoA HTML file for authenticated staff (analysts, managers).
 * Uses Supabase session authentication, not client JWT tokens.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
    getUserConfidentialAccess,
    isConfidentialAssociatedSample,
} from '@/lib/data/confidential-samples'

const COA_NOT_FOUND_ERROR = 'Không tìm thấy phiếu kết quả'

/**
 * GET /api/coa/view
 *
 * View CoA HTML file with Supabase session authorization (for staff only)
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()

        // Step 1: Verify user is authenticated staff
        const {
            data: { user },
            error: authError,
        } = await supabase.auth.getUser()

        if (authError || !user) {
            return NextResponse.json(
                { error: 'Vui lòng đăng nhập' },
                { status: 401 }
            )
        }

        // Step 2: Verify user role (must be analyst or manager)
        const { data: userData, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', user.id)
            .single()

        if (roleError || !userData) {
            return NextResponse.json(
                { error: 'Không tìm thấy thông tin người dùng' },
                { status: 403 }
            )
        }

        if (!['analyst', 'manager'].includes(userData.role)) {
            return NextResponse.json(
                { error: 'Bạn không có quyền xem phiếu kết quả' },
                { status: 403 }
            )
        }

        // Step 3: Validate sample_id parameter
        const { searchParams } = new URL(request.url)
        const sampleId = searchParams.get('sample_id')

        if (!sampleId) {
            return NextResponse.json(
                { error: 'Thiếu mã mẫu' },
                { status: 400 }
            )
        }

        const access = await getUserConfidentialAccess(user.id, supabase)

        if (access.error) {
            return NextResponse.json(
                { error: 'Không thể xác minh quyền truy cập' },
                { status: 500 }
            )
        }

        if (!access.canAccessConfidential) {
            try {
                const confidentialSample = await isConfidentialAssociatedSample(sampleId)

                if (confidentialSample.data) {
                    return NextResponse.json(
                        { error: COA_NOT_FOUND_ERROR },
                        { status: 404 }
                    )
                }
            } catch (error) {
                console.error('Confidential CoA association check failed:', error)
                return NextResponse.json(
                    { error: COA_NOT_FOUND_ERROR },
                    { status: 404 }
                )
            }
        }

        // Step 4: Fetch sample to verify it exists and is completed
        const { data: sample, error: sampleError } = await supabase
            .from('samples')
            .select('id, sample_id, status')
            .eq('id', sampleId)
            .is('deleted_at', null)
            .single()

        if (sampleError || !sample) {
            return NextResponse.json(
                { error: 'Không tìm thấy mẫu' },
                { status: 404 }
            )
        }

        if (sample.status !== 'completed') {
            return NextResponse.json(
                { error: 'Mẫu chưa hoàn thành xét nghiệm' },
                { status: 400 }
            )
        }

        // Step 5: Fetch latest ready CoA report
        const { data: coaReport, error: coaError } = await supabase
            .from('coa_reports')
            .select('id, file_path, version')
            .eq('sample_id', sampleId)
            .eq('status', 'ready')
            .is('deleted_at', null)
            .order('version', { ascending: false })
            .limit(1)
            .single()

        if (coaError || !coaReport) {
            return NextResponse.json(
                { error: 'Phiếu kết quả chưa được tạo' },
                { status: 404 }
            )
        }

        // Step 6: Download file from storage
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('coa-reports')
            .download(coaReport.file_path)

        if (downloadError || !fileData) {
            console.error('Download error:', downloadError)
            return NextResponse.json(
                { error: 'Không thể tải xuống file' },
                { status: 500 }
            )
        }

        // Step 7: Return HTML content
        const htmlContent = await fileData.text()

        return new NextResponse(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'private, max-age=3600',
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
