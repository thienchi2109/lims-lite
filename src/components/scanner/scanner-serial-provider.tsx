'use client'

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react'

import { getBrowserScannerSerialApi } from '@/lib/scanner/browser-serial-api'
import { classifyScannerPayload } from '@/lib/scanner/classify-scanner-payload'
import { createScannerDispatcher } from '@/lib/scanner/scanner-dispatcher'
import {
    DEFAULT_SCANNER_SERIAL_BAUD_RATE,
    createScannerSerialFrameDecoder,
    getGrantedSerialPorts,
    type BrowserSerialPortLike,
    type BrowserSerialReaderLike,
    type ScannerSerialFrameDecoder,
} from '@/lib/scanner/web-serial-scanner'

import {
    ScannerContext,
    type ScannerConnectionState,
} from './use-scanner'

type ScannerSerialProviderProps = {
    principalKey: string
    children: ReactNode
}
type ReleaseConnectionOptions = {
    resetState: boolean
}
type LegacyPayloadConsumer = {
    activationOrder: number
    onPayload: (payload: string) => void | Promise<void>
}
function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Không thể kết nối scanner.'
}
function isPortSelectionCanceled(error: unknown): boolean {
    if (!(error instanceof Error)) return false
    return error.name === 'AbortError' || error.name === 'NotFoundError'
}

