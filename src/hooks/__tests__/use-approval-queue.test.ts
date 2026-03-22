import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'

vi.mock('@/lib/api-client', () => ({
    fetchApprovalQueueClient: vi.fn(),
}))

import { fetchApprovalQueueClient } from '@/lib/api-client'
import { approvalKeys } from '@/types/query-keys'
import { useApprovalQueue } from '../use-approval-queue'

const mockFetchApprovalQueueClient = vi.mocked(fetchApprovalQueueClient)

const reviewRows = [
    {
        id: 'review-1',
        sample_id: 'CDC-XN-1001',
        client_name: 'Nguyễn A',
        status: 'review' as const,
        received_at: '2026-03-20T10:00:00Z',
        updated_at: '2026-03-20T11:00:00Z',
        received_by_name: 'KTV A',
        total_tests: 2,
        entered_count: 2,
        approved_count: 0,
        pending_count: 0,
        coa_reports: null,
    },
]

const completedRows = [
    {
        id: 'completed-1',
        sample_id: 'CDC-XN-2001',
        client_name: 'Trần B',
        status: 'completed' as const,
        received_at: '2026-03-19T10:00:00Z',
        updated_at: '2026-03-19T11:00:00Z',
        received_by_name: 'KTV B',
        total_tests: 1,
        entered_count: 0,
        approved_count: 1,
        pending_count: 0,
        coa_reports: null,
    },
]

const refreshedReviewRows = [
    {
        ...reviewRows[0],
        updated_at: '2026-03-20T12:30:00Z',
        approved_count: 1,
    },
]

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

function deferredPromise<T>() {
    let resolve!: (value: T) => void

    const promise = new Promise<T>((res) => {
        resolve = res
    })

    return { promise, resolve }
}

describe('useApprovalQueue', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('prefetches the opposite tab after hydrating the initial queue rows', async () => {
        mockFetchApprovalQueueClient.mockResolvedValue({ data: completedRows })

        const { Wrapper, queryClient } = createWrapper()
        const { result } = renderHook(
            () =>
                useApprovalQueue({
                    tab: 'review',
                    initialData: reviewRows,
                }),
            { wrapper: Wrapper },
        )

        expect(result.current.data).toEqual(reviewRows)

        await waitFor(() => {
            expect(mockFetchApprovalQueueClient).toHaveBeenCalledWith('completed')
        })

        expect(queryClient.getQueryData(approvalKeys.list({ tab: 'completed' }))).toEqual(completedRows)
        expect(mockFetchApprovalQueueClient).toHaveBeenCalledTimes(1)
    })

    it('reuses prefetched rows immediately when switching to the other tab', async () => {
        mockFetchApprovalQueueClient.mockImplementation(async (tab) => {
            return { data: tab === 'completed' ? completedRows : reviewRows }
        })

        const { Wrapper } = createWrapper()
        const { result, rerender } = renderHook(
            ({ tab, initialData }: { tab: 'review' | 'completed'; initialData?: typeof reviewRows }) =>
                useApprovalQueue({
                    tab,
                    initialData,
                }),
            {
                wrapper: Wrapper,
                initialProps: {
                    tab: 'review' as const,
                    initialData: reviewRows,
                },
            },
        )

        await waitFor(() => {
            expect(mockFetchApprovalQueueClient).toHaveBeenCalledWith('completed')
        })

        rerender({
            tab: 'completed',
            initialData: undefined,
        })

        await waitFor(() => {
            expect(result.current.data).toEqual(completedRows)
        })

        expect(mockFetchApprovalQueueClient).toHaveBeenCalledTimes(1)
    })

    it('hydrates the active tab cache again when the server refreshes initial rows', async () => {
        const { Wrapper } = createWrapper()
        const { result, rerender } = renderHook(
            ({ initialData }: { initialData?: typeof reviewRows }) =>
                useApprovalQueue({
                    tab: 'review',
                    initialData,
                }),
            {
                wrapper: Wrapper,
                initialProps: {
                    initialData: reviewRows,
                },
            },
        )

        expect(result.current.data).toEqual(reviewRows)

        rerender({
            initialData: refreshedReviewRows,
        })

        await waitFor(() => {
            expect(result.current.data).toEqual(refreshedReviewRows)
        })
    })

    it('does not seed a switched tab with initial rows from a different server tab', async () => {
        const completedDeferred = deferredPromise<{ data: typeof completedRows }>()

        mockFetchApprovalQueueClient.mockImplementation((tab) => {
            if (tab === 'completed') {
                return completedDeferred.promise
            }

            return Promise.resolve({ data: reviewRows })
        })

        const { Wrapper, queryClient } = createWrapper()
        const { result, rerender } = renderHook(
            ({ tab, initialDataTab }: { tab: 'review' | 'completed'; initialDataTab: 'review' | 'completed' }) =>
                useApprovalQueue({
                    tab,
                    initialData: reviewRows,
                    initialDataTab,
                }),
            {
                wrapper: Wrapper,
                initialProps: {
                    tab: 'review' as const,
                    initialDataTab: 'review' as const,
                },
            },
        )

        await waitFor(() => {
            expect(mockFetchApprovalQueueClient).toHaveBeenCalledWith('completed')
        })

        rerender({
            tab: 'completed',
            initialDataTab: 'review',
        })

        expect(queryClient.getQueryData(approvalKeys.list({ tab: 'completed' }))).toBeUndefined()
        expect(result.current.data).toBeUndefined()

        completedDeferred.resolve({ data: completedRows })

        await waitFor(() => {
            expect(result.current.data).toEqual(completedRows)
        })
    })
})
