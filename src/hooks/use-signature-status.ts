'use client'

/**
 * useSignatureStatus Hook
 *
 * TanStack Query hook for checking user's signature status.
 * Used by the submit flow to show warnings and disable submission if no signature exists.
 *
 * Features:
 * - Prefetches on mount to avoid waterfalls
 * - 5-minute stale time (signatures don't change often)
 * - Exposes hasSignature boolean for easy checks
 *
 * @example
 * const { hasSignature, signature, isLoading, refetch } = useSignatureStatus()
 *
 * if (!hasSignature) {
 *     // Show warning or disable submission button
 * }
 */

import { useQuery } from '@tanstack/react-query'
import { getActiveSignature } from '@/app/actions/signatures'
import { signatureKeys } from '@/types/query-keys'
import type { ActiveSignature } from '@/types'

interface SignatureStatus {
    /** Whether the user has an active signature uploaded */
    hasSignature: boolean
    /** The active signature data, or null if none exists */
    signature: ActiveSignature | null
    /** Loading state */
    isLoading: boolean
    /** Error object if the query failed */
    error: Error | null
    /** Function to manually refetch signature status */
    refetch: () => void
}

export function useSignatureStatus(): SignatureStatus {
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: signatureKeys.status,
        queryFn: async () => {
            // Call server action without parameters (uses current user)
            const result = await getActiveSignature()

            return {
                hasSignature: result.success,
                signature: result.success ? result.signature : null,
            }
        },
        // 5 minutes - signatures don't change often during a session
        staleTime: 5 * 60 * 1000,
        // 10 minutes garbage collection
        gcTime: 10 * 60 * 1000,
        // Don't refetch on window focus - signature rarely changes
        refetchOnWindowFocus: false,
    })

    return {
        hasSignature: data?.hasSignature ?? false,
        signature: data?.signature ?? null,
        isLoading,
        error: error as Error | null,
        refetch,
    }
}
