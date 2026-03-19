'use client'

/**
 * useApprovalCount Hook
 *
 * TanStack Query hook for fetching pending approval count.
 * Refetches on window focus for real-time badge updates.
 *
 * @example
 * const { data: count, isLoading } = useApprovalCount()
 */

import { useQuery } from '@tanstack/react-query'
import { approvalKeys } from '@/types/query-keys'
import { fetchSamplesForApprovalCountClient } from '@/lib/api-client'

const COUNT_REFRESH_INTERVAL_MS = 30 * 1000

export function useApprovalCount() {
    return useQuery({
        queryKey: approvalKeys.count,
        queryFn: async () => {
            const result = await fetchSamplesForApprovalCountClient()

            if ('error' in result) {
                throw new Error(String(result.error))
            }

            return result.data ?? 0
        },
        // 30 second stale time - reasonable for badge count
        staleTime: COUNT_REFRESH_INTERVAL_MS,
        // Always refetch on mount so dashboard badges recover immediately after navigation
        refetchOnMount: 'always',
        // Refetch when user returns to tab
        refetchOnWindowFocus: true,
        // Refetch after network reconnect
        refetchOnReconnect: true,
        // Poll lightly so other users' work appears without a manual refresh
        refetchInterval: COUNT_REFRESH_INTERVAL_MS,
    })
}
