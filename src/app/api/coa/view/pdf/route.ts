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
import { convertHtmlToPdf } from '@/lib/coa/pdf/gateway-client'
import { verifyCoaHtmlIntegrity } from '@/lib/coa/pdf/integrity'
import { PdfGenerationRateLimiter } from '@/lib/coa/pdf/rate-limit'
import { createClient } from '@/lib/supabase/server'

const staffPdfRateLimiter = new PdfGenerationRateLimiter()

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
    } catch {
        return serviceUnavailableResponse()
    }
}

function createAccessFailureResponse(
    reason: StaffCoAAccessFailureReason,
): NextResponse {
    const status = reason === 'unauthenticated' ? 401 : 403

    return NextResponse.json(
        { error: 'Không thể tải PDF' },
        { status },
    )
}

function serviceUnavailableResponse(): NextResponse {
    return NextResponse.json(
        { error: 'Dịch vụ tạo PDF hiện không khả dụng' },
        { status: 503 },
    )
}

function getClientIp(request: Request): string {
    const forwardedFor = request.headers.get('x-forwarded-for')
    if (forwardedFor) {
        return forwardedFor.split(',')[0]?.trim() || 'unknown'
    }

    return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
