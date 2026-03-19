import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
vi.mock('@/lib/api-client', () => ({
    fetchSamplesForApprovalCountClient: vi.fn(),
}))

import { fetchSamplesForApprovalCountClient } from '@/lib/api-client'
import { useApprovalCount } from '../use-approval-count'

const mockFetchSamplesForApprovalCountClient = vi.mocked(fetchSamplesForApprovalCountClient)

describe('useApprovalCount', () => {
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

    it('refetches on remount even when the cached count is still fresh', async () => {
        mockFetchSamplesForApprovalCountClient.mockResolvedValue({ data: 2 })

        const { Wrapper } = createWrapper()
        const firstMount = renderHook(() => useApprovalCount(), { wrapper: Wrapper })

        await waitFor(() => expect(mockFetchSamplesForApprovalCountClient).toHaveBeenCalledTimes(1))

        firstMount.unmount()

        renderHook(() => useApprovalCount(), { wrapper: Wrapper })

        await waitFor(() => expect(mockFetchSamplesForApprovalCountClient).toHaveBeenCalledTimes(2))
    })

    it('polls while mounted so new approval work appears without a manual refresh', async () => {
        vi.useFakeTimers({ shouldAdvanceTime: true })
        mockFetchSamplesForApprovalCountClient.mockResolvedValue({ data: 2 })

        const { Wrapper } = createWrapper()
        renderHook(() => useApprovalCount(), { wrapper: Wrapper })

        await waitFor(() => expect(mockFetchSamplesForApprovalCountClient).toHaveBeenCalledTimes(1))

        await act(async () => {
            vi.advanceTimersByTime(30_000)
        })

        await waitFor(() => expect(mockFetchSamplesForApprovalCountClient).toHaveBeenCalledTimes(2))
    })
})
