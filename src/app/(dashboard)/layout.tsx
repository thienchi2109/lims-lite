import type { ReactNode } from 'react'
import { SessionTimeboxGuard } from '@/components/auth/session-timebox-guard'
import { AuthenticatedQueryBoundary } from '@/components/auth/authenticated-query-boundary'
import { WalkthroughWrapper } from '@/components/walkthrough'
import { getAuthenticatedDashboardSession } from '@/lib/dashboard-session'

export default async function DashboardLayout({
    children,
}: {
    children: ReactNode
}) {
    const dashboardSession = await getAuthenticatedDashboardSession()

    if (!dashboardSession) {
        return (
            <WalkthroughWrapper>
                {children}
            </WalkthroughWrapper>
        )
    }

    return (
        <WalkthroughWrapper>
            <AuthenticatedQueryBoundary principalKey={dashboardSession.principalKey}>
                <SessionTimeboxGuard principalKey={dashboardSession.principalKey} />
                {children}
            </AuthenticatedQueryBoundary>
        </WalkthroughWrapper>
    )
}
