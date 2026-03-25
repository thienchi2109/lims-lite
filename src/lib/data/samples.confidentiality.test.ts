import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockRpc = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

import { fetchSamples } from './samples'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CONFIDENTIAL_SAMPLE_ID = '22222222-2222-4222-8222-222222222222'
const PUBLIC_SAMPLE_ID = '33333333-3333-4333-8333-333333333333'

function createThenableQuery(result: unknown) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        is: vi.fn(() => query),
        order: vi.fn(() => query),
        limit: vi.fn(() => query),
        single: vi.fn(async () => result),
        maybeSingle: vi.fn(async () => result),
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function buildSampleRow(overrides: Record<string, unknown> = {}) {
    return {
        id: PUBLIC_SAMPLE_ID,
        sample_id: 'S-0001',
        client_id: '44444444-4444-4444-8444-444444444444',
        client_name: 'Bệnh nhân A',
        type: 'Máu',
        status: 'received',
        received_at: '2026-03-25T09:00:00.000Z',
        received_by: USER_ID,
        received_by_name: 'Nguyễn Văn A',
        created_at: '2026-03-25T09:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        deleted_at: null,
        rejection_reason: null,
        rejected_at: null,
        rejected_by: null,
        ...overrides,
    }
}

describe('fetchSamples confidentiality concealment', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockGetUser.mockResolvedValue({
            data: {
                user: {
                    id: USER_ID,
                },
            },
        })

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser: mockGetUser,
            },
            rpc: mockRpc,
            from: (table: string) => {
                if (table === 'users') {
                    return createThenableQuery({
                        data: {
                            can_access_confidential: false,
                        },
                        error: null,
                    })
                }

                throw new Error(`Unexpected table: ${table}`)
            },
        })

        mockCreateAdminClient.mockReturnValue({
            from: (table: string) => {
                if (table === 'results') {
                    return createThenableQuery({
                        data: [],
                        error: null,
                    })
                }

                throw new Error(`Unexpected admin table: ${table}`)
            },
        })

    })

    it('returns only already-concealed rows and metadata from the RPC for unauthorized users', async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                rows: [
                    buildSampleRow(),
                ],
                total_count: 1,
            },
            error: null,
        })

        const result = await fetchSamples({ page: 1, pageSize: 20 })

        expect(result).toEqual({
            data: [
                buildSampleRow(),
            ],
            count: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })
    })

    it('returns zero exact-lookup matches for unauthorized users when the RPC conceals confidential matches', async () => {
        mockRpc.mockResolvedValueOnce({
            data: {
                rows: [],
                total_count: 0,
            },
            error: null,
        })

        const result = await fetchSamples({
            page: 1,
            pageSize: 20,
            search: 'S-HIV-001',
        })

        expect(result).toEqual({
            data: [],
            count: 0,
            page: 1,
            pageSize: 20,
            totalPages: 0,
        })
    })

    it('fails closed when the RPC unexpectedly leaks confidential rows for an unauthorized user', async () => {
        mockCreateAdminClient.mockReturnValueOnce({
            from: (table: string) => {
                if (table === 'results') {
                    return createThenableQuery({
                        data: [
                            {
                                sample_id: CONFIDENTIAL_SAMPLE_ID,
                            },
                        ],
                        error: null,
                    })
                }

                throw new Error(`Unexpected admin table: ${table}`)
            },
        })

        mockRpc.mockResolvedValueOnce({
            data: {
                rows: [
                    buildSampleRow({
                        id: CONFIDENTIAL_SAMPLE_ID,
                        sample_id: 'S-HIV-001',
                        client_name: 'Bệnh nhân HIV',
                    }),
                    buildSampleRow(),
                ],
                total_count: 5,
            },
            error: null,
        })

        const result = await fetchSamples({ page: 1, pageSize: 20 })

        expect(result).toEqual({
            error: 'Không thể tải danh sách mẫu',
        })
    })

    it('preserves confidential-associated sample visibility for authorized users', async () => {
        mockCreateClient.mockResolvedValueOnce({
            auth: {
                getUser: mockGetUser,
            },
            rpc: mockRpc,
            from: (table: string) => {
                if (table === 'users') {
                    return createThenableQuery({
                        data: {
                            can_access_confidential: true,
                        },
                        error: null,
                    })
                }

                throw new Error(`Unexpected table: ${table}`)
            },
        })

        mockRpc.mockResolvedValueOnce({
            data: {
                rows: [
                    buildSampleRow({
                        id: CONFIDENTIAL_SAMPLE_ID,
                        sample_id: 'S-HIV-001',
                        client_name: 'Bệnh nhân HIV',
                    }),
                ],
                total_count: 1,
            },
            error: null,
        })

        const result = await fetchSamples({
            page: 1,
            pageSize: 20,
            search: 'S-HIV-001',
        })

        expect(result).toEqual({
            data: [
                buildSampleRow({
                    id: CONFIDENTIAL_SAMPLE_ID,
                    sample_id: 'S-HIV-001',
                    client_name: 'Bệnh nhân HIV',
                }),
            ],
            count: 1,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })
    })
})
