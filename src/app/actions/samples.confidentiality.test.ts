import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockCreateAdminClient = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
}))

import { getSample } from './samples'

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

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

function buildSampleRecord() {
    return {
        id: SAMPLE_ID,
        sample_id: 'S-HIV-001',
        client_id: '33333333-3333-4333-8333-333333333333',
        client_name: 'Nguyen Van A',
        type: 'Máu',
        status: 'review',
        received_at: '2026-03-25T09:00:00.000Z',
        received_by: USER_ID,
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
    }
}

describe('getSample confidentiality concealment', () => {
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
            from: (table: string) => {
                if (table === 'samples') {
                    return createThenableQuery({
                        data: buildSampleRecord(),
                        error: null,
                    })
                }

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
                        data: [
                            {
                                sample_id: SAMPLE_ID,
                            },
                        ],
                        error: null,
                    })
                }

                throw new Error(`Unexpected admin table: ${table}`)
            },
        })
    })

    it('conceals confidential-associated sample detail from users without confidential access', async () => {
        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            error: 'Không tìm thấy mẫu',
        })
    })

    it('preserves full sample detail for users with confidential access', async () => {
        mockCreateClient.mockResolvedValueOnce({
            auth: {
                getUser: mockGetUser,
            },
            from: (table: string) => {
                if (table === 'samples') {
                    return createThenableQuery({
                        data: buildSampleRecord(),
                        error: null,
                    })
                }

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

        const result = await getSample(SAMPLE_ID)

        expect(result).toEqual({
            data: expect.objectContaining({
                id: SAMPLE_ID,
                sample_id: 'S-HIV-001',
                client: expect.objectContaining({
                    phone: '0900000001',
                    address: '1 Tran Hung Dao',
                }),
                received_by_name: 'Analyst HIV',
            }),
        })
    })
})
