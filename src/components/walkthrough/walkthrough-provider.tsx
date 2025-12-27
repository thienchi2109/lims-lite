'use client'

import { useEffect, useState, useCallback, useMemo, type ReactNode } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { driverConfig } from '@/lib/walkthrough/driver-config'
import { WalkthroughContext, type TourId, type TourStatus } from './use-walkthrough'
import { getTourStatus, markTourCompleted } from '@/app/actions/walkthrough'

// Tour step definitions will be imported from separate files
import { accessionTourSteps } from './tours/accession-tour'
import { resultsTourSteps } from './tours/results-tour'
import { approvalTourSteps } from './tours/approval-tour'

interface WalkthroughProviderProps {
    children: ReactNode
    userId?: string
}

/**
 * Provider that initializes Driver.js and manages tour state.
 * Fetches tour completion status from database on mount.
 * Auto-starts tours for first-time users on relevant pages.
 */
export function WalkthroughProvider({ children, userId }: WalkthroughProviderProps) {
    const [driverInstance, setDriverInstance] = useState<Driver | null>(null)
    const [tourStatus, setTourStatus] = useState<TourStatus | null>(null)
    const [isActive, setIsActive] = useState(false)
    const [isReady, setIsReady] = useState(false)

    // Initialize Driver.js on mount
    useEffect(() => {
        const instance = driver(driverConfig)
        setDriverInstance(instance)
        setIsReady(true)

        return () => {
            instance.destroy()
        }
    }, [])

    // Fetch tour status from database
    useEffect(() => {
        if (!userId) return

        async function fetchStatus() {
            const status = await getTourStatus(userId!)
            setTourStatus(status)
        }

        fetchStatus()
    }, [userId])

    // Get tour steps by ID
    const getTourSteps = useCallback((tourId: TourId) => {
        switch (tourId) {
            case 'accession':
                return accessionTourSteps
            case 'results':
                return resultsTourSteps
            case 'approval':
                return approvalTourSteps
            default:
                return []
        }
    }, [])

    // Start a tour
    const startTour = useCallback((tourId: TourId) => {
        if (!driverInstance || !isReady) {
            console.warn('Driver.js not ready')
            return
        }

        const steps = getTourSteps(tourId)
        if (steps.length === 0) {
            console.warn(`No steps defined for tour: ${tourId}`)
            return
        }

        setIsActive(true)

        driverInstance.setConfig({
            ...driverConfig,
            steps,
            onDestroyStarted: () => {
                setIsActive(false)
                // Mark tour as completed when finished
                if (userId) {
                    markTourCompleted(userId, tourId).then((newStatus) => {
                        if (newStatus) {
                            setTourStatus(newStatus)
                        }
                    })
                }
                driverInstance.destroy()
            },
        })

        driverInstance.drive()
    }, [driverInstance, isReady, getTourSteps, userId])

    const contextValue = useMemo(() => ({
        startTour,
        tourStatus,
        isReady,
        isActive,
    }), [startTour, tourStatus, isReady, isActive])

    return (
        <WalkthroughContext.Provider value={contextValue}>
            {children}
        </WalkthroughContext.Provider>
    )
}
