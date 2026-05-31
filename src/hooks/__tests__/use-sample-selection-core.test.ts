import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const mockFetchSampleDetail = vi.fn()
const mockFetchSampleResultsClient = vi.fn()
const mockUseQuery = vi.fn()

vi.mock('@tanstack/react-query', async () => {
    const actual = await vi.importActual<typeof import('@tanstack/react-query')>(
        '@tanstack/react-query',
    )

    return {
        ...actual,
        useQuery: (...args: unknown[]) => mockUseQuery(...args),
    }
})

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: (...args: unknown[]) => mockFetchSampleDetail(...args),
}))

vi.mock('@/lib/api-client', () => ({
    fetchSampleResultsClient: (...args: unknown[]) => mockFetchSampleResultsClient(...args),
}))

import { fetchSampleSelectionCore, useSampleSelectionCore } from '../use-sample-selection-core'

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

function createWrapper() {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                refetchOnMount: false,
                refetchOnWindowFocus: false,
                refetchOnReconnect: false,
            },
        },
    })

    function Wrapper({ children }: { children: ReactNode }) {
        return createElement(QueryClientProvider, { client: queryClient }, children)
    }

    return { Wrapper, queryClient }
}

describe('fetchSampleSelectionCore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: false,
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [],
            error: null,
        })
    })

    it('returns the sample detail and fetched results as the shared core payload', async () => {
        const fetchedResults = [
            {
                id: 'result-1',
                assay_id: 'assay-1',
                assay_name: 'Creatinine',
            },
        ]

        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-1',
            sample_id: 'CDC-XN-0001',
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: fetchedResults,
            error: null,
        })

        const sampleCore = await fetchSampleSelectionCore('sample-1')

        expect(mockFetchSampleResultsClient).toHaveBeenCalledWith('sample-1')
        expect(sampleCore).toMatchObject({
            sample: expect.objectContaining({
                id: 'sample-1',
            }),
            results: fetchedResults,
        })
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

    it('still returns sample detail when the seeded results read fails', async () => {
        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-3',
            sample_id: 'CDC-XN-0003',
        })
        mockFetchSampleResultsClient.mockRejectedValue(new Error('Results unavailable'))

        await expect(fetchSampleSelectionCore('sample-3')).resolves.toEqual({
            sample: {
                id: 'sample-3',
                sample_id: 'CDC-XN-0003',
            },
            results: undefined,
        })
    })
})

describe('useSampleSelectionCore', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockUseQuery.mockReturnValue({
            data: undefined,
            error: null,
            isLoading: false,
        })
    })

    it('does not reseed the selection cache on rerender when initialResults is omitted', async () => {
        const { Wrapper, queryClient } = createWrapper()
        const setQueryDataSpy = vi.spyOn(queryClient, 'setQueryData')
        const initialSample = {
            id: 'sample-1',
            sample_id: 'CDC-XN-0001',
        } as any

        const { rerender } = renderHook(
            (props: { sampleId: string; initialSample: typeof initialSample }) =>
                useSampleSelectionCore(props),
            {
                initialProps: {
                    sampleId: 'sample-1',
                    initialSample,
                },
                wrapper: Wrapper,
            },
        )

        await waitFor(() => expect(setQueryDataSpy).toHaveBeenCalledTimes(1))

        act(() => {
            rerender({
                sampleId: 'sample-1',
                initialSample,
            })
        })

        expect(setQueryDataSpy).toHaveBeenCalledTimes(1)
    })

    it('passes the TanStack query abort signal to sample detail and results reads', async () => {
        let capturedQueryFn: ((context: { signal?: AbortSignal }) => Promise<unknown>) | undefined
        const abortController = new AbortController()

        mockUseQuery.mockImplementation((options: {
            queryFn: (context: { signal?: AbortSignal }) => Promise<unknown>
        }) => {
            capturedQueryFn = options.queryFn
            return {
                data: undefined,
                error: null,
                isLoading: false,
            }
        })
        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-4',
            sample_id: 'CDC-XN-0004',
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [],
            error: null,
        })

        const { Wrapper } = createWrapper()
        renderHook(() => useSampleSelectionCore({ sampleId: 'sample-4' }), {
            wrapper: Wrapper,
        })

        await capturedQueryFn?.({ signal: abortController.signal })

        expect(mockFetchSampleDetail).toHaveBeenCalledWith('sample-4', {
            signal: abortController.signal,
        })
        expect(mockFetchSampleResultsClient).toHaveBeenCalledWith('sample-4', {
            signal: abortController.signal,
        })
    })
})
