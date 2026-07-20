/**
 * Locks the authorized staff PDF download success contract.
 * Failure mapping and prohibited fallback cases live in a separate Slice 5C suite.
 */

import { createHash } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const RELEASED_HTML = '<html><body>Released CoA</body></html>'
const RELEASED_HTML_HASH = createHash('sha256')
    .update(RELEASED_HTML)
    .digest('hex')
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nstaff-route')

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockConvertHtmlToPdf = vi.fn()
const mockDownload = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
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
    in: ReturnType<typeof vi.fn>
    order: ReturnType<typeof vi.fn>
    limit: ReturnType<typeof vi.fn>
    single: ReturnType<typeof vi.fn>
    then: (
        onFulfilled: (value: QueryResult) => unknown,
        onRejected?: (reason: unknown) => unknown,
    ) => Promise<unknown>
}

function createQuery(result: QueryResult): QueryMock {
    const query = {} as QueryMock
    query.select = vi.fn(() => query)
    query.eq = vi.fn(() => query)
    query.is = vi.fn(() => query)
    query.in = vi.fn(() => query)
    query.order = vi.fn(() => query)
    query.limit = vi.fn(() => query)
    query.single = vi.fn(async () => result)
    query.then = (onFulfilled, onRejected) =>
        Promise.resolve(result).then(onFulfilled, onRejected)
    return query
}

function mockAuthorizedStaffPdfRoute({
    role = 'analyst',
    userId = `staff-${role}`,
    canAccessConfidential = false,
    sampleIsConfidential = false,
}: {
    role?: string
    userId?: string
    canAccessConfidential?: boolean
    sampleIsConfidential?: boolean
} = {}) {
    const usersQuery = createQuery({
        data: {
            role,
            can_access_confidential: canAccessConfidential,
        },
        error: null,
    })
    const samplesQuery = createQuery({
        data: {
            id: 'sample-uuid',
            sample_id: 'XN 2026/0001',
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
    const from = vi.fn((table: string) => {
        if (table === 'users') {
            return usersQuery
        }
        if (table === 'samples') {
            return samplesQuery
        }
        if (table === 'coa_reports') {
            return reportsQuery
        }
        throw new Error(`Unexpected table: ${table}`)
    })

    mockDownload.mockResolvedValue({
        data: {
            arrayBuffer: async () =>
                new TextEncoder().encode(RELEASED_HTML).buffer,
        },
        error: null,
    })
    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: userId } },
                error: null,
            }),
        },
        from,
        storage: {
            from: vi.fn(() => ({
                download: mockDownload,
            })),
        },
    })
    mockCreateAdminClient.mockReturnValue({
        from: (table: string) => {
            if (table !== 'results') {
                throw new Error(`Unexpected admin table: ${table}`)
            }

            return createQuery({
                data: sampleIsConfidential
                    ? [
                          {
                              sample_id: 'sample-uuid',
                              assay: { is_confidential: true },
                          },
                      ]
                    : [],
                error: null,
            })
        },
    })

    return {
        reportsQuery,
    }
}

function createPdfRequest(ip: string): Request {
    return new Request(
        'http://localhost/api/coa/view/pdf?sample_id=sample-uuid',
        {
            headers: {
                'x-forwarded-for': ip,
            },
        },
    )
}

describe('GET /api/coa/view/pdf success contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockConvertHtmlToPdf.mockResolvedValue({
            pdfBytes: PDF_BYTES,
            gatewayRequestId: '1df45f2d-bfe9-4380-90ee-7cd89af32a0c',
        })
    })

    it.each([
        ['analyst', '203.0.113.11'],
        ['manager', '203.0.113.12'],
        ['doctor', '203.0.113.13'],
    ])('returns a PDF attachment for authorized %s staff', async (role, ip) => {
        const { reportsQuery } = mockAuthorizedStaffPdfRoute({ role })

        const response = await GET(createPdfRequest(ip))

        expect(response.status).toBe(200)
        expect(response.headers.get('content-type')).toBe('application/pdf')
        expect(response.headers.get('cache-control')).toBe(
            'private, no-store',
        )
        expect(response.headers.get('content-disposition')).toBe(
            'attachment; filename="PhieuKetQuaXN-XN-2026-0001-20260720.pdf"',
        )
        const responseBytes = new Uint8Array(
            await response.arrayBuffer(),
        )
        expect(Array.from(responseBytes)).toEqual(
            Array.from(PDF_BYTES),
        )
        expect(mockDownload).toHaveBeenCalledWith(
            'sample-uuid/report.html',
        )
        expect(mockConvertHtmlToPdf).toHaveBeenCalledWith(RELEASED_HTML)
        expect(reportsQuery.eq).toHaveBeenCalledWith('status', 'ready')
        expect(reportsQuery.order).toHaveBeenCalledWith('version', {
            ascending: false,
        })
        expect(reportsQuery.limit).toHaveBeenCalledWith(1)
    })

    it('returns a PDF for confidential-authorized staff', async () => {
        mockAuthorizedStaffPdfRoute({
            userId: 'staff-confidential',
            canAccessConfidential: true,
            sampleIsConfidential: true,
        })

        const response = await GET(createPdfRequest('203.0.113.14'))

        expect(response.status).toBe(200)
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(1)
    })

    it('limits one staff identity and IP to five authorized conversions per window', async () => {
        mockAuthorizedStaffPdfRoute({
            userId: 'staff-rate-limit',
        })
        const request = createPdfRequest('203.0.113.15')

        for (let attempt = 1; attempt <= 5; attempt += 1) {
            const response = await GET(request)
            expect(response.status).toBe(200)
        }

        const rejectedResponse = await GET(request)

        expect(rejectedResponse.status).toBe(429)
        expect(rejectedResponse.headers.get('retry-after')).toBe('600')
        await expect(rejectedResponse.json()).resolves.toEqual({
            error: 'Bạn đã yêu cầu tải PDF quá nhiều lần. Vui lòng thử lại sau.',
        })
        expect(mockConvertHtmlToPdf).toHaveBeenCalledTimes(5)
    })
})
