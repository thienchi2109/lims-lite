'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { makeQueryClient } from '@/lib/query-client'

interface AuthenticatedQueryBoundaryProps {
    principalKey: string
    children: React.ReactNode
}

function AuthenticatedQueryClientProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [queryClient] = useState(() => makeQueryClient())

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    )
}

export function AuthenticatedQueryBoundary({
    principalKey,
    children,
}: AuthenticatedQueryBoundaryProps) {
    return (
        <AuthenticatedQueryClientProvider key={principalKey}>
            {children}
        </AuthenticatedQueryClientProvider>
    )
}
