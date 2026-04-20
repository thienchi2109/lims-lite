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
}: {
    sampleIsConfidential: boolean
    sampleClientId?: string
}) {
    mockVerifyCoAToken.mockResolvedValue({
        client_id: 'client-1',
    })
    mockIsTokenExpired.mockReturnValue(false)
    mockStorageDownload.mockResolvedValue({
        data: {
            text: async () => '<html><body>Client CoA</body></html>',
        },
        error: null,
    })
    mockAccessLogInsert.mockResolvedValue({ data: null, error: null })

    mockCreateAdminClient.mockReturnValue({
        from: (table: string) => {
            if (table === 'samples') {
                return createThenableQuery({
                    data: {
                        id: 'sample-1',
                        sample_id: 'COA-0001',
                        client_id: sampleClientId,
                        status: 'completed',
                    },
                    error: null,
                })
            }

            if (table === 'coa_reports') {
                return createThenableQuery({
                    data: {
                        id: 'coa-1',
                        file_path: 'sample-1/report.html',
                        file_hash: 'hash-1',
                        version: 1,
                    },
                    error: null,
                })
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
        },
        storage: {
            from: vi.fn(() => ({
                download: mockStorageDownload,
            })),
        },
    })
}

describe('public CoA download confidentiality', () => {
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
        mockPublicDownloadRoute({
            sampleIsConfidential: false,
        })

        const response = await GET(createRequest('sample-1'))

        expect(response.status).toBe(200)
        expect(response.headers.get('Cache-Control')).toBe('private, no-store')
        await expect(response.text()).resolves.toContain('Client CoA')
        expect(mockStorageDownload).toHaveBeenCalledTimes(1)
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
