import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

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
                },
            },
        })

        return function Wrapper({ children }: { children: ReactNode }) {
            return createElement(QueryClientProvider, { client: queryClient }, children)
        }
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('fetches the rejection count on mount', async () => {
        mockFetchRejectedSamplesCountClient.mockResolvedValue({ data: 3 })

        const { result } = renderHook(() => useRejectionCount(), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.data).toBe(3))
        expect(mockFetchRejectedSamplesCountClient).toHaveBeenCalledTimes(1)
    })

    it('throws when the API returns an error', async () => {
        mockFetchRejectedSamplesCountClient.mockResolvedValue({ error: 'boom' })

        const { result } = renderHook(() => useRejectionCount(), { wrapper: createWrapper() })

        await waitFor(() => expect(result.current.isError).toBe(true))
        expect(result.current.error).toBeInstanceOf(Error)
    })
})
