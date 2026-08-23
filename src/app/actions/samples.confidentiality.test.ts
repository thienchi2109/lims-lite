import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockGetUser = vi.fn()
const mockAdminFrom = vi.fn()
const mockReceiverLookup = vi.fn()

vi.mock('server-only', () => ({}))

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

import { getSample } from './samples'

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'
const RECEIVER_ID = '44444444-4444-4444-8444-444444444444'

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

function buildSampleRecord(overrides: Record<string, unknown> = {}) {
    return {
        id: SAMPLE_ID,
        sample_id: 'S-HIV-001',
        client_id: '33333333-3333-4333-8333-333333333333',
        client_name: 'Nguyen Van A',
        type: 'Máu',
        status: 'review',
        received_at: '2026-03-25T09:00:00.000Z',
        received_by: RECEIVER_ID,
        created_at: '2026-03-25T09:00:00.000Z',
        updated_at: '2026-03-25T10:00:00.000Z',
        deleted_at: null,
        rejection_reason: null,
        rejected_at: null,
        rejected_by: null,
        received_by_user: { full_name: 'Analyst HIV' },
        rejected_by_user: null,
        client: {
            id: '33333333-3333-4333-8333-333333333333',
            name: 'Nguyen Van A',
            date_of_birth: '1991-02-03',
            gender: 'male',
            phone: '0900000001',
            address: '1 Tran Hung Dao',
            health_insurance_num: 'HI-0001',
        },
        ...overrides,
    }
}

function createAuthenticatedSampleClient({
    sample = buildSampleRecord(),
    role = 'analyst',
    canAccessConfidential = false,
}: {
    sample?: ReturnType<typeof buildSampleRecord>
    role?: string
    canAccessConfidential?: boolean
} = {}) {
    return {
        auth: {
            getUser: mockGetUser,
        },
        from: (table: string) => {
            if (table === 'samples') {
                return createThenableQuery({
                    data: sample,
                    error: null,
                })
            }

            if (table === 'users') {
                return createThenableQuery({
                    data: {
                        role,
                        can_access_confidential: canAccessConfidential,
                    },
                    error: null,
                })
            }

            throw new Error(`Unexpected table: ${table}`)
        },
    }
}

describe('getSample receiver names and confidentiality guards', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockGetUser.mockResolvedValue({
            data: {
                user: {
                    id: USER_ID,
                },
            },
        })

        mockCreateClient.mockResolvedValue(createAuthenticatedSampleClient())

        mockReceiverLookup.mockReturnValue(createThenableQuery({
            data: [
                {
                    id: RECEIVER_ID,
                    full_name: 'Active Receiver',
                },
            ],
            error: null,
        }))
        mockAdminFrom.mockImplementation((table: string) => {
            if (table === 'results') {
                return createThenableQuery({
                    data: [
                        {
                            sample_id: SAMPLE_ID,
                        },
                    ],
                    error: null,
                })
            }

            if (table === 'users') {
                return mockReceiverLookup()
            }

            throw new Error(`Unexpected admin table: ${table}`)
        })
        mockCreateAdminClient.mockReturnValue({
            from: mockAdminFrom,
        })
    })

    it('conceals confidential-associated sample detail from users without confidential access', async () => {
        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            error: 'Không tìm thấy mẫu',
        })
        expect(mockAdminFrom).not.toHaveBeenCalledWith('users')
    })

    it('returns the active receiver name when the embedded relationship is hidden', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            sample: buildSampleRecord({
                received_by_user: null,
            }),
            canAccessConfidential: true,
        }))

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            data: expect.objectContaining({
                id: SAMPLE_ID,
                sample_id: 'S-HIV-001',
                client: expect.objectContaining({
                    phone: '0900000001',
                    address: '1 Tran Hung Dao',
                }),
                received_by_name: 'Active Receiver',
            }),
        })
        expect(mockAdminFrom).toHaveBeenCalledWith('users')
    })

    it('overrides a stale embedded receiver name with the active lookup', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            sample: buildSampleRecord({
                received_by_user: { full_name: 'Stale Receiver' },
            }),
            canAccessConfidential: true,
        }))

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            data: expect.objectContaining({
                received_by_name: 'Active Receiver',
            }),
        })
    })

    it('conceals a non-completed sample from doctors before receiver lookup', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            role: 'doctor',
            sample: buildSampleRecord({
                status: 'received',
            }),
        }))

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            error: 'Không tìm thấy mẫu',
        })
        expect(mockAdminFrom).not.toHaveBeenCalledWith('users')
    })

    it('keeps a missing receiver null without querying receiver users', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            sample: buildSampleRecord({
                received_by: null,
                received_by_user: null,
            }),
            canAccessConfidential: true,
        }))

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            data: expect.objectContaining({
                received_by_name: null,
            }),
        })
        expect(mockAdminFrom).not.toHaveBeenCalledWith('users')
    })

    it('resets an embedded receiver name when the active user is missing or deleted', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            sample: buildSampleRecord({
                received_by_user: { full_name: 'Deleted Receiver' },
            }),
            canAccessConfidential: true,
        }))
        mockReceiverLookup.mockReturnValueOnce(createThenableQuery({
            data: [],
            error: null,
        }))

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            data: expect.objectContaining({
                received_by_name: null,
            }),
        })
    })

    it('returns the normalized receiver error when the lookup returns an error', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            canAccessConfidential: true,
        }))
        mockReceiverLookup.mockReturnValueOnce(createThenableQuery({
            data: null,
            error: { message: 'receiver lookup failed' },
        }))

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            error: 'Không thể tải thông tin người nhận mẫu',
        })
    })

    it('returns the normalized receiver error when the lookup throws', async () => {
        mockCreateClient.mockResolvedValueOnce(createAuthenticatedSampleClient({
            canAccessConfidential: true,
        }))
        mockReceiverLookup.mockImplementationOnce(() => {
            throw new Error('receiver lookup failed')
        })

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            error: 'Không thể tải thông tin người nhận mẫu',
        })
    })
})
