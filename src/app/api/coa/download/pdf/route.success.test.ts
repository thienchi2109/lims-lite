/**
 * Locks client PDF success and fail-closed audit delivery behavior.
 */

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const RELEASED_HTML = '<html><body>Released client CoA</body></html>'
const RELEASED_HTML_HASH = createHash('sha256')
    .update(RELEASED_HTML)
    .digest('hex')
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nclient-route')

const mockCreateAdminClient = vi.fn()
const mockVerifyCoAToken = vi.fn()
const mockIsTokenExpired = vi.fn()
const mockIsConfidentialAssociatedSample = vi.fn()
const mockConvertHtmlToPdf = vi.fn()
const mockStorageDownload = vi.fn()
const mockStorageUpload = vi.fn()
const mockAccessLogInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/jwt', () => ({
    verifyCoAToken: (...args: unknown[]) => mockVerifyCoAToken(...args),
    isTokenExpired: (...args: unknown[]) => mockIsTokenExpired(...args),
}))

vi.mock('@/lib/data/confidential-samples', () => ({
    isConfidentialAssociatedSample: (...args: unknown[]) =>
        mockIsConfidentialAssociatedSample(...args),
}))

vi.mock('@/lib/coa/pdf/gateway-client', () => ({
    convertHtmlToPdf: (...args: unknown[]) => mockConvertHtmlToPdf(...args),
}))

import { GET } from './route'

type QueryResult = {
    data: unknown
    error: { message: string } | null
}

type QueryMock = {
    select: ReturnType<typeof vi.fn>
    eq: ReturnType<typeof vi.fn>
    is: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    maybeSingle: ReturnType<typeof vi.fn>
}

function createQuery(result: QueryResult): QueryMock {
    const query = {} as QueryMock
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.is = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.limit = vi.fn(() => query)
    query.single = vi.fn(async () => result)
    query.maybeSingle = vi.fn(async () => result)
    return query
}

function mockAuthorizedClientPdfRoute() {
    const samplesQuery = createQuery({
        data: {
            id: 'sample-uuid',
            sample_id: 'XN 2026/0001',
            client_id: 'client-1',
            status: 'completed',
        },
        error: null,
    })
    const reportsQuery = createQuery({
        data: {
            id: 'report-uuid',
            file_path: 'sample-uuid/report.html',
            file_hash: RELEASED_HTML_HASH,
            generated_at: '2026-07-19T17:30:00.000Z',
            version: 4,
        },
        error: null,
    })
    const resultsQuery = createQuery({
        data: null,
        error: null,
    })
    const from = vi.fn((table: string) => {
        if (table === 'samples') {
            return samplesQuery
        }
        if (table === 'results') {
            return resultsQuery
        }
        if (table === 'coa_reports') {
            return reportsQuery
        }
        if (table === 'coa_access_log') {
            return { insert: mockAccessLogInsert }
        }
        throw new Error(`Unexpected table: ${table}`)
    })

    mockCreateAdminClient.mockReturnValue({
        from,
        storage: {
            from: vi.fn((bucket: string) => {
                if (bucket !== 'coa-reports') {
                    throw new Error(`Unexpected bucket: ${bucket}`)
                }
                return {
                    download: mockStorageDownload,
                    upload: mockStorageUpload,
                }
            }),
        },
    })

    return {
        reportsQuery,
        resultsQuery,
        samplesQuery,
    }
}

function createPdfRequest(options: {
    auth: 'bearer' | 'cookie'
    ip: string
}) {
    return {
        url: 'http://localhost/api/coa/download/pdf?sample_id=sample-uuid',
        headers: new Headers({
            ...(options.auth === 'bearer'
                ? { authorization: 'Bearer public-token' }
                : {}),
            'user-agent': 'Vitest Client',
            'x-real-ip': options.ip,
        }),
        cookies: {
            get: vi.fn((name: string) =>
                name === 'coa_token' && options.auth === 'cookie'
                    ? { value: 'public-token' }
                    : undefined,
            ),
        },
    } as unknown as import('next/server').NextRequest
}

