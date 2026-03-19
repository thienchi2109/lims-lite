import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockFetchSamples = vi.fn()
const mockGetAssayDefinitions = vi.fn()
const mockJson = vi.fn((body: unknown, init?: ResponseInit) => ({ body, init }))

vi.mock('@/lib/data/samples', () => ({
    fetchSamples: (...args: unknown[]) => mockFetchSamples(...args),
}))

vi.mock('@/app/actions/assay-queries', () => ({
    getAssayDefinitions: (...args: unknown[]) => mockGetAssayDefinitions(...args),
}))

vi.mock('next/server', () => ({
    NextResponse: {
        json: (...args: unknown[]) => mockJson(...args),
    },
}))

import { GET } from './route'

describe('test-pagination route', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('keeps sample pagination requests on the full dataset', async () => {
        mockFetchSamples.mockResolvedValue({
            data: [],
            count: 0,
            page: 2,
            pageSize: 25,
            totalPages: 0,
        })

        await GET(new Request('http://localhost/api/test-pagination?type=samples&page=2&pageSize=25&search=abc'))

        expect(mockFetchSamples).toHaveBeenCalledWith({
            page: 2,
            pageSize: 25,
            search: 'abc',
            sortOrder: 'desc',
            scope: 'all',
        })
        expect(mockGetAssayDefinitions).not.toHaveBeenCalled()
    })
})
