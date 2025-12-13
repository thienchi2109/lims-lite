/**
 * TanStack Query Client Configuration
 * 
 * Configures the QueryClient with optimized defaults for the LIMS application:
 * - 5-minute stale time: Balances freshness with network efficiency
 * - 10-minute cache time: Keeps data in memory for quick navigation
 * - 3 retries: Handles transient network issues
 * - Window focus refetch: Ensures data is fresh when user returns to tab
 * - Reconnect refetch: Handles network interruptions gracefully
 */

import { QueryClient } from '@tanstack/react-query'

export function makeQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // Data is considered fresh for 5 minutes
                // This reduces unnecessary network requests while keeping data reasonably fresh
                staleTime: 5 * 60 * 1000, // 5 minutes

                // Cached data is kept in memory for 10 minutes
                // After this time, unused data is garbage collected
                gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime in v4)

                // Retry failed queries up to 3 times with exponential backoff
                // Helps handle transient network issues
                retry: 3,

                // Automatically refetch when browser tab regains focus
                // Ensures users always see fresh data when they return
                refetchOnWindowFocus: true,

                // Automatically refetch when network reconnects
                // Handles network interruptions gracefully
                refetchOnReconnect: true,

                // Disable automatic refetching on mount by default
                // We'll manually trigger refetches when needed
                refetchOnMount: false,
            },
            mutations: {
                // Retry mutations once on failure
                // Most mutations should not be retried automatically to avoid duplicate operations
                retry: 1,
            },
        },
    })
}

// Create a singleton instance for the browser
let browserQueryClient: QueryClient | undefined = undefined

export function getQueryClient() {
    if (typeof window === 'undefined') {
        // Server: always make a new query client
        return makeQueryClient()
    } else {
        // Browser: make a new query client if we don't already have one
        // This ensures we don't create a new client on every render
        if (!browserQueryClient) browserQueryClient = makeQueryClient()
        return browserQueryClient
    }
}
