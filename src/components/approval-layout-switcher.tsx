'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

interface ApprovalLayoutSwitcherProps {
    desktop: ReactNode
    mobile: ReactNode
    initial?: ReactNode
    breakpoint?: number
}

export function ApprovalLayoutSwitcher({
    desktop,
    mobile,
    initial,
    breakpoint = 1280,
}: ApprovalLayoutSwitcherProps) {
    const mediaQuery = `(min-width: ${breakpoint}px)`
    const isDesktop = useSyncExternalStore(
        (onStoreChange) => {
            const queryList = window.matchMedia(mediaQuery)
            const handleChange = () => onStoreChange()

            queryList.addEventListener('change', handleChange)

            return () => {
                queryList.removeEventListener('change', handleChange)
            }
        },
        () => window.matchMedia(mediaQuery).matches,
        () => null,
    )

    if (isDesktop === null) {
        return <>{initial ?? null}</>
    }

    return <>{isDesktop ? desktop : mobile}</>
}
