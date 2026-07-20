/**
 * Client-only HTML download for a released CoA snapshot.
 * Identity is resolved before any narrowly scoped service-role access.
 */

import { NextRequest, NextResponse } from 'next/server'
import {
    loadAuthorizedClientCoA,
    resolveClientCoAIdentity,
    type ClientCoAAccessClient,
    type ClientCoAAccessFailureReason,
    type ClientCoAIdentityFailureReason,
} from '@/lib/coa/client-access'
import { createAdminClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest): Promise<Response> {
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
        const access = await loadAuthorizedClientCoA(
            client,
            identity.clientId,
            sampleId,
        )

        if (!access.ok) {
            return createAccessFailureResponse(
                client,
                access.clientId,
                sampleId,
                getClientIp(request),
                getUserAgent(request),
                access.reason,
            )
        }

        const { data: fileData, error: downloadError } = await client
            .storage
            .from('coa-reports')
            .download(access.report.filePath)

        if (downloadError || !fileData) {
            console.error('Download error:', downloadError)
            await insertAccessLog(client, {
                clientId: access.clientId,
                sampleId,
                coaReportId: access.report.id,
                ipAddress: getClientIp(request),
                userAgent: getUserAgent(request),
                success: false,
                failureReason: 'Failed to download file',
            })

            return NextResponse.json(
                { error: 'Không thể tải xuống file' },
                { status: 500 },
            )
        }

        await insertAccessLog(client, {
            clientId: access.clientId,
            sampleId,
            coaReportId: access.report.id,
            ipAddress: getClientIp(request),
            userAgent: getUserAgent(request),
            success: true,
            failureReason: null,
        })

        return new NextResponse(await fileData.text(), {
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
            { status: 500 },
        )
    }
}

function createIdentityFailureResponse(
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

async function createAccessFailureResponse(
    client: ClientCoAAccessClient,
    clientId: string,
    sampleId: string,
    ipAddress: string,
    userAgent: string,
    reason: ClientCoAAccessFailureReason,
): Promise<NextResponse> {
    const auditFailure = async (
        failureReason: string,
    ): Promise<void> => {
        await insertAccessLog(client, {
            clientId,
            sampleId,
            coaReportId: null,
            ipAddress,
            userAgent,
            success: false,
            failureReason,
        })
    }

    switch (reason) {
        case 'sample-not-found':
            await auditFailure('Sample not found')
            return NextResponse.json(
                { error: 'Không tìm thấy mẫu' },
                { status: 404 },
            )
        case 'ownership-forbidden':
            await auditFailure('Unauthorized access attempt')
            return NextResponse.json(
                { error: 'Bạn không có quyền truy cập mẫu này' },
                { status: 403 },
            )
        case 'not-found':
        case 'confidential-check-failed':
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
            await auditFailure('CoA not ready')
            return NextResponse.json(
                {
                    error:
                        'Giấy chứng nhận chưa sẵn sàng. Vui lòng liên hệ phòng xét nghiệm',
                },
                { status: 404 },
            )
    }
}

async function insertAccessLog(
    client: ClientCoAAccessClient,
    entry: {
        clientId: string
        sampleId: string
        coaReportId: string | null
        ipAddress: string
        userAgent: string
        success: boolean
        failureReason: string | null
    },
): Promise<void> {
    await client.from('coa_access_log').insert({
        client_id: entry.clientId,
        sample_id: entry.sampleId,
        coa_report_id: entry.coaReportId,
        ip_address: entry.ipAddress,
        user_agent: entry.userAgent,
        success: entry.success,
        failure_reason: entry.failureReason,
    })
}

function getClientIp(request: Request): string {
    const forwarded = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')

    if (forwarded) {
        return forwarded.split(',')[0].trim()
    }

    return realIp || 'unknown'
}

function getUserAgent(request: Request): string {
    return request.headers.get('user-agent') || 'Unknown'
}
