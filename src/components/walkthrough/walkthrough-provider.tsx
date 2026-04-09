'use client'

import { useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { driverConfig } from '@/lib/walkthrough/driver-config'
import { WalkthroughContext, type TourId, type TourStatus } from './use-walkthrough'
import { getTourStatus, markTourCompleted } from '@/app/actions/walkthrough'

// Tour step definitions will be imported from separate files
import { accessionTourSteps } from './tours/accession-tour'
import { resultsTourSteps } from './tours/results-tour'
import { approvalTourSteps } from './tours/approval-tour'
import { coaTourSteps } from './tours/coa-tour'
import { iqcAnalystTourSteps } from './tours/iqc-analyst-tour'
import { iqcManagerTourSteps } from './tours/iqc-manager-tour'

interface WalkthroughProviderProps {
    children: ReactNode
    userId?: string
}

const subscribeToClientReady = () => () => undefined
const getClientReadySnapshot = () => true
const getServerReadySnapshot = () => false

/**
 * Provider that initializes Driver.js and manages tour state.
 * Fetches tour completion status from database on mount.
 * Auto-starts tours for first-time users on relevant pages.
 */
export function WalkthroughProvider({ children, userId }: WalkthroughProviderProps) {
    const driverInstanceRef = useRef<Driver | null>(null)
    const [tourStatus, setTourStatus] = useState<TourStatus | null>(null)
    const [isActive, setIsActive] = useState(false)
    const isReady = useSyncExternalStore(
        subscribeToClientReady,
        getClientReadySnapshot,
        getServerReadySnapshot
    )

    // Destroy Driver.js on unmount if a tour initialized it.
    useEffect(() => {
        return () => {
            driverInstanceRef.current?.destroy()
            driverInstanceRef.current = null
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
            case 'coa':
                return coaTourSteps
            case 'iqc-analyst':
                return iqcAnalystTourSteps
            case 'iqc-manager':
                return iqcManagerTourSteps
            default:
                return []
        }
    }, [])

    const getDriverInstance = useCallback(() => {
        driverInstanceRef.current ??= driver(driverConfig)
        return driverInstanceRef.current
    }, [])

    // Start a tour
    const startTour = useCallback((tourId: TourId) => {
        if (!isReady) {
            console.warn('Driver.js not ready')
            return
        }

        const driverInstance = getDriverInstance()

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
    }, [getDriverInstance, isReady, getTourSteps, userId])

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
