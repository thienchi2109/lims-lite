import type { QueryClient } from '@tanstack/react-query'

interface AuthenticatedPrincipalScope {
    userId: string
    role: string | null
    canAccessConfidential: boolean
}

export function buildAuthenticatedPrincipalKey({
    userId,
    role,
    canAccessConfidential,
}: AuthenticatedPrincipalScope) {
    return [
        userId,
        role ?? 'unknown',
        canAccessConfidential ? 'confidential' : 'standard',
    ].join(':')
}

export function clearAuthenticatedQueryCache(queryClient: Pick<QueryClient, 'clear'>) {
    queryClient.clear()
}
