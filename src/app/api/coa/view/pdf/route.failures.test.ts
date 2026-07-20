/**
 * Locks staff PDF failure mapping and the authenticated gateway boundary.
 * Access, storage, and integrity failures must stop before conversion.
 */

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PdfGatewayErrorCode } from '@/lib/coa/pdf/gateway-client'
import type { StaffCoAAccessFailureReason } from '@/lib/coa/staff-access'

const RELEASED_HTML = '<html><body>Released CoA</body></html>'
const RELEASED_HTML_HASH = createHash('sha256')
    .update(RELEASED_HTML)
    .digest('hex')
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nstaff-route')

const mockCreateClient = vi.fn()
const mockConvertHtmlToPdf = vi.fn()
const mockDownload = vi.fn()
const mockLoadAuthorizedStaffCoA = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('@/lib/coa/staff-access', () => ({
    loadAuthorizedStaffCoA: (...args: unknown[]) =>
        mockLoadAuthorizedStaffCoA(...args),
}))

vi.mock('@/lib/coa/pdf/gateway-client', () => ({
    convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}))

import { GET } from './route'

let testIdentity = 0

function createAuthorizedAccess(options: {
    fileHash?: string | null
    userId?: string
} = {}) {
    return {
        ok: true as const,
        userId: options.userId ?? `staff-failure-${testIdentity}`,
        sample: {
            id: 'sample-uuid',
            sampleId: 'XN 2026/0001',
        },
        report: {
            id: 'report-uuid',
            filePath: 'sample-uuid/report.html',
            fileHash:
                options.fileHash === undefined
                    ? RELEASED_HTML_HASH
                    : options.fileHash,
            generatedAt: '2026-07-19T17:30:00.000Z',
            version: 4,
        },
    }
}

function createPdfRequest(ip = `203.0.113.${testIdentity}`): Request {
    return new Request(
        'http://localhost/api/coa/view/pdf?sample_id=sample-uuid',
        {
            headers: {
                'x-forwarded-for': ip,
            },
        },
    )
}

function createGatewayError(code: PdfGatewayErrorCode): Error {
    return Object.assign(new Error('sensitive upstream failure'), {
        name: 'PdfGatewayError',
        code,
        gatewayRequestId: '1df45f2d-bfe9-4380-90ee-7cd89af32a0c',
        statusCode: 502,
    })
}

async function expectJsonFailure(
    response: Response,
    status: number,
    error: string,
): Promise<void> {
    expect(response.status).toBe(status)
    await expect(response.json()).resolves.toEqual({ error })
}

describe('GET /api/coa/view/pdf failure contract', () => {
    beforeEach(() => {
        testIdentity += 1
        vi.clearAllMocks()
        mockLoadAuthorizedStaffCoA.mockResolvedValue(
            createAuthorizedAccess(),
        )
        mockDownload.mockResolvedValue({
            data: {
                arrayBuffer: async () =>
                    new TextEncoder().encode(RELEASED_HTML).buffer,
            },
            error: null,
        })
        mockCreateClient.mockResolvedValue({
            storage: {
                from: vi.fn(() => ({
                    download: mockDownload,
                })),
            },
        })
        mockConvertHtmlToPdf.mockResolvedValue({
            pdfBytes: PDF_BYTES,
            gatewayRequestId: null,
        })
    })

    it.each([
        ['unauthenticated', 401, 'Vui lòng đăng nhập'],
        [
            'user-not-found',
            403,
            'Không tìm thấy thông tin người dùng',
        ],
        [
            'role-forbidden',
            403,
            'Bạn không có quyền xem phiếu kết quả',
        ],
        ['missing-sample-id', 400, 'Thiếu mã mẫu'],
        [
            'confidential-access-error',
            500,
            'Không thể xác minh quyền truy cập',
        ],
        ['not-found', 404, 'Không tìm thấy phiếu kết quả'],
        [
            'sample-not-completed',
            400,
            'Mẫu chưa hoàn thành xét nghiệm',
        ],
        ['report-not-ready', 404, 'Phiếu kết quả chưa được tạo'],
    ] satisfies ReadonlyArray<
        readonly [StaffCoAAccessFailureReason, number, string]
    >)(
        'maps %s like the staff HTML route without conversion',
        async (reason, status, message) => {
            mockLoadAuthorizedStaffCoA.mockResolvedValue({
                ok: false,
                reason,
            })

            const response = await GET(createPdfRequest())

            await expectJsonFailure(response, status, message)
            expect(mockDownload).not.toHaveBeenCalled()
            expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
        },
    )

    it('fails closed when the released HTML object cannot be loaded', async () => {
        mockDownload.mockResolvedValue({
            data: null,
            error: { message: 'storage object missing' },
        })

        const response = await GET(createPdfRequest())

        await expectJsonFailure(
            response,
            503,
            'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        )
        expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
    })

    it.each([
        ['missing', null],
        ['mismatched', '0'.repeat(64)],
    ])('fails closed when the released HTML hash is %s', async (_, fileHash) => {
        mockLoadAuthorizedStaffCoA.mockResolvedValue(
            createAuthorizedAccess({ fileHash }),
        )

        const response = await GET(createPdfRequest())

        await expectJsonFailure(
            response,
            503,
            'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        )
        expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
    })

    it('rejects the sixth conversion attempt before calling the gateway', async () => {
        mockLoadAuthorizedStaffCoA.mockResolvedValue(
            createAuthorizedAccess({ userId: 'staff-rate-limit-failure' }),
        )
        const request = createPdfRequest('203.0.113.240')

        for (let attempt = 1; attempt <= 5; attempt += 1) {
            const response = await GET(request)
            expect(response.status).toBe(200)
        }

        const response = await GET(request)

        await expectJsonFailure(
            response,
            429,
            'Bạn đã yêu cầu tải PDF quá nhiều lần. Vui lòng thử lại sau.',
        )
        expect(response.headers.get('retry-after')).toBe('600')
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(5)
    })

    it.each([
        [
            'configuration',
            503,
            'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        ],
        [
            'authentication',
            503,
            'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        ],
        [
            'timeout',
            504,
            'Dịch vụ tạo PDF phản hồi quá lâu. Vui lòng thử lại sau.',
        ],
        [
            'service_unavailable',
            503,
            'Dịch vụ tạo PDF hiện không khả dụng. Vui lòng thử lại sau.',
        ],
        [
            'gateway_rejected',
            502,
            'Không thể tạo PDF. Vui lòng thử lại sau.',
        ],
        [
            'invalid_response',
            502,
            'Không thể tạo PDF. Vui lòng thử lại sau.',
        ],
    ] satisfies ReadonlyArray<
        readonly [PdfGatewayErrorCode, number, string]
    >)(
        'maps gateway %s without retry or fallback',
        async (code, status, message) => {
            mockConvertHtmlToPdf.mockRejectedValue(
                createGatewayError(code),
            )

            const response = await GET(createPdfRequest())

            await expectJsonFailure(response, status, message)
            expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
            expect(mockConvertHtmlToPdf).toHaveBeenCalledWith(RELEASED_HTML)
        },
    )
})
