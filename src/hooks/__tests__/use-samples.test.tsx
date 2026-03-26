import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import {
    QueryClient,
    QueryClientProvider,
} from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { markLocalSamplesMutation, resetLocalSamplesMutationTracking } from '@/lib/samples-realtime'

const mockFetchSamplesClient = vi.fn()
const mockRemoveChannel = vi.fn()
type MockRealtimePayload = {
    eventType: 'INSERT' | 'UPDATE' | 'DELETE'
    new: { id?: string | null } | null
    old: { id?: string | null } | null
}

let mockPostgresChangeHandler: ((payload: MockRealtimePayload) => void) | null = null
const mockChannel = {
    on: vi.fn((
        _event: string,
        _filter: unknown,
        callback: (payload: MockRealtimePayload) => void,
    ) => {
        mockPostgresChangeHandler = callback
        return mockChannel
    }),
    subscribe: vi.fn(() => mockChannel),
}
const mockBrowserSupabaseClient = {
    channel: vi.fn(() => mockChannel),
    removeChannel: mockRemoveChannel,
}

vi.mock('@/lib/api-client', () => ({
    fetchSamplesClient: (...args: unknown[]) => mockFetchSamplesClient(...args),
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => mockBrowserSupabaseClient,
}))

import { useSamples } from '../use-samples'

describe('useSamples', () => {
    const createWrapper = () => {
        const queryClient = new QueryClient({
            defaultOptions: {
                queries: {
                    retry: false,
                    staleTime: 5 * 60 * 1000,
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
        mockPostgresChangeHandler = null
        resetLocalSamplesMutationTracking()
        mockFetchSamplesClient.mockResolvedValue({
            data: [],
            count: 0,
            page: 1,
            pageSize: 20,
            totalPages: 1,
        })
    })

    const triggerRealtimeChange = (
        sampleId = 'sample-1',
        eventType: MockRealtimePayload['eventType'] = 'UPDATE',
    ) => {
        if (!mockPostgresChangeHandler) {
            throw new Error('Realtime callback was not registered')
        }

        mockPostgresChangeHandler({
            eventType,
            new: eventType === 'DELETE' ? null : { id: sampleId },
            old: eventType === 'INSERT' ? null : { id: sampleId },
        })
    }

    it('refetches when the realtime subscription receives a sample change event', async () => {
        const { Wrapper } = createWrapper()

        renderHook(
            () =>
                useSamples({
                    params: {
                        page: 1,
                        pageSize: 20,
                    },
                }),
            { wrapper: Wrapper },
        )

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            triggerRealtimeChange()
        })

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(2)
        }, { timeout: 1000 })
    })

    it('refetches when the tab becomes visible again after being hidden', async () => {
        const { Wrapper } = createWrapper()
        let visibilityState: DocumentVisibilityState = 'visible'

        Object.defineProperty(document, 'visibilityState', {
            configurable: true,
            get: () => visibilityState,
        })

        renderHook(
            () =>
                useSamples({
                    params: {
                        page: 1,
                        pageSize: 20,
                    },
                }),
            { wrapper: Wrapper },
        )

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            visibilityState = 'hidden'
            document.dispatchEvent(new Event('visibilitychange'))

            visibilityState = 'visible'
            document.dispatchEvent(new Event('visibilitychange'))
        })

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(2)
        }, { timeout: 1000 })
    })

    it('ignores realtime echoes immediately after a local samples mutation', async () => {
        const { Wrapper } = createWrapper()

        renderHook(
            () =>
                useSamples({
                    params: {
                        page: 1,
                        pageSize: 20,
                    },
                }),
            { wrapper: Wrapper },
        )

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            markLocalSamplesMutation('sample-1')
            triggerRealtimeChange('sample-1')
            await new Promise((resolve) => setTimeout(resolve, 350))
        })

        expect(mockFetchSamplesClient).toHaveBeenCalledTimes(1)
    })

    it('still refetches for realtime updates on a different sample during the grace window', async () => {
        const { Wrapper } = createWrapper()

        renderHook(
            () =>
                useSamples({
                    params: {
                        page: 1,
                        pageSize: 20,
                    },
                }),
            { wrapper: Wrapper },
        )

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            markLocalSamplesMutation('sample-1')
            triggerRealtimeChange('sample-2')
        })

        await waitFor(() => {
            expect(mockFetchSamplesClient).toHaveBeenCalledTimes(2)
        }, { timeout: 1000 })
    })
})
