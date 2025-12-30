'use client'

import { motion, AnimatePresence } from 'motion/react'
import { usePathname } from 'next/navigation'
import { durations, pageTransition } from '@/lib/motion'

interface PageTransitionProps {
    children: React.ReactNode
}

/**
 * Page transition wrapper for smooth route changes
 *
 * Wraps page content with AnimatePresence to enable:
 * - Fade out current page (150ms)
 * - Fade in new page (150ms)
 * - Total transition ~300ms
 *
 * Usage: Wrap {children} in dashboard layout
 */
export function PageTransition({ children }: PageTransitionProps) {
    const pathname = usePathname()

    return (
        <AnimatePresence mode="wait">
            <motion.div
                key={pathname}
                initial={pageTransition.initial}
                animate={pageTransition.animate}
                exit={pageTransition.exit}
                transition={{ duration: durations.fast }}
                className="h-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    )
}
