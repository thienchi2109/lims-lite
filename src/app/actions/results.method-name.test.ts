import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockRevalidatePath = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

vi.mock('next/cache', () => ({
    revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}))

vi.mock('./results-validation', () => ({
    fetchResultsForValidation: vi.fn(),
    checkSampleEditability: vi.fn(),
    validateResultsBatch: vi.fn(),
}))

vi.mock('./qc-operations', () => ({
    getActiveQCSessionsForAssays: vi.fn(),
}))

import { getResultsBySample } from './results'

describe('result method text read paths', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('falls back to assay-owned method_name when result method_id is empty', async () => {
        const resultQuery = {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
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
                            validation_rules: {},
                            lab_specialties: null,
                        },
                        method: null,
                        sample: {
                            sample_id: 'S-260708-001',
                            status: 'assigned',
                        },
                        entered_by_user: null,
                    },
                ],
                error: null,
            }),
        }
        mockCreateClient.mockResolvedValue({
            auth: {
                getUser: vi.fn().mockResolvedValue({
                    data: { user: { id: 'user-1' } },
                    error: null,
                }),
            },
            from: vi.fn(() => resultQuery),
        })

        const result = await getResultsBySample('33333333-3333-4333-8333-333333333333')

        expect(result.data?.[0]).toEqual(expect.objectContaining({
            assay_name: 'HBV DNA',
            method_name: 'RT-PCR tự thiết lập',
        }))
    })
})
