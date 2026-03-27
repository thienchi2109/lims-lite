'use client'

/**
 * useClient Hook
 *
 * TanStack Query hook for fetching a client's details.
 * Automatically caches data and deduplicates requests.
 *
 * Features:
 * - Automatic caching (5 minutes stale time)
 * - Request deduplication across components
 * - Background refetching on window focus
 * - Error handling with retry logic
 *
 * @example
 * const { data: client, isLoading, error } = useClient({ clientId: 'uuid' })
 */

import { useQuery } from '@tanstack/react-query'
import { clientKeys } from '@/types/query-keys'
import { getClientClient } from '@/lib/api-client'
import type { Client } from '@/types'

interface UseClientOptions {
    /**
     * Client ID to fetch. Pass null to disable the query.
     */
    clientId: string | null

    /**
     * Immediate placeholder data to render while the fresh client query loads.
     */
    placeholderData?: Client
}

export function useClient({ clientId, placeholderData }: UseClientOptions) {
    return useQuery({
        queryKey: clientKeys.detail(clientId),
        queryFn: async (): Promise<Client> => {
            if (!clientId) {
                throw new Error('Client ID is required')
            }

            const result = await getClientClient(clientId)

            if ('error' in result) {
                throw new Error(result.error)
            }

            if (!result.data) {
                throw new Error('Không thể tải thông tin khách hàng')
            }

            return result.data as Client
        },
        // Only fetch if clientId is provided
        enabled: !!clientId,
        // Cache for 5 minutes - client data doesn't change frequently
        staleTime: 5 * 60 * 1000,
        // Refetch on window focus to ensure fresh data
        refetchOnWindowFocus: true,
        placeholderData,
    })
}
