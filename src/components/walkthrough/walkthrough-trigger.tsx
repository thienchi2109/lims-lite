'use client'

import { useEffect, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { useWalkthrough, type TourId } from './use-walkthrough'

interface WalkthroughTriggerProps {
    tourId: TourId
    className?: string
    /** Auto-show tooltip on mount for a few seconds to attract attention */
    autoShowTooltip?: boolean
    /** Duration in ms to show tooltip (default: 5000) */
    tooltipDuration?: number
    /** Show hover/focus tooltip around the button */
    showTooltip?: boolean
}

/**
 * Help button that triggers a walkthrough tour.
 * Place in page headers to allow users to replay tours.
 * Can auto-show tooltip on mount to attract user attention.
 */
export function WalkthroughTrigger({
    tourId,
    className,
    autoShowTooltip = true,
    tooltipDuration = 5000,
    showTooltip = true,
}: WalkthroughTriggerProps) {
    const { startTour, isReady, tourStatus } = useWalkthrough()
    const [isTooltipOpen, setIsTooltipOpen] = useState(false)

    // Check if this tour has been completed
    const isTourCompleted = tourStatus?.[tourId] !== null

    // Auto-show tooltip on mount if tour not completed
    useEffect(() => {
        if (!isReady || !showTooltip || !autoShowTooltip || isTourCompleted) return

        // Small delay to let the page render first
        const showTimeout = setTimeout(() => {
            setIsTooltipOpen(true)
        }, 500)

        // Auto-hide after duration
        const hideTimeout = setTimeout(() => {
            setIsTooltipOpen(false)
        }, 500 + tooltipDuration)

        return () => {
            clearTimeout(showTimeout)
            clearTimeout(hideTimeout)
        }
    }, [isReady, autoShowTooltip, tooltipDuration, isTourCompleted])

    if (!isReady) {
        return null
    }

    const triggerButton = (
        <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:border-sky-300 hover:text-sky-700 transition-all ${
                !isTourCompleted ? 'animate-pulse' : ''
            } ${className ?? ''}`}
            onClick={() => {
                setIsTooltipOpen(false)
                startTour(tourId)
            }}
            aria-label="Xem hướng dẫn"
        >
            <HelpCircle className="h-4 w-4" />
            <span className="text-xs font-medium">Hướng dẫn</span>
        </Button>
    )

    if (!showTooltip) {
        return triggerButton
    }

    return (
        <TooltipProvider>
            <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
                <TooltipTrigger asChild>
                    {triggerButton}
                </TooltipTrigger>
                <TooltipContent
                    side="bottom"
                    className="bg-sky-600 text-white border-sky-700"
                >
                    <p className="font-medium">Bấm để xem hướng dẫn sử dụng trang này</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
