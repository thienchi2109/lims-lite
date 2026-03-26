import { describe, expect, it } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { sampleKeys } from '@/types/query-keys'
import { AuthenticatedQueryBoundary } from '../authenticated-query-boundary'
import { buildAuthenticatedPrincipalKey } from '@/lib/authenticated-query-cache'

const sampleParams = {
    scope: 'active' as const,
    page: 1,
    pageSize: 20,
    sortOrder: 'asc' as const,
}

const cachedSamples = [{ id: 'hiv-1', sample_id: 'HIV-001' }]

function createRootClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })
}

describe('AuthenticatedQueryBoundary', () => {
    it('replaces the query client when the authenticated user changes, even if role and confidentiality stay the same', async () => {
        const rootQueryClient = createRootClient()
        const seenClients: QueryClient[] = []
        const firstManagerKey = buildAuthenticatedPrincipalKey({
            userId: 'manager-1',
            role: 'manager',
            canAccessConfidential: false,
        })
        const secondManagerKey = buildAuthenticatedPrincipalKey({
            userId: 'manager-2',
            role: 'manager',
            canAccessConfidential: false,
        })

        function QueryClientProbe() {
            const queryClient = useQueryClient()

            useEffect(() => {
                seenClients.push(queryClient)
            }, [queryClient])

            return null
        }

        const { rerender } = render(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={firstManagerKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients).toHaveLength(1)
        })

        const initialClient = seenClients[0]
        initialClient.setQueryData(sampleKeys.list(sampleParams), cachedSamples)

        rerender(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={secondManagerKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients).toHaveLength(2)
        })

        const replacementClient = seenClients[1]

        expect(replacementClient).not.toBe(initialClient)
        expect(replacementClient.getQueryData(sampleKeys.list(sampleParams))).toBeUndefined()
    })

    it('preserves the same query client for the same principal and replaces it when confidentiality access changes', async () => {
        const rootQueryClient = createRootClient()
        const seenClients: QueryClient[] = []
        const managerKey = buildAuthenticatedPrincipalKey({
            userId: 'manager-1',
            role: 'manager',
            canAccessConfidential: false,
        })
        const managerHivKey = buildAuthenticatedPrincipalKey({
            userId: 'manager-1',
            role: 'manager',
            canAccessConfidential: true,
        })

        function QueryClientProbe() {
            const queryClient = useQueryClient()

            useEffect(() => {
                seenClients.push(queryClient)
            }, [queryClient])

            return null
        }

        const { rerender } = render(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={managerKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients).toHaveLength(1)
        })

        const initialClient = seenClients[0]
        initialClient.setQueryData(sampleKeys.list(sampleParams), cachedSamples)

        expect(initialClient.getQueryData(sampleKeys.list(sampleParams))).toEqual(cachedSamples)
        expect(rootQueryClient.getQueryData(sampleKeys.list(sampleParams))).toBeUndefined()

        rerender(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={managerKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients.at(-1)).toBe(initialClient)
        })

        rerender(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={managerHivKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients).toHaveLength(2)
        })

        const replacementClient = seenClients[1]

        expect(replacementClient).not.toBe(initialClient)
        expect(replacementClient.getQueryData(sampleKeys.list(sampleParams))).toBeUndefined()
    })

    it('replaces the query client when only the authenticated role changes', async () => {
        const rootQueryClient = createRootClient()
        const seenClients: QueryClient[] = []
        const managerKey = buildAuthenticatedPrincipalKey({
            userId: 'staff-1',
            role: 'manager',
            canAccessConfidential: false,
        })
        const analystKey = buildAuthenticatedPrincipalKey({
            userId: 'staff-1',
            role: 'analyst',
            canAccessConfidential: false,
        })

        function QueryClientProbe() {
            const queryClient = useQueryClient()

            useEffect(() => {
                seenClients.push(queryClient)
            }, [queryClient])

            return null
        }

        const { rerender } = render(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={managerKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients).toHaveLength(1)
        })

        const initialClient = seenClients[0]
        initialClient.setQueryData(sampleKeys.list(sampleParams), cachedSamples)

        rerender(
            <QueryClientProvider client={rootQueryClient}>
                <AuthenticatedQueryBoundary principalKey={analystKey}>
                    <QueryClientProbe />
                </AuthenticatedQueryBoundary>
            </QueryClientProvider>,
        )

        await waitFor(() => {
            expect(seenClients).toHaveLength(2)
        })

        const replacementClient = seenClients[1]

        expect(replacementClient).not.toBe(initialClient)
        expect(replacementClient.getQueryData(sampleKeys.list(sampleParams))).toBeUndefined()
    })
})
