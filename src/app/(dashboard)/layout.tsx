import type { ReactNode } from 'react'
import { createClient } from '@/lib/supabase/server'
import { SessionTimeboxGuard } from '@/components/auth/session-timebox-guard'
import { AuthenticatedQueryBoundary } from '@/components/auth/authenticated-query-boundary'
import { WalkthroughWrapper } from '@/components/walkthrough'
import { buildAuthenticatedPrincipalKey } from '@/lib/authenticated-query-cache'

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode
}) {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
        return (
            <WalkthroughWrapper>
                {children}
            </WalkthroughWrapper>
        )
    }

    const { data: userProfile, error: userProfileError } = await supabase
        .from('users')
        .select('role, can_access_confidential')
        .eq('id', user.id)
        .single()

    if (userProfileError) {
        console.error('Failed to resolve authenticated dashboard principal', userProfileError)
        throw new Error('Failed to resolve authenticated dashboard principal')
    }

    const principalKey = buildAuthenticatedPrincipalKey({
        userId: user.id,
        role: userProfile.role ?? null,
        canAccessConfidential: userProfile.can_access_confidential === true,
    })

    return (
        <WalkthroughWrapper>
            <AuthenticatedQueryBoundary principalKey={principalKey}>
                <SessionTimeboxGuard principalKey={principalKey} />
                {children}
            </AuthenticatedQueryBoundary>
        </WalkthroughWrapper>
    )
}