export function ScannerSerialProvider({
    principalKey,
    children,
}: ScannerSerialProviderProps) {
    const [state, setState] = useState<ScannerConnectionState>(() =>
        getBrowserScannerSerialApi() ? 'permission_required' : 'unsupported',
    )
    const [error, setError] = useState<string | null>(null)
    const [dispatcher] = useState(createScannerDispatcher)
    const isMountedRef = useRef(false)
    const isConnectingRef = useRef(false)
    const sessionTokenRef = useRef(0)
    const portRef = useRef<BrowserSerialPortLike | null>(null)
    const readerRef = useRef<BrowserSerialReaderLike | null>(null)
    const decoderRef = useRef<ScannerSerialFrameDecoder | null>(null)
    const releasePromiseRef = useRef<Promise<void>>(Promise.resolve())
    const legacyConsumersRef = useRef(new Map<number, LegacyPayloadConsumer>())
    const legacyActivationOrderRef = useRef(0)
    const registerLegacyCccdPayloadConsumer = useCallback(
        (onPayload: LegacyPayloadConsumer['onPayload']) => {
            legacyActivationOrderRef.current += 1
            const registrationId = legacyActivationOrderRef.current
            legacyConsumersRef.current.set(registrationId, {
                activationOrder: registrationId,
                onPayload,
            })

            return () => {
                legacyConsumersRef.current.delete(registrationId)
            }
        },
        [],
    )
    const dispatchPayload = useCallback(
        (payload: string) => {
            const event = classifyScannerPayload(payload)

            if (event.kind !== 'sample-code' && legacyConsumersRef.current.size > 0) {
                let selectedConsumer: LegacyPayloadConsumer | undefined

                for (const consumer of legacyConsumersRef.current.values()) {
                    if (
                        !selectedConsumer ||
                        consumer.activationOrder > selectedConsumer.activationOrder
                    ) {
                        selectedConsumer = consumer
                    }
                }

                if (selectedConsumer) {
                    try {
                        void Promise.resolve(selectedConsumer.onPayload(payload)).catch(
                            () => undefined,
                        )
                    } catch {
                        // Keep the reader alive while the legacy CCCD caller is retired.
                    }
                    return
                }
            }

            dispatcher.dispatch(event)
        },
        [dispatcher],
    )

    const releaseConnection = useCallback(
        async ({ resetState }: ReleaseConnectionOptions) => {
            sessionTokenRef.current += 1
            isConnectingRef.current = false

            const activeDecoder = decoderRef.current
            const activeReader = readerRef.current
            const activePort = portRef.current

            decoderRef.current = null
            readerRef.current = null
            portRef.current = null
            activeDecoder?.reset()

            try {
                await activeReader?.cancel()
            } catch {
                // Cleanup remains best-effort so reconnect stays available.
            }

            try {
                activeReader?.releaseLock()
            } catch {
                // The read loop may already have released the lock.
            }

            try {
                await activePort?.close()
            } catch {
                // Ignore close failures and allow an explicit reconnect.
            }

            if (!resetState || !isMountedRef.current) return

            setError(null)
            setState(
                getBrowserScannerSerialApi() ? 'permission_required' : 'unsupported',
            )
        },
        [],
    )

    const connectToPort = useCallback(
        async (port: BrowserSerialPortLike) => {
            await releaseConnection({ resetState: false })
            if (!isMountedRef.current) return

            const token = sessionTokenRef.current + 1
            sessionTokenRef.current = token
            isConnectingRef.current = true
            setError(null)
            setState('connecting')

            let portOpened = false

            try {
                await port.open({ baudRate: DEFAULT_SCANNER_SERIAL_BAUD_RATE })
                portOpened = true

                if (!isMountedRef.current || sessionTokenRef.current !== token) {
                    await port.close().catch(() => undefined)
                    return
                }

                if (!port.readable) {
                    throw new Error('Scanner không cung cấp luồng dữ liệu để đọc.')
                }

                const reader = port.readable.getReader()
                const decoder = createScannerSerialFrameDecoder({
                    onPayload: dispatchPayload,
                })

                portRef.current = port
                readerRef.current = reader
                decoderRef.current = decoder
                isConnectingRef.current = false
                setState('connected')

                void (async () => {
                    let readError: unknown = null

                    try {
                        while (sessionTokenRef.current === token) {
                            const { value, done } = await reader.read()
                            if (sessionTokenRef.current !== token) return
                            if (done) break
                            if (value) decoder.push(value)
                        }

                        decoder.flush()
                    } catch (caughtError) {
                        readError = caughtError
                    } finally {
                        decoder.reset()
                        isConnectingRef.current = false

                        if (readerRef.current === reader) {
                            readerRef.current = null
                            decoderRef.current = null
                            try {
                                reader.releaseLock()
                            } catch {
                                // The connection cleanup may own lock release.
                            }
                        }

                        if (sessionTokenRef.current !== token) return
                        if (portRef.current === port) portRef.current = null
                        await port.close().catch(() => undefined)
                        if (sessionTokenRef.current !== token || !isMountedRef.current) return

                        if (readError) {
                            setError(getErrorMessage(readError))
                            setState('error')
                        } else {
                            setState('permission_required')
                        }
                    }
                })()
            } catch (connectError) {
                isConnectingRef.current = false
                if (portOpened) await port.close().catch(() => undefined)
                if (!isMountedRef.current || sessionTokenRef.current !== token) return

                setError(getErrorMessage(connectError))
                setState('error')
            }
        },
        [dispatchPayload, releaseConnection],
    )

    const connect = useCallback(async () => {
        const serialApi = getBrowserScannerSerialApi()
        if (!serialApi) {
            setState('unsupported')
            return
        }
        if (isConnectingRef.current) return

        isConnectingRef.current = true
        setError(null)
        setState('connecting')
        await releasePromiseRef.current
        if (!isMountedRef.current) return

        try {
            const port = await serialApi.requestPort()
            if (!isMountedRef.current) return
            await connectToPort(port)
        } catch (connectError) {
            if (!isMountedRef.current) return
            isConnectingRef.current = false
            if (isPortSelectionCanceled(connectError)) {
                setState('permission_required')
                return
            }

            setError(getErrorMessage(connectError))
            setState('error')
        }
    }, [connectToPort])

    const disconnect = useCallback(async () => {
        const releasePromise = releaseConnection({ resetState: true })
        releasePromiseRef.current = releasePromise
        await releasePromise
    }, [releaseConnection])

    useEffect(() => {
        isMountedRef.current = true
        let cancelled = false
        const serialApi = getBrowserScannerSerialApi()

        if (!serialApi) {
            setState('unsupported')
        } else {
            isConnectingRef.current = true
            setError(null)
            setState('connecting')

            void (async () => {
                await releasePromiseRef.current
                if (cancelled || !isMountedRef.current) return

                try {
                    const [grantedPort] = await getGrantedSerialPorts(serialApi)
                    if (cancelled || !isMountedRef.current) return
                    if (!grantedPort) {
                        isConnectingRef.current = false
                        setState('permission_required')
                        return
                    }
                    await connectToPort(grantedPort)
                } catch (resumeError) {
                    if (cancelled || !isMountedRef.current) return
                    isConnectingRef.current = false
                    setError(getErrorMessage(resumeError))
                    setState('error')
                }
            })()
        }

        return () => {
            cancelled = true
            isMountedRef.current = false
            const releasePromise = releaseConnection({ resetState: false })
            releasePromiseRef.current = releasePromise
        }
    }, [connectToPort, principalKey, releaseConnection])

    const contextValue = useMemo(
        () => ({
            state,
            error,
            connect,
            disconnect,
            registerConsumer: dispatcher.registerConsumer,
            registerLegacyCccdPayloadConsumer,
        }),
        [
            connect,
            disconnect,
            dispatcher,
            error,
            registerLegacyCccdPayloadConsumer,
            state,
        ],
    )

    return (
        <ScannerContext.Provider value={contextValue}>
            {children}
        </ScannerContext.Provider>
    )
}
