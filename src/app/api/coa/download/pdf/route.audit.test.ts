/**
 * Verifies identified client PDF failures are allowlisted and fail closed.
 */

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const RELEASED_HTML = '<html><body>Released client CoA</body></html>'
const RELEASED_HTML_HASH = createHash('sha256')
    .update(RELEASED_HTML)
    .digest('hex')

const mockCreateAdminClient = vi.fn()
const mockResolveClientCoAIdentity = vi.fn()
const mockLoadAuthorizedClientCoA = vi.fn()
const mockConvertHtmlToPdf = vi.fn()
const mockStorageDownload = vi.fn()
const mockAccessLogInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/coa/client-access', () => ({
    resolveClientCoAIdentity: (...args: unknown[]) =>
        mockResolveClientCoAIdentity(...args),
    loadAuthorizedClientCoA: (...args: unknown[]) =>
        mockLoadAuthorizedClientCoA(...args),
}))

vi.mock('@/lib/coa/pdf/gateway-client', () => ({
    convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}))

import { GET } from './route'

function createPdfRequest(ip: string) {
    return {
        url: 'http://localhost/api/coa/download/pdf?sample_id=sample-uuid',
        headers: new Headers({
            authorization: 'Bearer public-token',
            'user-agent': 'Vitest Client',
            'x-real-ip': ip,
        }),
        cookies: {
            get: vi.fn(() => undefined),
        },
    } as unknown as import('next/server').NextRequest
}

function createGatewayTimeout(): Error {
    return Object.assign(new Error('sensitive upstream error public-token'), {
        name: 'PdfGatewayError',
        code: 'timeout',
        gatewayRequestId: '1df45f2d-bfe9-4380-90ee-7cd89af32a0c',
        statusCode: 504,
    })
}

describe('GET /api/coa/download/pdf audit failure contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockResolveClientCoAIdentity.mockResolvedValue({
            ok: true,
            clientId: 'client-1',
        })
        mockLoadAuthorizedClientCoA.mockResolvedValue({
            ok: true,
            clientId: 'client-1',
            sample: {
                id: 'sample-uuid',
                sampleId: 'XN 2026/0001',
            },
            report: {
                id: 'report-uuid',
                filePath: 'sample-uuid/report.html',
                fileHash: RELEASED_HTML_HASH,
                generatedAt: '2026-07-19T17:30:00.000Z',
                version: 4,
            },
        })
        mockStorageDownload.mockResolvedValue({
            data: {
                arrayBuffer: async () =>
                    new TextEncoder().encode(RELEASED_HTML).buffer,
            },
            error: null,
        })
        mockAccessLogInsert.mockResolvedValue({
            data: null,
            error: null,
        })
        mockCreateAdminClient.mockReturnValue({
            from: vi.fn((table: string) => {
                if (table !== 'coa_access_log') {
                    throw new Error(`Unexpected table: ${table}`)
                }
                return { insert: mockAccessLogInsert }
            }),
            storage: {
                from: vi.fn(() => ({
                    download: mockStorageDownload,
                })),
            },
        })
        mockConvertHtmlToPdf.mockRejectedValue(createGatewayTimeout())
    })

    it('audits an identified gateway timeout with an allowlisted reason', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)

        const response = await GET(createPdfRequest('203.0.113.31'))

        expect(response.status).toBe(504)
        await expect(response.json()).resolves.toEqual({
            error:
                'Dịch vụ tạo PDF phản hồi quá lâu. Vui lòng thử lại sau.',
        })
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
        expect(mockAccessLogInsert).toHaveBeenCalledWith({
            client_id: 'client-1',
            sample_id: 'sample-uuid',
            coa_report_id: 'report-uuid',
            ip_address: '203.0.113.31',
            user_agent: 'Vitest Client',
            success: false,
            failure_reason: 'gateway_timeout',
        })
        expect(consoleError).toHaveBeenCalledWith(
            'Client CoA PDF operational failure',
            {
                reasonCode: 'gateway_timeout',
                gatewayRequestId:
                    '1df45f2d-bfe9-4380-90ee-7cd89af32a0c',
            },
        )
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            'public-token',
        )
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            RELEASED_HTML,
        )
        consoleError.mockRestore()
    })

    it('replaces the gateway response when failure audit persistence fails', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        mockAccessLogInsert.mockResolvedValue({
            data: null,
            error: { message: 'sensitive database error public-token' },
        })

        const response = await GET(createPdfRequest('203.0.113.32'))

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            error:
                'Không thể hoàn tất tải PDF lúc này. Vui lòng thử lại sau.',
        })
        expect(consoleError).toHaveBeenCalledWith(
            'Client CoA PDF operational failure',
            expect.objectContaining({
                reasonCode: 'audit_unavailable',
                traceId: expect.stringMatching(
                    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
                ),
            }),
        )
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            'public-token',
        )
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            RELEASED_HTML,
        )
        consoleError.mockRestore()
    })
})
