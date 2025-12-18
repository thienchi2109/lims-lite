'use client'

/**
 * Search Hooks
 *
 * TanStack Query hooks for PostgreSQL full-text search.
 * Provides real-time search capabilities with debouncing and caching.
 *
 * Features:
 * - Automatic query caching (1 minute stale time)
 * - Debounced queries to reduce server load
 * - Minimal 2-character query length
 * - Error handling with retry logic
 *
 * @example
 * const { data, isLoading, error } = useSearchSamples('ABC-123')
 */

import { useQuery } from '@tanstack/react-query'
import {
    searchSamplesClient,
    searchClientsClient,
    searchAssaysClient,
    searchResultsClient,
    searchAuditLogsClient,
    globalSearchClient,
} from '@/lib/api-client'
import { searchKeys } from '@/types/query-keys'
import type {
    SearchSampleResult,
    SearchClientResult,
    SearchAssayResult,
    SearchResultResult,
    SearchAuditLogResult,
    GlobalSearchResult,
} from '@/types'

interface UseSearchOptions {
    /**
     * Search query string (min 2 characters)
     */
    query: string

    /**
     * Maximum number of results to return
     * @default 20
     */
    maxResults?: number

    /**
     * Enable/disable the query
     * Useful for conditional fetching or debouncing
     * @default true if query.trim().length >= 2
     */
    enabled?: boolean
}

/**
 * Hook for searching samples
 * Returns: id, sample_id, client_name, type, status, received_at, rank
 */
export function useSearchSamples({ query, maxResults = 20, enabled }: UseSearchOptions) {
    const trimmedQuery = query.trim()
    const isEnabled = enabled !== undefined ? enabled : trimmedQuery.length >= 2

    return useQuery({
        queryKey: searchKeys.samples(trimmedQuery, maxResults),
        queryFn: async () => {
            const result = await searchSamplesClient(trimmedQuery, maxResults)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data as SearchSampleResult[]
        },
        enabled: isEnabled,
        // Search queries are fresh for 1 minute (reduce server load)
        staleTime: 1 * 60 * 1000, // 1 minute
        // Cache for 5 minutes (quick re-searches)
        gcTime: 5 * 60 * 1000, // 5 minutes
        // Keep previous results while fetching new ones (better UX)
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Hook for searching clients
 * Returns: id, name, phone, address, rank
 */
export function useSearchClients({ query, maxResults = 20, enabled }: UseSearchOptions) {
    const trimmedQuery = query.trim()
    const isEnabled = enabled !== undefined ? enabled : trimmedQuery.length >= 2

    return useQuery({
        queryKey: searchKeys.clients(trimmedQuery, maxResults),
        queryFn: async () => {
            const result = await searchClientsClient(trimmedQuery, maxResults)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data as SearchClientResult[]
        },
        enabled: isEnabled,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Hook for searching assays
 * Returns: id, name, units, rank
 */
export function useSearchAssays({ query, maxResults = 20, enabled }: UseSearchOptions) {
    const trimmedQuery = query.trim()
    const isEnabled = enabled !== undefined ? enabled : trimmedQuery.length >= 2

    return useQuery({
        queryKey: searchKeys.assays(trimmedQuery, maxResults),
        queryFn: async () => {
            const result = await searchAssaysClient(trimmedQuery, maxResults)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data as SearchAssayResult[]
        },
        enabled: isEnabled,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Hook for searching results
 * Returns: id, sample_id, assay_id, value, status, rank
 */
export function useSearchResults({ query, maxResults = 20, enabled }: UseSearchOptions) {
    const trimmedQuery = query.trim()
    const isEnabled = enabled !== undefined ? enabled : trimmedQuery.length >= 2

    return useQuery({
        queryKey: searchKeys.results(trimmedQuery, maxResults),
        queryFn: async () => {
            const result = await searchResultsClient(trimmedQuery, maxResults)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data as SearchResultResult[]
        },
        enabled: isEnabled,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Hook for searching audit logs (manager only)
 * Returns: id, operation, table_name, changed_at, rank
 */
export function useSearchAuditLogs({ query, maxResults = 20, enabled }: UseSearchOptions) {
    const trimmedQuery = query.trim()
    const isEnabled = enabled !== undefined ? enabled : trimmedQuery.length >= 2

    return useQuery({
        queryKey: searchKeys.auditLogs(trimmedQuery, maxResults),
        queryFn: async () => {
            const result = await searchAuditLogsClient(trimmedQuery, maxResults)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data as SearchAuditLogResult[]
        },
        enabled: isEnabled,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })
}

/**
 * Hook for global search across all entities
 * Returns: entity_type, entity_id, description, rank
 */
export function useGlobalSearch({ query, maxResults = 20, enabled }: UseSearchOptions) {
    const trimmedQuery = query.trim()
    const isEnabled = enabled !== undefined ? enabled : trimmedQuery.length >= 2

    return useQuery({
        queryKey: searchKeys.global(trimmedQuery, maxResults),
        queryFn: async () => {
            const result = await globalSearchClient(trimmedQuery, maxResults)

            if ('error' in result) {
                throw new Error(result.error)
            }

            return result.data as GlobalSearchResult[]
        },
        enabled: isEnabled,
        staleTime: 1 * 60 * 1000,
        gcTime: 5 * 60 * 1000,
        placeholderData: (previousData) => previousData,
    })
}
