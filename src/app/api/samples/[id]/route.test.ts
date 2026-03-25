import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetSample = vi.fn()
const mockJson = vi.fn((body: unknown, init?: ResponseInit) => ({ body, init }))

vi.mock('@/app/actions/samples', () => ({
    getSample: (...args: unknown[]) => mockGetSample(...args),
}))

vi.mock('next/server', () => ({
    NextResponse: {
        json: (...args: unknown[]) => mockJson(...args),
    },
}))

import { GET } from './route'

describe('sample detail route confidentiality responses', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('masks unauthorized detail access as a generic not-found response', async () => {
        mockGetSample.mockResolvedValue({
            error: 'Unauthorized',
        })

        const response = await GET(
            new Request('http://localhost/api/samples/sample-1'),
            { params: Promise.resolve({ id: 'sample-1' }) },
        )

        expect(response).toEqual({
            body: {
                error: 'Không tìm thấy mẫu',
            },
            init: {
                status: 404,
            },
        })
    })

    it('normalizes internal detail lookup errors to the same not-found response', async () => {
        mockGetSample.mockResolvedValue({
            error: 'Failed to evaluate confidential sample association',
        })

        const response = await GET(
            new Request('http://localhost/api/samples/sample-1'),
            { params: Promise.resolve({ id: 'sample-1' }) },
        )

        expect(response).toEqual({
            body: {
                error: 'Không tìm thấy mẫu',
            },
            init: {
                status: 404,
            },
        })
    })

    it('keeps successful sample detail responses unchanged', async () => {
        mockGetSample.mockResolvedValue({
            data: {
                id: 'sample-1',
                sample_id: 'S-0001',
            },
        })

        const response = await GET(
            new Request('http://localhost/api/samples/sample-1'),
            { params: Promise.resolve({ id: 'sample-1' }) },
        )

        expect(response).toEqual({
            body: {
                data: {
                    id: 'sample-1',
                    sample_id: 'S-0001',
                },
            },
            init: undefined,
        })
    })
})
