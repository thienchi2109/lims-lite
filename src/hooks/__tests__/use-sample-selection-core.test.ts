import { waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFetchSampleDetail = vi.fn()
const mockFetchSampleResultsClient = vi.fn()

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: (...args: unknown[]) => mockFetchSampleDetail(...args),
}))

vi.mock('@/lib/api-client', () => ({
    fetchSampleResultsClient: (...args: unknown[]) => mockFetchSampleResultsClient(...args),
}))

import { fetchSampleSelectionCore } from '../use-sample-selection-core'

function deferredPromise<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void
    let reject!: (reason?: unknown) => void
    const promise = new Promise<T>((innerResolve, innerReject) => {
        resolve = innerResolve
        reject = innerReject
    })

    return {
        promise,
        resolve,
        reject,
    }
}

describe('fetchSampleSelectionCore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [],
            error: null,
        })
    })

    it('skips the results fetch when sample detail already carries embedded core results', async () => {
        const embeddedResults = [
            {
                id: 'result-1',
                assay_id: 'assay-1',
                assay_name: 'Creatinine',
            },
        ]

        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-1',
            sample_id: 'CDC-XN-0001',
            results: embeddedResults,
        })

        const sampleCore = await fetchSampleSelectionCore('sample-1')

        expect(mockFetchSampleResultsClient).not.toHaveBeenCalled()
        expect(sampleCore.results).toEqual(embeddedResults)
    })

    it('starts the results fetch without waiting for a slow detail read', async () => {
        const sampleDetailDeferred = deferredPromise<{
            id: string
            sample_id: string
        }>()

        mockFetchSampleDetail.mockReturnValue(sampleDetailDeferred.promise)

        const sampleCorePromise = fetchSampleSelectionCore('sample-2')
        await waitFor(() => {
            expect(mockFetchSampleResultsClient).toHaveBeenCalledWith('sample-2')
        })

        sampleDetailDeferred.resolve({
            id: 'sample-2',
            sample_id: 'CDC-XN-0002',
        })

        await expect(sampleCorePromise).resolves.toMatchObject({
            sample: expect.objectContaining({
                id: 'sample-2',
            }),
        })
    })
})
