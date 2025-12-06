'use client'

/**
 * QueryProvider Component
 * 
 * Wraps the application with TanStack Query's QueryClientProvider.
 * This enables all child components to use query hooks (useQuery, useMutation, etc.)
 * 
 * Features:
 * - Provides QueryClient to all child components
 * - Includes React Query DevTools in development mode for debugging
 * - Handles server-side rendering correctly
 */

import { QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { getQueryClient } from '@/lib/query-client'
import { useState } from 'react'

interface QueryProviderProps {
    children: React.ReactNode
}

export function QueryProvider({ children }: QueryProviderProps) {
    // Create a stable QueryClient instance
    // We use useState to ensure the client is created only once per component mount
    const [queryClient] = useState(() => getQueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            {children}
            {/* React Query DevTools - only visible in development */}
            {process.env.NODE_ENV === 'development' && (
                <ReactQueryDevtools
                    initialIsOpen={false}
                    buttonPosition="bottom-right"
                />
            )}
        </QueryClientProvider>
    )
}
