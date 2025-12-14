/**
 * CoA Download Endpoint
 *
 * GET /api/coa/download?sample_id={uuid}&token={jwt}
 *
 * Phase 5: Backend - Authentication & Access
 *
 * Downloads CoA HTML file with token validation and audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { verifyCoAToken, isTokenExpired } from '@/lib/jwt'

/**
 * Get client IP address from request
 */
function getClientIP(request: NextRequest): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIP = request.headers.get('x-real-ip')

    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }

    if (realIP) {
        return realIP
    }

    return 'unknown'
}

/**
 * GET /api/coa/download
 *
 * Download CoA HTML file with JWT token authorization
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient()
        const clientIP = getClientIP(request)

        const { searchParams } = new URL(request.url)
        const sampleId = searchParams.get('sample_id')
        const token = searchParams.get('token')

        // Step 1: Validate query parameters
        if (!sampleId || !token) {
            return NextResponse.json(
                { error: 'Missing sample_id or token' },
                { status: 400 }
            )
        }

        // Step 2: Verify JWT token
        let tokenPayload
        try {
            tokenPayload = await verifyCoAToken(token)
        } catch (error) {
            return NextResponse.json(
                { error: 'Token không hợp lệ hoặc đã hết hạn' },
                { status: 401 }
            )
        }

        // Step 3: Check token expiry
        if (isTokenExpired(tokenPayload)) {
            return NextResponse.json(
                { error: 'Token đã hết hạn. Vui lòng đăng nhập lại' },
                { status: 401 }
            )
        }

        // Step 4: Verify sample belongs to authenticated client
        const { data: sample, error: sampleError } = await supabase
            .from('samples')
            .select('id, sample_id_display, client_id, status')
            .eq('id', sampleId)
            .is('deleted_at', null)
            .single()

        if (sampleError || !sample) {
            await supabase.from('coa_access_log').insert({
                client_id: tokenPayload.client_id,
                sample_id: sampleId,
                coa_report_id: null,
                ip_address: clientIP,
                user_agent: request.headers.get('user-agent') || 'Unknown',
                success: false,
                failure_reason: 'Sample not found',
            })

            return NextResponse.json(
                { error: 'Không tìm thấy mẫu' },
                { status: 404 }
            )
        }

        // Step 5: Verify client authorization
        if (sample.client_id !== tokenPayload.client_id) {
            await supabase.from('coa_access_log').insert({
                client_id: tokenPayload.client_id,
                sample_id: sampleId,
                coa_report_id: null,
                ip_address: clientIP,
                user_agent: request.headers.get('user-agent') || 'Unknown',
                success: false,
                failure_reason: 'Unauthorized access attempt',
            })

            return NextResponse.json(
                { error: 'Bạn không có quyền truy cập mẫu này' },
                { status: 403 }
            )
        }

        // Step 6: Check sample status
        if (sample.status !== 'completed') {
            return NextResponse.json(
                { error: 'Mẫu chưa hoàn thành xét nghiệm' },
                { status: 400 }
            )
        }

        // Step 7: Fetch latest ready CoA report
        const { data: coaReport, error: coaError } = await supabase
            .from('coa_reports')
            .select('id, file_path, file_hash, version')
            .eq('sample_id', sampleId)
            .eq('status', 'ready')
            .is('deleted_at', null)
            .order('version', { ascending: false })
            .limit(1)
            .single()

        if (coaError || !coaReport) {
            await supabase.from('coa_access_log').insert({
                client_id: tokenPayload.client_id,
                sample_id: sampleId,
                coa_report_id: null,
                ip_address: clientIP,
                user_agent: request.headers.get('user-agent') || 'Unknown',
                success: false,
                failure_reason: 'CoA not ready',
            })

            return NextResponse.json(
                { error: 'Giấy chứng nhận chưa sẵn sàng. Vui lòng liên hệ phòng xét nghiệm' },
                { status: 404 }
            )
        }

        // Step 8: Generate signed URL for file download (1 hour expiry)
        const { data: signedUrlData, error: signedUrlError } = await supabase
            .storage
            .from('coa-reports')
            .createSignedUrl(coaReport.file_path, 3600) // 1 hour = 3600 seconds

        if (signedUrlError || !signedUrlData) {
            console.error('Signed URL error:', signedUrlError)

            await supabase.from('coa_access_log').insert({
                client_id: tokenPayload.client_id,
                sample_id: sampleId,
                coa_report_id: coaReport.id,
                ip_address: clientIP,
                user_agent: request.headers.get('user-agent') || 'Unknown',
                success: false,
                failure_reason: 'Failed to generate download URL',
            })

            return NextResponse.json(
                { error: 'Không thể tạo liên kết tải xuống' },
                { status: 500 }
            )
        }

        // Step 9: Log successful access
        await supabase.from('coa_access_log').insert({
            client_id: tokenPayload.client_id,
            sample_id: sampleId,
            coa_report_id: coaReport.id,
            ip_address: clientIP,
            user_agent: request.headers.get('user-agent') || 'Unknown',
            success: true,
            failure_reason: null,
        })

        // Step 10: Redirect to signed URL (browser will download/display HTML)
        return NextResponse.redirect(signedUrlData.signedUrl)

    } catch (error) {
        console.error('CoA download error:', error)
        return NextResponse.json(
            { error: 'Đã xảy ra lỗi hệ thống' },
            { status: 500 }
        )
    }
}
