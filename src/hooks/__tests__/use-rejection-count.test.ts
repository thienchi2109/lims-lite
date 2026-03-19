import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { rejectionKeys } from '@/types/query-keys'

vi.mock('@/lib/api-client', () => ({
    fetchRejectedSamplesCountClient: vi.fn(),
}))

import { fetchRejectedSamplesCountClient } from '@/lib/api-client'
import { useRejectionCount } from '../use-rejection-count'

const mockFetchRejectedSamplesCountClient = vi.mocked(fetchRejectedSamplesCountClient)

describe('useRejectionCount', () => {
    const createWrapper = () => {
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

    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('fetches the rejection count on mount', async () => {
        mockFetchRejectedSamplesCountClient.mockResolvedValue({ data: 3 })

        const { Wrapper } = createWrapper()
        const { result } = renderHook(() => useRejectionCount(), { wrapper: Wrapper })

        await waitFor(() => expect(result.current.data).toBe(3))
        expect(mockFetchRejectedSamplesCountClient).toHaveBeenCalledTimes(1)
    })

    it('throws when the API returns an error', async () => {
        mockFetchRejectedSamplesCountClient.mockResolvedValue({ error: 'boom' })

        const { Wrapper } = createWrapper()
        const { result } = renderHook(() => useRejectionCount(), { wrapper: Wrapper })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(Error)
    })

    it('refetches on remount after the rejection count query was invalidated while unmounted', async () => {
        mockFetchRejectedSamplesCountClient.mockResolvedValue({ data: 3 })

        const { Wrapper, queryClient } = createWrapper()
        const firstMount = renderHook(() => useRejectionCount(), { wrapper: Wrapper })

        await waitFor(() => expect(mockFetchRejectedSamplesCountClient).toHaveBeenCalledTimes(1))

        firstMount.unmount()
        await queryClient.invalidateQueries({ queryKey: rejectionKeys.count })

        renderHook(() => useRejectionCount(), { wrapper: Wrapper })

        await waitFor(() => expect(mockFetchRejectedSamplesCountClient).toHaveBeenCalledTimes(2))
    })

    it('polls while mounted so new rejections appear without a manual refresh', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        mockFetchRejectedSamplesCountClient.mockResolvedValue({ data: 3 })

        const { Wrapper } = createWrapper()
        renderHook(() => useRejectionCount(), { wrapper: Wrapper })

        await waitFor(() => expect(mockFetchRejectedSamplesCountClient).toHaveBeenCalledTimes(1))

        await act(async () => {
            vi.advanceTimersByTime(30_000)
        })

        await waitFor(() => expect(mockFetchRejectedSamplesCountClient).toHaveBeenCalledTimes(2))
    })
})
