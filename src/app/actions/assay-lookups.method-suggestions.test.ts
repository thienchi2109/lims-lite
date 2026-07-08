import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { getMethodNameSuggestions } from './assay-lookups'

describe('assay method name suggestions', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('returns distinct method names from assay definitions before legacy catalog names', async () => {
        const assayQuery = {
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [
                    { method_name: 'CLIA' },
                    { method_name: 'ELISA' },
                    { method_name: 'CLIA' },
                ],
                error: null,
            }),
        }
        const methodsQuery = {
            select: vi.fn().mockReturnThis(),
            is: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({
                data: [
                    { name: 'ELISA' },
                    { name: 'PCR' },
                ],
                error: null,
            }),
        }
        mockCreateClient.mockResolvedValue({
            from: vi.fn((table: string) => (table === 'assay_definitions' ? assayQuery : methodsQuery)),
        })

        const result = await getMethodNameSuggestions()

        expect(result).toEqual({ data: ['CLIA', 'ELISA', 'PCR'] })
    })
})
