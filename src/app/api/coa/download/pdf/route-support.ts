/**
 * Route-local response, audit, and metadata-only logging helpers.
 */

import { NextResponse } from 'next/server'
import type {
    ClientCoAAccessClient,
    ClientCoAAccessFailureReason,
    ClientCoAIdentityFailureReason,
} from '@/lib/coa/client-access'
import {
    persistClientCoAPdfAudit,
    type ClientCoAPdfAuditFailureReason,
} from '@/lib/coa/client-pdf-audit'
import type {
    PdfGatewayError,
    PdfGatewayErrorCode,
} from '@/lib/coa/pdf/gateway-client'

const PDF_GATEWAY_ERROR_CODES: ReadonlySet<string> = new Set([
    'configuration',
    'authentication',
    'timeout',
    'service_unavailable',
    'gateway_rejected',
    'invalid_response',
])

const GATEWAY_AUDIT_REASONS: Record<
    PdfGatewayErrorCode,
    ClientCoAPdfAuditFailureReason
> = {
    configuration: 'gateway_configuration',
    authentication: 'gateway_authentication',
    timeout: 'gateway_timeout',
    service_unavailable: 'gateway_service_unavailable',
    gateway_rejected: 'gateway_rejected',
    invalid_response: 'gateway_invalid_response',
}

export type ClientPdfAuditContext = {
    client: ClientCoAAccessClient
    clientId: string
    sampleId: string | null
    coaReportId: string | null
    ipAddress: string
    traceId: string
    userAgent: string
}

export function createIdentityFailureResponse(
    reason: ClientCoAIdentityFailureReason,
): NextResponse {
    const messages: Record<ClientCoAIdentityFailureReason, string> = {
        'missing-token':
            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại',
        'invalid-token': 'Token không hợp lệ hoặc đã hết hạn',
        'expired-token': 'Token đã hết hạn. Vui lòng đăng nhập lại',
    }
    const response = NextResponse.json(
        { error: messages[reason] },
        { status: 401 },
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

export function createAccessFailure(
    reason: ClientCoAAccessFailureReason,
): {
    reason: ClientCoAPdfAuditFailureReason
    response: NextResponse
} {
    switch (reason) {
        case 'sample-not-found':
            return failure(
                'sample_not_found',
                'Không tìm thấy mẫu',
                404,
            )
        case 'ownership-forbidden':
            return failure(
                'ownership_forbidden',
                'Bạn không có quyền truy cập mẫu này',
                403,
            )
        case 'not-found':
            return failure(
                'confidential_concealed',
                'Không tìm thấy phiếu kết quả',
                404,
            )
        case 'confidential-check-failed':
            return failure(
                'confidential_check_failed',
                'Không tìm thấy phiếu kết quả',
                404,
            )
        case 'sample-not-completed':
            return failure(
                'sample_not_completed',
                'Mẫu chưa hoàn thành xét nghiệm',
                400,
            )
        case 'report-not-ready':
            return failure(
                'report_not_ready',
                'Giấy chứng nhận chưa sẵn sàng. Vui lòng liên hệ phòng xét nghiệm',
                404,
            )
    }
}

export async function auditFailureAndRespond(
    context: ClientPdfAuditContext,
    failureReason: ClientCoAPdfAuditFailureReason,
    response: NextResponse,
): Promise<NextResponse> {
    try {
        await persistClientCoAPdfAudit(context.client, {
            ...context,
            success: false,
            failureReason,
        })
        return response
    } catch {
        return auditUnavailableResponse(context.traceId)
    }
}

export function gatewayAuditReason(
    code: PdfGatewayErrorCode,
): ClientCoAPdfAuditFailureReason {
    return GATEWAY_AUDIT_REASONS[code]
}

export function createGatewayFailureResponse(
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
                { error: 'Không thể tạo PDF. Vui lòng thử lại sau.' },
                { status: 502 },
            )
        case 'configuration':
        case 'authentication':
        case 'service_unavailable':
            return serviceUnavailableResponse()
    }
}

export function serviceUnavailableResponse(): NextResponse {
    return NextResponse.json(
        {
            error:
                'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        },
        { status: 503 },
    )
}

export function auditUnavailableResponse(traceId: string): NextResponse {
    logOperationalFailure('audit_unavailable', null, traceId)
    return NextResponse.json(
        {
            error:
                'Không thể hoàn tất tải PDF lúc này. Vui lòng thử lại sau.',
        },
        { status: 503 },
    )
}

export function isPdfGatewayError(
    error: unknown,
): error is PdfGatewayError {
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

export function logOperationalFailure(
    reasonCode:
        | ClientCoAPdfAuditFailureReason
        | 'audit_unavailable',
    gatewayRequestId?: string | null,
    traceId?: string,
): void {
    console.error('Client CoA PDF operational failure', {
        reasonCode,
        ...(gatewayRequestId ? { gatewayRequestId } : {}),
        ...(traceId ? { traceId } : {}),
    })
}

export function getClientIp(request: Request): string {
    return request.headers.get('x-real-ip')?.trim() || 'unknown'
}

export function getUserAgent(request: Request): string {
    return request.headers.get('user-agent') || 'Unknown'
}

function failure(
    reason: ClientCoAPdfAuditFailureReason,
    message: string,
    status: number,
): {
    reason: ClientCoAPdfAuditFailureReason
    response: NextResponse
} {
    return {
        reason,
        response: NextResponse.json(
            { error: message },
            { status },
        ),
    }
}
