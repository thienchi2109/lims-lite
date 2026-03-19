import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateClient = vi.fn()
const mockFrom = vi.fn()
const mockSelect = vi.fn()
const mockIs = vi.fn()
const mockEq = vi.fn()
const mockNeq = vi.fn()
const mockOr = vi.fn()
const mockGte = vi.fn()
const mockLte = vi.fn()
const mockOrder = vi.fn()
const mockRange = vi.fn()
const mockIn = vi.fn()
const mockRpc = vi.fn()
const mockGetUser = vi.fn()

vi.mock('@/lib/supabase/server', () => ({
    createClient: (...args: unknown[]) => mockCreateClient(...args),
}))

import { fetchSamples } from './samples'

function buildQueryResult() {
    const result = Promise.resolve({
        data: [],
        error: null,
        count: 0,
    })

    const query: any = {
        is: mockIs,
        eq: mockEq,
        neq: mockNeq,
        or: mockOr,
        gte: mockGte,
        lte: mockLte,
        order: mockOrder,
        range: mockRange,
        in: mockIn,
        then: result.then.bind(result),
        catch: result.catch.bind(result),
        finally: result.finally.bind(result),
    }

    mockIs.mockReturnValue(query)
    mockEq.mockReturnValue(query)
    mockNeq.mockReturnValue(query)
    mockOr.mockReturnValue(query)
    mockGte.mockReturnValue(query)
    mockLte.mockReturnValue(query)
    mockOrder.mockReturnValue(query)
    mockRange.mockReturnValue(query)
    mockIn.mockReturnValue(query)
    mockRpc.mockResolvedValue({ data: [], error: null })

    return query
}

describe('fetchSamples scope filtering', () => {
    beforeEach(() => {
        vi.clearAllMocks()

        mockGetUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
        })

        const query = buildQueryResult()

        mockSelect.mockReturnValue(query)
        mockFrom.mockImplementation((table: string) => {
            if (table === 'samples') {
                return { select: mockSelect }
            }

            if (table === 'users') {
                return {
                    select: vi.fn(() => ({
                        ilike: vi.fn().mockResolvedValue({ data: [], error: null }),
                    })),
                }
            }

            throw new Error(`Unexpected table: ${table}`)
        })

        mockCreateClient.mockResolvedValue({
            auth: {
                getUser: mockGetUser,
            },
            from: mockFrom,
            rpc: mockRpc,
        })
    })

    it('excludes completed samples by default when scope is missing', async () => {
        await fetchSamples({ page: 1, pageSize: 20 })

        expect(mockNeq).toHaveBeenCalledWith('status', 'completed')
        expect(mockEq).not.toHaveBeenCalledWith('status', expect.anything())
    })

    it('does not exclude completed samples when scope is all', async () => {
        await fetchSamples({ page: 1, pageSize: 20, scope: 'all' })

        expect(mockNeq).not.toHaveBeenCalledWith('status', 'completed')
    })

    it('lets an explicit completed status override active scope', async () => {
        await fetchSamples({ page: 1, pageSize: 20, scope: 'active', status: 'completed' })

        expect(mockEq).toHaveBeenCalledWith('status', 'completed')
        expect(mockNeq).not.toHaveBeenCalledWith('status', 'completed')
    })
})
