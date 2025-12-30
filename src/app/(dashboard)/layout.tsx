import type { ReactNode } from 'react'
import { SessionTimeboxGuard } from '@/components/auth/session-timebox-guard'
import { WalkthroughWrapper } from '@/components/walkthrough'
import { PageTransition } from '@/components/page-transition'

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <WalkthroughWrapper>
            <SessionTimeboxGuard />
            <PageTransition>
                {children}
            </PageTransition>
        </WalkthroughWrapper>
    )
}

