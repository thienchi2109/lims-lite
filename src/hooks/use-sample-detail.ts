'use client'

/**
 * useSampleDetail Hook
 * 
 * TanStack Query hook for fetching a single sample's details.
 * Automatically refetches when sample ID changes.
 * 
 * Features:
 * - Automatic refetch on sample ID change
 * - Background refetching on window focus
 * - Cached data for quick navigation
 * - Error handling with retry logic
 * 
 * @example
 * const { data: sample, isLoading, error } = useSampleDetail('sample-uuid')
 */

import { useQuery } from '@tanstack/react-query'
import { sampleKeys } from '@/types/query-keys'
import type { SampleWithUser } from '@/types'

interface UseSampleDetailOptions {
    /**
     * Sample ID to fetch
     */
    sampleId: string | null

    /**
     * Enable/disable the query
     * Automatically disabled if sampleId is null
     */
    enabled?: boolean
}

type SampleDetailResponse = { data: SampleWithUser } | { error: string }

export async function fetchSampleDetail(sampleId: string): Promise<SampleWithUser> {
    const response = await fetch(`/api/samples/${sampleId}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: {
            Accept: 'application/json',
        },
    })

    const payload: SampleDetailResponse = await response.json()

    if (!response.ok || !('data' in payload)) {
        const message = 'error' in payload ? payload.error : 'Không thể tải chi tiết mẫu'
        throw new Error(message)
    }

    return payload.data
}

export function useSampleDetail({ sampleId, enabled = true }: UseSampleDetailOptions) {
    return useQuery({
        queryKey: sampleKeys.detail(sampleId || ''),
        queryFn: async () => {
            if (!sampleId) {
                throw new Error('Sample ID is required')
            }

            return fetchSampleDetail(sampleId)
        },
        // Only fetch if sampleId is provided and enabled is true
        enabled: enabled && !!sampleId,
        // Refetch on window focus to ensure fresh data
        refetchOnWindowFocus: true,
        // Keep data in cache for 10 minutes (longer than default)
        // Sample details don't change frequently
        staleTime: 10 * 60 * 1000, // 10 minutes
    })
}
