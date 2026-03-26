import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: vi.fn(),
}))

import { findClientByIdentity, findClientByPhone, getClient, getClients } from './clients'

const USER_ID = '11111111-1111-4111-8111-111111111111'
const CONFIDENTIAL_CLIENT = {
    id: '22222222-2222-4222-8222-222222222222',
    id_card_num: '012345678901',
    name: 'Nguyen Van A',
    date_of_birth: '1991-02-03',
    gender: 'male',
    phone: '0900000001',
    address: '1 Tran Hung Dao',
    health_insurance_num: 'HI-0001',
    expiry_date: null,
    created_at: '2026-03-26T09:00:00.000Z',
    updated_at: '2026-03-26T10:00:00.000Z',
}

function createThenableQuery(result: unknown) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        or: vi.fn(() => query),
        order: vi.fn(() => query),
        single: vi.fn(async () => result),
        maybeSingle: vi.fn(async () => result),
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

function mockSupabaseClient({
    clientsResult,
    canAccessConfidential,
    sampleLinksResult = {
        data: [
            {
                id: '33333333-3333-4333-8333-333333333333',
                client_id: CONFIDENTIAL_CLIENT.id,
            },
        ],
        error: null,
    },
    confidentialSampleIdsResult = {
        data: [
            {
                sample_id: '33333333-3333-4333-8333-333333333333',
            },
        ],
        error: null,
    },
}: {
    clientsResult: unknown
    canAccessConfidential: boolean
    sampleLinksResult?: unknown
    confidentialSampleIdsResult?: unknown
}) {
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
        from: (table: string) => {
            if (table === 'clients') {
                return createThenableQuery(clientsResult)
            }

            if (table === 'users') {
                return createThenableQuery({
                    data: {
                        can_access_confidential: canAccessConfidential,
                    },
                    error: null,
                })
            }

            throw new Error(`Unexpected table: ${table}`)
        },
    })

    mockCreateAdminClient.mockReturnValue({
        from: (table: string) => {
            if (table === 'samples') {
                return createThenableQuery(sampleLinksResult)
            }

            if (table === 'results') {
                return createThenableQuery(confidentialSampleIdsResult)
            }

            throw new Error(`Unexpected admin table: ${table}`)
        },
    })
}

describe('client confidentiality search concealment', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockSupabaseClient({
            clientsResult: {
                data: [CONFIDENTIAL_CLIENT],
                error: null,
            },
            canAccessConfidential: false,
        })
    })

    it('conceals exact name matches from getClients for users without confidential access', async () => {
        const result = await getClients(CONFIDENTIAL_CLIENT.name)

        expect(result).toEqual({
            data: [],
        })
    })

    it('conceals exact phone matches from getClients for users without confidential access', async () => {
        const result = await getClients(CONFIDENTIAL_CLIENT.phone)

        expect(result).toEqual({
            data: [],
        })
    })

    it('conceals exact national-id matches from getClients for users without confidential access', async () => {
        const result = await getClients(CONFIDENTIAL_CLIENT.id_card_num)

        expect(result).toEqual({
            data: [],
        })
    })

    it('conceals exact id lookups from getClient for users without confidential access', async () => {
        mockSupabaseClient({
            clientsResult: {
                data: CONFIDENTIAL_CLIENT,
                error: null,
            },
            canAccessConfidential: false,
        })

        const result = await getClient(CONFIDENTIAL_CLIENT.id)

        expect(result).toEqual({
            error: 'Client không tìm thấy',
        })
    })

    it('conceals exact phone lookups for users without confidential access', async () => {
        mockSupabaseClient({
            clientsResult: {
                data: CONFIDENTIAL_CLIENT,
                error: null,
            },
            canAccessConfidential: false,
        })

        const result = await findClientByPhone(CONFIDENTIAL_CLIENT.phone)

        expect(result).toEqual({
            data: null,
        })
    })

    it('conceals exact identity lookups for users without confidential access', async () => {
        mockSupabaseClient({
            clientsResult: {
                data: CONFIDENTIAL_CLIENT,
                error: null,
            },
            canAccessConfidential: false,
        })

        const result = await findClientByIdentity(
            CONFIDENTIAL_CLIENT.name,
            CONFIDENTIAL_CLIENT.date_of_birth,
        )

        expect(result).toEqual({
            data: null,
        })
    })

    it('preserves exact phone lookups for users with confidential access', async () => {
        mockSupabaseClient({
            clientsResult: {
                data: CONFIDENTIAL_CLIENT,
                error: null,
            },
            canAccessConfidential: true,
        })

        const result = await findClientByPhone(CONFIDENTIAL_CLIENT.phone)

        expect(result).toEqual({
            data: CONFIDENTIAL_CLIENT,
        })
    })
})
