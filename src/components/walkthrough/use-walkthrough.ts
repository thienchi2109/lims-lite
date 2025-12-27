'use client'

import { useContext, createContext } from 'react'

export type TourId = 'accession' | 'results' | 'approval'

export interface TourStatus {
    accession: Date | null
    results: Date | null
    approval: Date | null
}

export interface WalkthroughContextValue {
    /** Start a specific tour */
    startTour: (tourId: TourId) => void
    /** Tour completion status from database */
    tourStatus: TourStatus | null
    /** Whether Driver.js is ready */
    isReady: boolean
    /** Whether a tour is currently active */
    isActive: boolean
}

export const WalkthroughContext = createContext<WalkthroughContextValue | null>(null)

/**
 * Hook to access walkthrough functionality.
 * Must be used within WalkthroughProvider.
 */
export function useWalkthrough(): WalkthroughContextValue {
    const context = useContext(WalkthroughContext)

    if (!context) {
        // Return safe defaults if provider not mounted
        return {
            startTour: () => {
                console.warn('WalkthroughProvider not mounted')
            },
            tourStatus: null,
            isReady: false,
            isActive: false,
        }
    }

    return context
}
