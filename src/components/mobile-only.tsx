'use client'

/**
 * MobileOnly
 *
 * Client wrapper that conditionally renders children only when
 * the viewport is below the xl breakpoint (1280px).
 *
 * Purpose: Prevent React portal-based components (e.g. vaul Drawer)
 * from mounting on desktop. CSS `xl:hidden` only hides the parent
 * div — portals render to document.body and escape the CSS rule.
 */

import { type ReactNode, useState, useEffect } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

interface MobileOnlyProps {
    children: ReactNode
    /** Tailwind-style breakpoint in pixels. Defaults to 1280 (xl). */
    breakpoint?: number
}

export function MobileOnly({ children, breakpoint = 1280 }: MobileOnlyProps) {
    const isDesktop = useMediaQuery(`(min-width: ${breakpoint}px)`)
    const [hasMounted, setHasMounted] = useState(false)

    useEffect(() => { setHasMounted(true) }, [])

    // Before mount: render nothing (prevents portal flash on desktop)
    // After mount: render only when viewport is below breakpoint
    if (!hasMounted || isDesktop) return null

    return <>{children}</>
}
