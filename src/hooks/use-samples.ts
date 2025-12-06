'use client'

/**
 * useSamples Hook
 * 
 * TanStack Query hook for fetching paginated samples list with filters.
 * Automatically refetches when filter params change.
 * 
 * Features:
 * - Automatic refetch on filter change
 * - Background refetching on window focus
 * - Optimistic cache updates
 * - Error handling with retry logic
 * 
 * @example
 * const { data, isLoading, error } = useSamples({
 *   page: 1,
 *   pageSize: 20,
 *   status: 'assigned',
 *   search: 'ABC',
 * })
 */

import { useQuery } from '@tanstack/react-query'
import { getSamples } from '@/app/actions/samples'
import { sampleKeys } from '@/types/query-keys'
import type { SampleListParams } from '@/types'

interface UseSamplesOptions {
    /**
     * Filter parameters for samples list
     */
    params: SampleListParams

    /**
     * Enable/disable the query
     * Useful for conditional fetching
     */
    enabled?: boolean
}

export function useSamples({ params, enabled = true }: UseSamplesOptions) {
    return useQuery({
        queryKey: sampleKeys.list(params),
        queryFn: async () => {
            const result = await getSamples(params)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result
        },
        enabled,
        // Refetch on window focus to ensure fresh data
        refetchOnWindowFocus: true,
        // Keep previous data while fetching new data (better UX)
        placeholderData: (previousData) => previousData,
    })
}
