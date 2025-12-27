'use client'

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
}

/**
 * Help button that triggers a walkthrough tour.
 * Place in page headers to allow users to replay tours.
 */
export function WalkthroughTrigger({ tourId, className }: WalkthroughTriggerProps) {
    const { startTour, isReady } = useWalkthrough()

    if (!isReady) {
        return null
    }

    return (
        <TooltipProvider>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className={className}
                        onClick={() => startTour(tourId)}
                        aria-label="Xem hướng dẫn"
                    >
                        <HelpCircle className="h-5 w-5 text-slate-500 hover:text-slate-700" />
                    </Button>
                </TooltipTrigger>
                <TooltipContent>
                    <p>Xem hướng dẫn sử dụng</p>
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    )
}
