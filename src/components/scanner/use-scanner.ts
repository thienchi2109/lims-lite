'use client'

import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useRef,
} from 'react'

import type {
    ScannerConsumer,
    ScannerDispatcher,
} from '@/lib/scanner/scanner-dispatcher'
import type { ScannerEventKind } from '@/lib/scanner/scanner-event'

export type ScannerConnectionState =
    | 'unsupported'
    | 'permission_required'
    | 'connecting'
    | 'connected'
    | 'error'

export type ScannerConnection = {
    state: ScannerConnectionState
    error: string | null
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}

type ScannerContextValue = ScannerConnection & {
    registerConsumer: ScannerDispatcher['registerConsumer']
    registerLegacyCccdPayloadConsumer: (
        onPayload: (payload: string) => void | Promise<void>,
    ) => () => void
}

export type UseScannerConsumerOptions = {
    enabled: boolean
    kinds: readonly ScannerEventKind[]
    priority: number
    onEvent: ScannerConsumer['onEvent']
}

export const ScannerContext = createContext<ScannerContextValue | null>(null)

export function useOptionalScanner(): ScannerConnection | null {
    return useContext(ScannerContext)
}

export function useScanner(): ScannerConnection {
    const scanner = useOptionalScanner()
    if (!scanner) {
        throw new Error('useScanner must be used inside ScannerSerialProvider.')
    }
    return scanner
}

export function useScannerConsumer({
    enabled,
    kinds,
    priority,
    onEvent,
}: UseScannerConsumerOptions) {
    const scanner = useContext(ScannerContext)
    if (!scanner) {
        throw new Error('useScannerConsumer must be used inside ScannerSerialProvider.')
    }
    const { registerConsumer } = scanner
    const onEventRef = useRef(onEvent)
    const kindsKey = kinds.join('|')
    const stableKinds = useMemo(
        () => kindsKey.split('|').filter(Boolean) as ScannerEventKind[],
        [kindsKey],
    )

    useEffect(() => {
        onEventRef.current = onEvent
    }, [onEvent])

    useEffect(() => {
        if (!enabled) return

        return registerConsumer({
            kinds: stableKinds,
            priority,
            onEvent: (event) => onEventRef.current(event),
        })
    }, [enabled, priority, registerConsumer, stableKinds])
}

export function useLegacyCccdPayloadConsumer({
    enabled,
    onPayload,
}: {
    enabled: boolean
    onPayload: (payload: string) => void
}) {
    const scanner = useContext(ScannerContext)
    const registerLegacyCccdPayloadConsumer =
        scanner?.registerLegacyCccdPayloadConsumer
    const onPayloadRef = useRef(onPayload)

    useEffect(() => {
        onPayloadRef.current = onPayload
    }, [onPayload])

    useEffect(() => {
        if (!enabled || !registerLegacyCccdPayloadConsumer) return

        return registerLegacyCccdPayloadConsumer((payload) =>
            onPayloadRef.current(payload),
        )
    }, [enabled, registerLegacyCccdPayloadConsumer])
}
