'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WalkthroughProvider } from '@/components/walkthrough'

interface WalkthroughWrapperProps {
    children: ReactNode
}

/**
 * Client-side wrapper that fetches user ID and initializes WalkthroughProvider.
 * Used in dashboard layout to enable walkthrough functionality.
 */
export function WalkthroughWrapper({ children }: WalkthroughWrapperProps) {
    const [userId, setUserId] = useState<string | undefined>(undefined)

    useEffect(() => {
        async function fetchUserId() {
            const supabase = createClient()
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                setUserId(user.id)
            }
        }

        fetchUserId()
    }, [])

    return (
        <WalkthroughProvider userId={userId}>
            {children}
        </WalkthroughProvider>
    )
}
