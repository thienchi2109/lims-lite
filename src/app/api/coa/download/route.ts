/**
 * CoA Download Endpoint
 *
 * GET /api/coa/download?sample_id={uuid}
 *
 * Phase 5: Backend - Authentication & Access
 *
 * Serves CoA HTML file with token validation and audit logging
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'
import { verifyCoAToken, isTokenExpired } from '@/lib/jwt'
import { isConfidentialAssociatedSample } from '@/lib/data/confidential-samples'

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
        // Use admin client to bypass RLS - authorization is via JWT token, not Supabase session
        const supabase = createAdminClient()
        const clientIP = getClientIP(request)

        const { searchParams } = new URL(request.url)
        const sampleId = searchParams.get('sample_id')
        const authorization = request.headers.get('authorization')
        const headerToken = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
        const cookieToken = request.cookies.get('coa_token')?.value
        const token = headerToken || cookieToken

        // Step 1: Validate query parameters
        if (!sampleId) {
            return NextResponse.json(
                { error: 'Thiếu mã mẫu' },
                { status: 400 }
            )
        }

        if (!token) {
            const response = NextResponse.json(
                { error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại' },
                { status: 401 }
            )

            response.cookies.set({
                name: 'coa_token',
                value: '',
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === 'production',
                path: '/api/coa',
                maxAge: 0,
            })

            return response
        }

        // Step 2: Verify JWT token
        let tokenPayload
        try {
            tokenPayload = await verifyCoAToken(token)
        } catch (error) {
            const response = NextResponse.json(
                { error: 'Token không hợp lệ hoặc đã hết hạn' },
                { status: 401 }
            )

            response.cookies.set({
                name: 'coa_token',
                value: '',
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === 'production',
                path: '/api/coa',
                maxAge: 0,
            })

            return response
        }

        // Step 3: Check token expiry
        if (isTokenExpired(tokenPayload)) {
            const response = NextResponse.json(
                { error: 'Token đã hết hạn. Vui lòng đăng nhập lại' },
                { status: 401 }
            )

            response.cookies.set({
                name: 'coa_token',
                value: '',
                httpOnly: true,
                sameSite: 'strict',
                secure: process.env.NODE_ENV === 'production',
                path: '/api/coa',
                maxAge: 0,
            })

            return response
        }

        // Step 4: Fetch sample and verify client ownership before the confidential probe
        // so foreign sample IDs cannot distinguish confidential vs non-confidential records.
        const { data: sample, error: sampleError } = await supabase
            .from('samples')
            .select('id, sample_id, client_id, status')
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

        // Step 6: Deny confidential-associated samples with a generic not-found response
        // only after the public session is valid and the sample belongs to this client.
        try {
            const confidentialSample = await isConfidentialAssociatedSample(sampleId)

            if (confidentialSample.data) {
                return NextResponse.json(
                    { error: 'Không tìm thấy phiếu kết quả' },
                    { status: 404 }
                )
            }
        } catch (error) {
            console.error('Confidential CoA association check failed:', error)
            return NextResponse.json(
                { error: 'Không tìm thấy phiếu kết quả' },
                { status: 404 }
            )
        }

        // Step 7: Check sample status
        if (sample.status !== 'completed') {
            return NextResponse.json(
                { error: 'Mẫu chưa hoàn thành xét nghiệm' },
                { status: 400 }
            )
        }

        // Step 8: Fetch latest ready CoA report
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

        // Step 9: Download file from storage
        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('coa-reports')
            .download(coaReport.file_path)

        if (downloadError || !fileData) {
            console.error('Download error:', downloadError)

            await supabase.from('coa_access_log').insert({
                client_id: tokenPayload.client_id,
                sample_id: sampleId,
                coa_report_id: coaReport.id,
                ip_address: clientIP,
                user_agent: request.headers.get('user-agent') || 'Unknown',
                success: false,
                failure_reason: 'Failed to download file',
            })

            return NextResponse.json(
                { error: 'Không thể tải xuống file' },
                { status: 500 }
            )
        }

        // Step 10: Log successful access
        await supabase.from('coa_access_log').insert({
            client_id: tokenPayload.client_id,
            sample_id: sampleId,
            coa_report_id: coaReport.id,
            ip_address: clientIP,
            user_agent: request.headers.get('user-agent') || 'Unknown',
            success: true,
            failure_reason: null,
        })

        // Step 11: Convert blob to text and return with proper Content-Type header
        const htmlContent = await fileData.text()

        return new NextResponse(htmlContent, {
            status: 200,
            headers: {
                'Content-Type': 'text/html; charset=utf-8',
                'Cache-Control': 'private, no-store',
            },
        })

    } catch (error) {
        console.error('CoA download error:', error)
        return NextResponse.json(
            { error: 'Đã xảy ra lỗi hệ thống' },
            { status: 500 }
        )
    }
}