describe('GET /api/coa/download/pdf success contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockVerifyCoAToken.mockResolvedValue({
            client_id: 'client-1',
            exp: 2_000_000_000,
        })
        mockIsTokenExpired.mockReturnValue(false)
        mockIsConfidentialAssociatedSample.mockResolvedValue({ data: false })
        mockStorageDownload.mockResolvedValue({
            data: {
                arrayBuffer: async () =>
                    new TextEncoder().encode(RELEASED_HTML).buffer,
            },
            error: null,
        })
        mockConvertHtmlToPdf.mockResolvedValue({
            pdfBytes: PDF_BYTES,
            gatewayRequestId: '1df45f2d-bfe9-4380-90ee-7cd89af32a0c',
        })
        mockAccessLogInsert.mockResolvedValue({
            data: null,
            error: null,
        })
    })

    it.each([
        ['bearer', '203.0.113.21'],
        ['cookie', '203.0.113.22'],
    ] as const)(
        'returns an audited PDF attachment with a valid %s token',
        async (auth, ip) => {
            const { reportsQuery, resultsQuery, samplesQuery } =
                mockAuthorizedClientPdfRoute()

            const response = await GET(createPdfRequest({ auth, ip }))

            expect(response.status).toBe(200)
            expect(response.headers.get('content-type')).toBe(
                'application/pdf',
            )
            expect(response.headers.get('cache-control')).toBe(
                'private, no-store',
            )
            expect(response.headers.get('content-disposition')).toBe(
                'attachment; filename="PhieuKetQuaXN-XN-2026-0001-20260720.pdf"',
            )
            expect(
                Array.from(new Uint8Array(await response.arrayBuffer())),
            ).toEqual(Array.from(PDF_BYTES))
            expect(mockVerifyCoAToken).toHaveBeenCalledWith('public-token')
            expect(mockStorageDownload).toHaveBeenCalledWith(
                'sample-uuid/report.html',
            )
            expect(mockStorageUpload).not.toHaveBeenCalled()
            expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
            expect(mockConvertHtmlToPdf).toHaveBeenCalledWith(RELEASED_HTML)
            expect(mockAccessLogInsert).toHaveBeenCalledWith({
                client_id: 'client-1',
                sample_id: 'sample-uuid',
                coa_report_id: 'report-uuid',
                ip_address: ip,
                user_agent: 'Vitest Client',
                success: true,
                failure_reason: null,
            })
            expect(samplesQuery.eq).toHaveBeenCalledWith(
                'id',
                'sample-uuid',
            )
            expect(resultsQuery.eq).toHaveBeenCalledWith(
                'sample_id',
                'sample-uuid',
            )
            expect(reportsQuery.eq).toHaveBeenCalledWith(
                'sample_id',
                'sample-uuid',
            )
            expect(
                mockConvertHtmlToPdf.mock.invocationCallOrder[0],
            ).toBeLessThan(mockAccessLogInsert.mock.invocationCallOrder[0])
        },
    )

    it('does not resolve the PDF response before success audit persistence', async () => {
        mockAuthorizedClientPdfRoute()
        let resolveAudit:
            | ((value: { data: null; error: null }) => void)
            | undefined
        mockAccessLogInsert.mockReturnValue(
            new Promise((resolve) => {
                resolveAudit = resolve
            }),
        )

        let responseResolved = false
        const responsePromise = GET(
            createPdfRequest({
                auth: 'bearer',
                ip: '203.0.113.23',
            }),
        ).then((response) => {
            responseResolved = true
            return response
        })

        await vi.waitFor(() => {
            expect(mockAccessLogInsert).toHaveBeenCalledTimes(1)
        })
        expect(responseResolved).toBe(false)

        resolveAudit?.({ data: null, error: null })

        const response = await responsePromise
        expect(response.status).toBe(200)
    })

    it('fails closed when success audit persistence is unavailable', async () => {
        mockAuthorizedClientPdfRoute()
        const consoleError = vi
            .spyOn(console, 'error')
            .mockImplementation(() => undefined)
        mockAccessLogInsert.mockResolvedValue({
            data: null,
            error: { message: 'sensitive database error public-token' },
        })

        const response = await GET(
            createPdfRequest({
                auth: 'bearer',
                ip: '203.0.113.24',
            }),
        )

        expect(response.status).toBe(503)
        await expect(response.json()).resolves.toEqual({
            error:
                'Không thể hoàn tất tải PDF lúc này. Vui lòng thử lại sau.',
        })
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
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
