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

import { type ReactNode, useState, useSyncExternalStore } from 'react'
import { useMediaQuery } from '@/hooks/use-media-query'

interface MobileOnlyProps {
    children: ReactNode
    /** Tailwind-style breakpoint in pixels. Defaults to 1280 (xl). */
    breakpoint?: number
}

function createClientReadyStore() {
    let ready = false
    let readyTimeout: ReturnType<typeof setTimeout> | null = null
    const listeners = new Set<() => void>()

    return {
        getSnapshot: () => ready,
        subscribe: (listener: () => void) => {
            listeners.add(listener)
            if (!ready && !readyTimeout) {
                readyTimeout = setTimeout(() => {
                    ready = true
                    readyTimeout = null
                    listeners.forEach((notify) => notify())
                }, 0)
            }
            return () => {
                listeners.delete(listener)
                if (listeners.size === 0 && readyTimeout) {
                    clearTimeout(readyTimeout)
                    readyTimeout = null
                }
            }
        },
    }
}

const getServerSnapshot = () => false

export function MobileOnly({ children, breakpoint = 1280 }: MobileOnlyProps) {
    const isDesktop = useMediaQuery(`(min-width: ${breakpoint}px)`)
    const [clientReadyStore] = useState(createClientReadyStore)
    const hasMounted = useSyncExternalStore(
        clientReadyStore.subscribe,
        clientReadyStore.getSnapshot,
        getServerSnapshot
    )

    // Before mount: render nothing (prevents portal flash on desktop)
    // After mount: render only when viewport is below breakpoint
    if (!hasMounted || isDesktop) return null

    return <>{children}</>
}
