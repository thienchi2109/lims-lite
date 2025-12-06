'use client'

/**
 * useSampleTests Hook
 * 
 * TanStack Query hook for fetching tests assigned to a sample.
 * Automatically refetches when sample ID changes.
 * 
 * Features:
 * - Automatic refetch on sample ID change
 * - Background refetching on window focus
 * - Cached data for quick navigation
 * - Error handling with retry logic
 * 
 * @example
 * const { data: tests, isLoading, error } = useSampleTests('sample-uuid')
 */

import { useQuery } from '@tanstack/react-query'
import { getSampleTests } from '@/app/actions/samples'
import { sampleKeys } from '@/types/query-keys'

interface UseSampleTestsOptions {
    /**
     * Sample ID to fetch tests for
     */
    sampleId: string | null

    /**
     * Enable/disable the query
     * Automatically disabled if sampleId is null
     */
    enabled?: boolean
}

export function useSampleTests({ sampleId, enabled = true }: UseSampleTestsOptions) {
    return useQuery({
        queryKey: sampleKeys.tests(sampleId || ''),
        queryFn: async () => {
            if (!sampleId) {
                throw new Error('Sample ID is required')
            }

            const result = await getSampleTests(sampleId)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data || []
        },
        // Only fetch if sampleId is provided and enabled is true
        enabled: enabled && !!sampleId,
        // Refetch on window focus to ensure fresh data
        refetchOnWindowFocus: true,
        // Keep data fresh for 2 minutes
        // Tests can be added/removed frequently
        staleTime: 2 * 60 * 1000, // 2 minutes
    })
}
