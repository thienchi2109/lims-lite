'use client'

/**
 * useRejectionCount Hook
 *
 * TanStack Query hook for fetching rejected sample count for the current analyst.
 */

import { useQuery } from '@tanstack/react-query'
import { rejectionKeys } from '@/types/query-keys'
import { fetchRejectedSamplesCountClient } from '@/lib/api-client'

export function useRejectionCount() {
    return useQuery({
        queryKey: rejectionKeys.count,
        queryFn: async () => {
            const result = await fetchRejectedSamplesCountClient()

            if ('error' in result) {
                throw new Error(String(result.error))
            }

            return result.data ?? 0
        },
        staleTime: 30 * 1000,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
    })
}
