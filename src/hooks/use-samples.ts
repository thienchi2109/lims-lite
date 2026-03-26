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
import { useEffect, useRef } from 'react'
import { fetchSamplesClient } from '@/lib/api-client'
import { shouldSuppressSamplesRealtimeEcho } from '@/lib/samples-realtime'
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
    const needsVisibilityCatchUpRef = useRef(false)

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

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                needsVisibilityCatchUpRef.current = true
                return
            }

            if (!needsVisibilityCatchUpRef.current) return

            needsVisibilityCatchUpRef.current = false
            scheduleRefetch()
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
                    if (shouldSuppressSamplesRealtimeEcho()) return
                    scheduleRefetch()
                }
            )
            .subscribe()

        document.addEventListener('visibilitychange', handleVisibilityChange)

        return () => {
            needsVisibilityCatchUpRef.current = false
            if (timeoutId) clearTimeout(timeoutId)
            document.removeEventListener('visibilitychange', handleVisibilityChange)
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
        // Realtime subscriptions already keep this list fresh enough while mounted.
        refetchOnWindowFocus: false,
        // Keep previous data while fetching new data (better UX)
        placeholderData: (previousData) => previousData,
    })
}
