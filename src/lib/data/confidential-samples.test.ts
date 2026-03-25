import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateAdminClient = vi.fn()
const mockCreateClient = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createAdminClient: (...args: unknown[]) => mockCreateAdminClient(...args),
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { getConfidentialAssociatedSampleIds } from './confidential-samples'

function createThenableQuery(result: unknown) {
    const query: Record<string, unknown> = {
        select: vi.fn(() => query),
        eq: vi.fn(() => query),
        in: vi.fn(() => query),
        single: vi.fn(async () => result),
        then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
            Promise.resolve(result).then(onFulfilled, onRejected),
    }

    return query
}

describe('getConfidentialAssociatedSampleIds', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('throws on database errors instead of returning a safe-looking empty set', async () => {
        mockCreateAdminClient.mockReturnValue({
            from: (table: string) => {
                if (table === 'results') {
                    return createThenableQuery({
                        data: null,
                        error: {
                            message: 'admin query failed',
                        },
                    })
                }

                throw new Error(`Unexpected table: ${table}`)
            },
        })

        await expect(
            getConfidentialAssociatedSampleIds(['11111111-1111-4111-8111-111111111111']),
        ).rejects.toThrow('admin query failed')
    })
})
