'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

interface ApprovalLayoutSwitcherProps {
    desktop: ReactNode
    mobile: ReactNode
    breakpoint?: number
}

export function ApprovalLayoutSwitcher({
    desktop,
    mobile,
    breakpoint = 1280,
}: ApprovalLayoutSwitcherProps) {
    const isDesktop = useMediaQuery(`(min-width: ${breakpoint}px)`)
    const [hasMounted, setHasMounted] = useState(false)

    useEffect(() => {
        setHasMounted(true)
    }, [])

    if (!hasMounted) {
        return <>{desktop}</>
    }

    return <>{isDesktop ? desktop : mobile}</>
}
