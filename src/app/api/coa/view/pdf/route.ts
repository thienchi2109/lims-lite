/**
 * Staff-only PDF download for an immutable released CoA HTML snapshot.
 * Conversion is delegated exclusively to the authenticated PDF gateway client.
 */

import { NextResponse } from 'next/server'
import {
    loadAuthorizedStaffCoA,
    type StaffCoAAccessFailureReason,
} from '@/lib/coa/staff-access'
import { buildCoaPdfFilename } from '@/lib/coa/pdf/filename'
import {
    convertHtmlToPdf,
    type PdfGatewayError,
    type PdfGatewayErrorCode,
} from '@/lib/coa/pdf/gateway-client'
import { verifyCoaHtmlIntegrity } from '@/lib/coa/pdf/integrity'
import { PdfGenerationRateLimiter } from '@/lib/coa/pdf/rate-limit'
import { createClient } from '@/lib/supabase/server'

const staffPdfRateLimiter = new PdfGenerationRateLimiter()
const PDF_GATEWAY_ERROR_CODES: ReadonlySet<string> = new Set([
    'configuration',
    'authentication',
    'timeout',
    'service_unavailable',
    'gateway_rejected',
    'invalid_response',
])

export async function GET(request: Request): Promise<Response> {
    try {
        const supabase = await createClient()
        const sampleId = new URL(request.url).searchParams.get('sample_id')
        const access = await loadAuthorizedStaffCoA(supabase, sampleId)

        if (!access.ok) {
            return createAccessFailureResponse(access.reason)
        }

        const rateLimitDecision = staffPdfRateLimiter.consume({
            identityType: 'staff',
            identityId: access.userId,
            ip: getClientIp(request),
        })
        if (!rateLimitDecision.allowed) {
            return NextResponse.json(
                {
                    error:
                        'Bạn đã yêu cầu tải PDF quá nhiều lần. Vui lòng thử lại sau.',
                },
                {
                    status: 429,
                    headers: {
                        'Retry-After':
                            rateLimitDecision.retryAfterSeconds.toString(),
                    },
                },
            )
        }

        const { data: fileData, error: downloadError } = await supabase
            .storage
            .from('coa-reports')
            .download(access.report.filePath)

        if (downloadError || !fileData) {
            return serviceUnavailableResponse()
        }

        const htmlBytes = new Uint8Array(await fileData.arrayBuffer())
        if (
            !access.report.fileHash ||
            !verifyCoaHtmlIntegrity(
                htmlBytes,
                access.report.fileHash,
            )
        ) {
            return serviceUnavailableResponse()
        }

        const html = new TextDecoder().decode(htmlBytes)
        const conversion = await convertHtmlToPdf(html)
        const filename = buildCoaPdfFilename(
            access.sample.sampleId,
            access.report.generatedAt,
        )
        const responseBody =
            Uint8Array.from(conversion.pdfBytes).buffer

        return new Response(responseBody, {
            status: 200,
            headers: {
                'Content-Type': 'application/pdf',
                'Content-Disposition':
                    `attachment; filename="${filename}"`,
                'Cache-Control': 'private, no-store',
            },
        })
    } catch (error) {
        if (isPdfGatewayError(error)) {
            return createGatewayFailureResponse(error.code)
        }

        return serviceUnavailableResponse()
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
                { error: 'Không tìm thấy phiếu kết quả' },
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

function createGatewayFailureResponse(
    code: PdfGatewayErrorCode,
): NextResponse {
    switch (code) {
        case 'timeout':
            return NextResponse.json(
                {
                    error:
                        'Dịch vụ tạo PDF phản hồi quá lâu. Vui lòng thử lại sau.',
                },
                { status: 504 },
            )
        case 'gateway_rejected':
        case 'invalid_response':
            return NextResponse.json(
                {
                    error: 'Không thể tạo PDF. Vui lòng thử lại sau.',
                },
                { status: 502 },
            )
        case 'configuration':
        case 'authentication':
        case 'service_unavailable':
            return serviceUnavailableResponse()
    }
}

function serviceUnavailableResponse(): NextResponse {
    return NextResponse.json(
        {
            error:
                'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        },
        { status: 503 },
    )
}

function isPdfGatewayError(error: unknown): error is PdfGatewayError {
    if (!error || typeof error !== 'object') {
        return false
    }

    const candidate = error as Partial<PdfGatewayError>

    return (
        candidate.name === 'PdfGatewayError' &&
        typeof candidate.code === 'string' &&
        PDF_GATEWAY_ERROR_CODES.has(candidate.code)
    )
}

function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown'
    }

    return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
