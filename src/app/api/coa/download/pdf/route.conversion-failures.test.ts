/**
 * Locks storage, integrity, rate-limit, and single-attempt gateway failures.
 */

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PdfGatewayErrorCode } from '@/lib/coa/pdf/gateway-client'

const RELEASED_HTML = '<html><body>Released client CoA</body></html>'
const RELEASED_HTML_HASH = createHash('sha256')
    .update(RELEASED_HTML)
    .digest('hex')
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nclient-route')

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

let testIdentity = 0

function createPdfRequest(ip: string, forwardedFor = ip) {
    return {
        url: 'http://localhost/api/coa/download/pdf?sample_id=sample-uuid',
        headers: new Headers({
            authorization: 'Bearer public-token',
            'user-agent': 'Vitest Client',
            'x-forwarded-for': forwardedFor,
            'x-real-ip': ip,
        }),
        cookies: {
            get: vi.fn(() => undefined),
        },
    } as unknown as import('next/server').NextRequest
}

function createGatewayError(code: PdfGatewayErrorCode): Error {
    return Object.assign(new Error('sensitive upstream error public-token'), {
        name: 'PdfGatewayError',
        code,
        gatewayRequestId: '1df45f2d-bfe9-4380-90ee-7cd89af32a0c',
        statusCode: 502,
    })
}

describe('GET /api/coa/download/pdf conversion failures', () => {
    beforeEach(() => {
        testIdentity += 1
        vi.clearAllMocks()
        mockResolveClientCoAIdentity.mockResolvedValue({
            ok: true,
            clientId: `client-${testIdentity}`,
        })
        mockLoadAuthorizedClientCoA.mockResolvedValue({
            ok: true,
            clientId: `client-${testIdentity}`,
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
        mockConvertHtmlToPdf.mockResolvedValue({
            pdfBytes: PDF_BYTES,
            gatewayRequestId: null,
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
    })

    it('audits storage failure and stops before conversion', async () => {
        mockStorageDownload.mockResolvedValue({
            data: null,
            error: { message: 'sensitive storage error' },
        })

        const response = await GET(createPdfRequest('203.0.113.81'))

        expect(response.status).toBe(503)
        expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
        expect(mockAccessLogInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                coa_report_id: 'report-uuid',
                success: false,
                failure_reason: 'storage_unavailable',
            }),
        )
    })

    it('audits hash mismatch and stops before conversion', async () => {
        mockLoadAuthorizedClientCoA.mockResolvedValue({
            ok: true,
            clientId: `client-${testIdentity}`,
            sample: {
                id: 'sample-uuid',
                sampleId: 'XN 2026/0001',
            },
            report: {
                id: 'report-uuid',
                filePath: 'sample-uuid/report.html',
                fileHash: '0'.repeat(64),
                generatedAt: '2026-07-19T17:30:00.000Z',
                version: 4,
            },
        })

        const response = await GET(createPdfRequest('203.0.113.82'))

        expect(response.status).toBe(503)
        expect(mockConvertHtmlToPdf).not.toHaveBeenCalled()
        expect(mockAccessLogInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                failure_reason: 'integrity_failed',
            }),
        )
    })

    it('rate limits the sixth authorized request before conversion', async () => {
        const ip = `203.0.113.${90 + testIdentity}`

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await GET(createPdfRequest(ip))
            expect(response.status).toBe(200)
        }

        const response = await GET(createPdfRequest(ip))

        expect(response.status).toBe(429)
        expect(response.headers.get('retry-after')).toBeTruthy()
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(5)
        expect(mockAccessLogInsert).toHaveBeenLastCalledWith(
            expect.objectContaining({
                success: false,
                failure_reason: 'rate_limited',
            }),
        )
    })

    it('ignores forged forwarded hops when rate limiting an identified client', async () => {
        const trustedIp = `203.0.113.${120 + testIdentity}`

        for (let attempt = 0; attempt < 5; attempt += 1) {
            const response = await GET(
                createPdfRequest(
                    trustedIp,
                    `198.51.100.${attempt}, 192.0.2.10`,
                ),
            )
            expect(response.status).toBe(200)
        }

        const response = await GET(
            createPdfRequest(trustedIp, '198.51.100.250, 192.0.2.10'),
        )

        expect(response.status).toBe(429)
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(5)
        expect(mockAccessLogInsert).toHaveBeenLastCalledWith(
            expect.objectContaining({
                ip_address: trustedIp,
                success: false,
                failure_reason: 'rate_limited',
            }),
        )
    })

    it.each([
        ['configuration', 503, 'gateway_configuration'],
        ['authentication', 503, 'gateway_authentication'],
        ['timeout', 504, 'gateway_timeout'],
        [
            'service_unavailable',
            503,
            'gateway_service_unavailable',
        ],
        ['gateway_rejected', 502, 'gateway_rejected'],
        ['invalid_response', 502, 'gateway_invalid_response'],
    ] as const)(
        'maps %s with one gateway attempt and audit reason %s',
        async (code, status, auditReason) => {
            const consoleError = vi
                .spyOn(console, 'error')
                .mockImplementation(() => undefined)
            mockConvertHtmlToPdf.mockRejectedValue(
                createGatewayError(code),
            )

            const response = await GET(
                createPdfRequest(`203.0.113.${100 + code.length}`),
            )

            expect(response.status).toBe(status)
            expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
            expect(mockAccessLogInsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    failure_reason: auditReason,
                }),
            )
            expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
                'public-token',
            )
            expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
                RELEASED_HTML,
            )
            consoleError.mockRestore()
        },
    )

    it('does not retry or fall back after an unexpected conversion error', async () => {
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        mockConvertHtmlToPdf.mockRejectedValue(
            new Error('sensitive unexpected error public-token'),
        )

        const response = await GET(createPdfRequest('203.0.113.119'))

        expect(response.status).toBe(503)
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
        expect(mockAccessLogInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                failure_reason: 'unexpected_failure',
            }),
        )
        expect(JSON.stringify(consoleError.mock.calls)).not.toContain(
            'public-token',
        )
        consoleError.mockRestore()
    })
})
