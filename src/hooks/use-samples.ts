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
 * - Realtime updates via Supabase subscriptions
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

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { fetchSamplesClient } from '@/lib/api-client'
import { sampleKeys } from '@/types/query-keys'
import type { SampleListParams } from '@/types'
import { createClient } from '@/lib/supabase/client'

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
    const queryClient = useQueryClient()

    // Setup realtime subscription for samples table changes
    useEffect(() => {
        if (!enabled) return

        const supabase = createClient()
        let timeoutId: ReturnType<typeof setTimeout> | null = null

        const scheduleRefetch = () => {
            if (timeoutId) return
            timeoutId = setTimeout(() => {
                timeoutId = null
                // Invalidate all sample queries to trigger refetch
                queryClient.invalidateQueries({ queryKey: sampleKeys.all })
            }, 250) // Debounce rapid changes
        }

        // Subscribe to all changes on samples table
        const channel = supabase
            .channel('samples-list-changes')
            .on(
                'postgres_changes',
                {
                    event: '*', // Listen to INSERT, UPDATE, DELETE
                    schema: 'public',
                    table: 'samples'
                },
                () => {
                    scheduleRefetch()
                }
            )
            .subscribe()

        return () => {
            if (timeoutId) clearTimeout(timeoutId)
            void supabase.removeChannel(channel)
        }
    }, [enabled, queryClient])

    return useQuery({
        queryKey: sampleKeys.list(params),
        queryFn: async () => {
            const result = await fetchSamplesClient(params)

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
