import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockDownload = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
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
        then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function mockStaffViewRoute({
    canAccessConfidential,
    sampleIsConfidential,
}: {
    canAccessConfidential: boolean
    sampleIsConfidential: boolean
}) {
    mockDownload.mockResolvedValue({
        data: {
            text: async () => '<html><body>Confidential CoA</body></html>',
        },
        error: null,
    })

    mockCreateClient.mockResolvedValue({
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: 'staff-1' } },
                error: null,
            }),
        },
        from: (table: string) => {
            if (table === 'users') {
                return createThenableQuery({
                    data: {
                        role: 'analyst',
                        can_access_confidential: canAccessConfidential,
                    },
                    error: null,
                })
            }

            if (table === 'samples') {
                return createThenableQuery({
                    data: {
                        id: 'sample-1',
                        sample_id: 'COA-0001',
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
                        version: 1,
                    },
                    error: null,
                })
            }

            throw new Error(`Unexpected table: ${table}`)
        },
        storage: {
            from: vi.fn(() => ({
                download: mockDownload,
            })),
        },
    })

    mockCreateAdminClient.mockReturnValue({
        from: (table: string) => {
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

            throw new Error(`Unexpected admin table: ${table}`)
        },
    })
}

describe('staff CoA view confidentiality', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('masks confidential CoA preview for staff without confidential authorization', async () => {
        mockStaffViewRoute({
            canAccessConfidential: false,
            sampleIsConfidential: true,
        })

        const response = await GET(
            new Request('http://localhost/api/coa/view?sample_id=sample-1') as Request,
        )

        expect(response.status).toBe(404)
        await expect(response.json()).resolves.toEqual({
            error: 'Không tìm thấy phiếu kết quả',
        })
        expect(mockDownload).not.toHaveBeenCalled()
    })

    it('keeps confidential CoA preview available to authorized staff', async () => {
        mockStaffViewRoute({
            canAccessConfidential: true,
            sampleIsConfidential: true,
        })

        const response = await GET(
            new Request('http://localhost/api/coa/view?sample_id=sample-1') as Request,
        )

        expect(response.status).toBe(200)
        await expect(response.text()).resolves.toContain('Confidential CoA')
        expect(mockDownload).toHaveBeenCalledTimes(1)
    })

    it('keeps non-confidential CoA preview available to staff without confidential authorization', async () => {
        mockStaffViewRoute({
            canAccessConfidential: false,
            sampleIsConfidential: false,
        })

        const response = await GET(
            new Request('http://localhost/api/coa/view?sample_id=sample-1') as Request,
        )

        expect(response.status).toBe(200)
        await expect(response.text()).resolves.toContain('Confidential CoA')
        expect(mockDownload).toHaveBeenCalledTimes(1)
    })
})
