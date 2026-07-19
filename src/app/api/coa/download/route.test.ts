import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateAdminClient = vi.fn()
const mockVerifyCoAToken = vi.fn()
const mockIsTokenExpired = vi.fn()
const mockStorageDownload = vi.fn()
const mockAccessLogInsert = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('@/lib/jwt', () => ({
    verifyCoAToken: (...args: unknown[]) => mockVerifyCoAToken(...args),
    isTokenExpired: (...args: unknown[]) => mockIsTokenExpired(...args),
}))

import { GET } from './route'

type QueryResult = {
    data: unknown
    error: { code?: string; message: string } | null
}

function createThenableQuery(result: QueryResult) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        is: vi.fn(() => query),
        in: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        single: vi.fn(async () => result),
        maybeSingle: vi.fn(async () => result),
        insert: vi.fn(async () => ({ data: null, error: null })),
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function createRequest(sampleId: string, options?: { includeToken?: boolean }) {
    return {
        url: `http://localhost/api/coa/download?sample_id=${sampleId}`,
        headers: new Headers(
            options?.includeToken === false
                ? {}
                : {
                      authorization: 'Bearer public-token',
                  },
        ),
        cookies: {
            get: vi.fn(() => undefined),
        },
    } as unknown as import('next/server').NextRequest
}

function mockPublicDownloadRoute({
    sampleIsConfidential,
    sampleClientId = 'client-1',
    tokenClientId = 'client-1',
    sampleStatus = 'completed',
    coaReady = true,
}: {
    sampleIsConfidential: boolean
    sampleClientId?: string
    tokenClientId?: string
    sampleStatus?: string
    coaReady?: boolean
}) {
    mockVerifyCoAToken.mockResolvedValue({
        client_id: tokenClientId,
    })
    mockIsTokenExpired.mockReturnValue(false)
    mockStorageDownload.mockResolvedValue({
        data: {
            text: async () => '<html><body>Client CoA</body></html>',
        },
        error: null,
    })
    mockAccessLogInsert.mockResolvedValue({ data: null, error: null })

    const sampleQuery = createThenableQuery({
        data: {
            id: 'sample-1',
            sample_id: 'COA-0001',
            client_id: sampleClientId,
            status: sampleStatus,
        },
        error: null,
    })
    const coaReportQuery = createThenableQuery({
        data: coaReady
            ? {
                  id: 'coa-1',
                  file_path: 'sample-1/report.html',
                  file_hash: 'hash-1',
                  version: 1,
              }
            : null,
        error: coaReady ? null : { message: 'Not found' },
    })
    const adminFrom = vi.fn((table: string) => {
        if (table === 'samples') {
            return sampleQuery
        }

        if (table === 'coa_reports') {
            return coaReportQuery
        }

        if (table === 'results') {
            return createThenableQuery({
                data: sampleIsConfidential
                    ? [
                          {
                              sample_id: 'sample-1',
                              assay: { is_confidential: true },
                          },
                      ]
                    : [],
                error: null,
            })
        }

        if (table === 'coa_access_log') {
            return {
                insert: mockAccessLogInsert,
            }
        }

        throw new Error(`Unexpected admin table: ${table}`)
    })

    mockCreateAdminClient.mockReturnValue({
        from: adminFrom,
        storage: {
            from: vi.fn(() => ({
                download: mockStorageDownload,
            })),
        },
    })

    return {
        adminFrom,
        sampleQuery,
        coaReportQuery,
    }
}

describe('public CoA download access contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('denies direct public download of confidential CoAs without confirming existence', async () => {
        mockPublicDownloadRoute({
            sampleIsConfidential: true,
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({
            error: 'Không tìm thấy phiếu kết quả',
        })
        expect(mockStorageDownload).not.toHaveBeenCalled()
    })

    it('does not distinguish foreign confidential samples from other unauthorized client samples', async () => {
        mockPublicDownloadRoute({
            sampleIsConfidential: true,
            sampleClientId: 'client-2',
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(403)
        await expect(response.json()).resolves.toEqual({
            error: 'Bạn không có quyền truy cập mẫu này',
        })
        expect(mockStorageDownload).not.toHaveBeenCalled()
    })

    it('preserves public download for non-confidential CoAs', async () => {
        const { adminFrom, sampleQuery, coaReportQuery } = mockPublicDownloadRoute({
            sampleIsConfidential: false,
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        await expect(response.text()).resolves.toContain('Client CoA')
        expect(mockStorageDownload).toHaveBeenCalledTimes(1)
        expect(mockVerifyCoAToken).toHaveBeenCalledWith('public-token')
        expect(mockVerifyCoAToken.mock.invocationCallOrder[0]).toBeLessThan(
            adminFrom.mock.invocationCallOrder[0],
        )
        expect(sampleQuery.eq).toHaveBeenCalledWith('id', 'sample-1')
        expect(coaReportQuery.eq).toHaveBeenCalledWith('sample_id', 'sample-1')
        expect(coaReportQuery.eq).toHaveBeenCalledWith('status', 'ready')
        expect(mockAccessLogInsert).toHaveBeenCalledWith({
            client_id: 'client-1',
            sample_id: 'sample-1',
            coa_report_id: 'coa-1',
            ip_address: 'unknown',
            user_agent: 'Unknown',
            success: true,
            failure_reason: null,
        })
    })

    it('rejects samples that do not belong to the token identity and audits the attempt', async () => {
        mockPublicDownloadRoute({
            sampleIsConfidential: false,
            sampleClientId: 'client-2',
            tokenClientId: 'client-1',
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(403)
        expect(mockStorageDownload).not.toHaveBeenCalled()
        expect(mockAccessLogInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                client_id: 'client-1',
                sample_id: 'sample-1',
                success: false,
                failure_reason: 'Unauthorized access attempt',
            }),
        )
    })

    it('does not fetch a report when the owned sample is not completed', async () => {
        const { adminFrom } = mockPublicDownloadRoute({
            sampleIsConfidential: false,
            sampleStatus: 'review',
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(400)
        await expect(response.json()).resolves.toEqual({
            error: 'Mẫu chưa hoàn thành xét nghiệm',
        })
        expect(adminFrom).not.toHaveBeenCalledWith('coa_reports')
        expect(mockStorageDownload).not.toHaveBeenCalled()
    })

    it('rejects missing ready CoA reports and audits the failed access', async () => {
        mockPublicDownloadRoute({
            sampleIsConfidential: false,
            coaReady: false,
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({
            error: 'Giấy chứng nhận chưa sẵn sàng. Vui lòng liên hệ phòng xét nghiệm',
        })
        expect(mockStorageDownload).not.toHaveBeenCalled()
        expect(mockAccessLogInsert).toHaveBeenCalledWith(
            expect.objectContaining({
                client_id: 'client-1',
                sample_id: 'sample-1',
                success: false,
                failure_reason: 'CoA not ready',
            }),
        )
    })

    it('preserves session-expiry signaling before confidential checks when no public token is present', async () => {
        mockPublicDownloadRoute({
            sampleIsConfidential: true,
        })

        const response = await GET(
            createRequest('sample-1', {
                includeToken: false,
            }),
        )

        expect(response.status).toBe(401)
        await expect(response.json()).resolves.toEqual({
            error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại',
        })
        expect(mockVerifyCoAToken).not.toHaveBeenCalled()
        expect(mockStorageDownload).not.toHaveBeenCalled()
    })
})
