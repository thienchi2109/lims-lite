import type { ReactNode } from 'react'
import { SessionTimeboxGuard } from '@/components/auth/session-timebox-guard'
import { WalkthroughWrapper } from '@/components/walkthrough'

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <WalkthroughWrapper>
            <SessionTimeboxGuard />
            {children}
        </WalkthroughWrapper>
    )
}

