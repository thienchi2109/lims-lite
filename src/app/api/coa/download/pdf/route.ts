/**
 * Client-only PDF download for an immutable released CoA HTML snapshot.
 * Delivery remains gated by authenticated access, integrity, and audit commit.
 */

import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import {
    loadAuthorizedClientCoA,
    resolveClientCoAIdentity,
} from '@/lib/coa/client-access'
import { persistClientCoAPdfAudit } from '@/lib/coa/client-pdf-audit'
import { buildCoaPdfFilename } from '@/lib/coa/pdf/filename'
import { convertHtmlToPdf } from '@/lib/coa/pdf/gateway-client'
import { verifyCoaHtmlIntegrity } from '@/lib/coa/pdf/integrity'
import { PdfGenerationRateLimiter } from '@/lib/coa/pdf/rate-limit'
import { createAdminClient } from '@/lib/supabase/server'
import {
    auditFailureAndRespond,
    auditUnavailableResponse,
    createAccessFailure,
    createGatewayFailureResponse,
    createIdentityFailureResponse,
    gatewayAuditReason,
    getClientIp,
    getUserAgent,
    isPdfGatewayError,
    logOperationalFailure,
    serviceUnavailableResponse,
    type ClientPdfAuditContext,
} from './route-support'

const clientPdfRateLimiter = new PdfGenerationRateLimiter()

export async function GET(request: NextRequest): Promise<Response> {
    let auditContext: ClientPdfAuditContext | null = null
    const traceId = randomUUID()

    try {
        const sampleId = new URL(request.url).searchParams.get('sample_id')
        if (!sampleId) {
            return NextResponse.json(
                { error: 'Thiếu mã mẫu' },
                { status: 400 },
            )
        }

        const identity = await resolveClientCoAIdentity(request)
        if (!identity.ok) {
            return createIdentityFailureResponse(identity.reason)
        }

        const client = createAdminClient()
        auditContext = {
            client,
            clientId: identity.clientId,
            sampleId: null,
            coaReportId: null,
            ipAddress: getClientIp(request),
            traceId,
            userAgent: getUserAgent(request),
        }

        const access = await loadAuthorizedClientCoA(
            client,
            identity.clientId,
            sampleId,
        )
        if (!access.ok) {
            auditContext.sampleId = access.sampleId
            const failure = createAccessFailure(access.reason)
            if (access.reason === 'confidential-check-failed') {
                logOperationalFailure(failure.reason, null, traceId)
            }
            return auditFailureAndRespond(
                auditContext,
                failure.reason,
                failure.response,
            )
        }

        auditContext.sampleId = access.sample.id
        auditContext.coaReportId = access.report.id
        const rateLimitDecision = clientPdfRateLimiter.consume({
            identityType: 'client',
            identityId: access.clientId,
            ip: auditContext.ipAddress,
        })
        if (!rateLimitDecision.allowed) {
            return auditFailureAndRespond(
                auditContext,
                'rate_limited',
                NextResponse.json(
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
                ),
            )
        }

        const { data: fileData, error: downloadError } = await client
            .storage
            .from('coa-reports')
            .download(access.report.filePath)
        if (downloadError || !fileData) {
            return auditFailureAndRespond(
                auditContext,
                'storage_unavailable',
                serviceUnavailableResponse(),
            )
        }

        const htmlBytes = new Uint8Array(await fileData.arrayBuffer())
        if (
            !access.report.fileHash ||
            !verifyCoaHtmlIntegrity(
                htmlBytes,
                access.report.fileHash,
            )
        ) {
            return auditFailureAndRespond(
                auditContext,
                'integrity_failed',
                serviceUnavailableResponse(),
            )
        }

        const conversion = await convertHtmlToPdf(
            new TextDecoder().decode(htmlBytes),
        )
        const filename = buildCoaPdfFilename(
            access.sample.sampleId,
            access.report.generatedAt ?? '',
        )

        try {
            await persistClientCoAPdfAudit(client, {
                ...auditContext,
                success: true,
                failureReason: null,
            })
        } catch {
            return auditUnavailableResponse(traceId)
        }

        return new Response(
            Uint8Array.from(conversion.pdfBytes).buffer,
            {
                status: 200,
                headers: {
                    'Content-Type': 'application/pdf',
                    'Content-Disposition':
                        `attachment; filename="${filename}"`,
                    'Cache-Control': 'private, no-store',
                },
            },
        )
    } catch (error) {
        if (!auditContext) {
            return auditUnavailableResponse(traceId)
        }

        if (isPdfGatewayError(error)) {
            const reason = gatewayAuditReason(error.code)
            logOperationalFailure(reason, error.gatewayRequestId)
            return auditFailureAndRespond(
                auditContext,
                reason,
                createGatewayFailureResponse(error.code),
            )
        }

        logOperationalFailure('unexpected_failure')
        return auditFailureAndRespond(
            auditContext,
            'unexpected_failure',
            serviceUnavailableResponse(),
        )
    }
}
