import type { ReactNode } from 'react'
import { SessionTimeboxGuard } from '@/components/auth/session-timebox-guard'

export default function DashboardLayout({ children }: { children: ReactNode }) {
    return (
        <>
            <SessionTimeboxGuard />
            {children}
        </>
    )
}

