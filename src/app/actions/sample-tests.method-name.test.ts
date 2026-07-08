import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockRevalidatePath = vi.fn()
const mockRequireRole = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('@/lib/auth-helpers', () => ({
    requireRole: (...args: unknown[]) => mockRequireRole(...args),
    isAuthError: (value: unknown) => Boolean(value && typeof value === 'object' && 'error' in value),
}))

import { getAssayDefinitions, getSampleTests } from './sample-tests'

function createThenableQuery(result: unknown) {
    const query = {
        select: vi.fn(() => query),
        is: vi.fn(() => query),
        order: vi.fn(() => query),
        ilike: vi.fn(() => query),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve(resolve(result)),
    }

    return query
}

describe('sample test method text read paths', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps assay-owned method_name for assignment choices without catalog methods', async () => {
        const assayQuery = createThenableQuery({
            data: [
                {
                    id: '11111111-1111-4111-8111-111111111111',
                    name: 'HBV DNA',
                    units: 'IU/mL',
                    method_name: 'RT-PCR tự thiết lập',
                    assay_methods: [],
                },
            ],
            error: null,
        })
        mockCreateClient.mockResolvedValue({
            from: vi.fn(() => assayQuery),
        })

        const result = await getAssayDefinitions()

        expect(result.data?.[0]).toEqual(expect.objectContaining({
            method_name: 'RT-PCR tự thiết lập',
            default_method_id: null,
        }))
    })

    it('uses assay-owned method text for assigned tests when result has no method_id', async () => {
        const resultQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({
                data: [
                    {
                        id: '22222222-2222-4222-8222-222222222222',
                        sample_id: '33333333-3333-4333-8333-333333333333',
                        assay_id: '11111111-1111-4111-8111-111111111111',
                        method_id: null,
                        value: null,
                        status: 'pending',
                        entered_by: null,
                        entered_at: null,
                        created_at: '2026-07-08T00:00:00.000Z',
                        updated_at: '2026-07-08T00:00:00.000Z',
                        assay: {
                            id: '11111111-1111-4111-8111-111111111111',
                            name: 'HBV DNA',
                            units: 'IU/mL',
                            method_name: 'RT-PCR tự thiết lập',
                        },
                        method: null,
                    },
                ],
                error: null,
            }),
        }
        mockCreateClient.mockResolvedValue({
            from: vi.fn(() => resultQuery),
        })

        const result = await getSampleTests('33333333-3333-4333-8333-333333333333')

        expect(result.data?.[0].assay.method).toEqual({
            id: null,
            name: 'RT-PCR tự thiết lập',
        })
    })
})
