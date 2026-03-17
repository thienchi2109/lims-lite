'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
    DEFAULT_CCCD_SERIAL_BAUD_RATE,
    createCccdSerialFrameDecoder,
    getGrantedSerialPorts,
    getWebSerialApi,
    type BrowserSerialPortLike,
    type BrowserSerialReaderLike,
} from '@/lib/qr/web-serial-cccd'

type SerialConnectionState =
    | 'unsupported'
    | 'permission_required'
    | 'connecting'
    | 'connected'
    | 'error'

type UseCccdSerialControllerOptions = {
    active: boolean
    onPayload: (payload: string) => void
}

type UseCccdSerialControllerResult = {
    state: SerialConnectionState
    error: string | null
    connect: () => Promise<void>
    disconnect: () => Promise<void>
}

type ReleaseConnectionOptions = {
    resetState: boolean
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) return error.message
    return 'Không thể kết nối scanner CCCD.'
}

function getBrowserSerialApi() {
    if (typeof window === 'undefined') return null
    return getWebSerialApi(
        window.navigator as Navigator & {
            serial?: {
                requestPort?: unknown
                getPorts?: unknown
            }
        },
    )
}

function isPortSelectionCanceled(error: unknown): boolean {
    if (!(error instanceof Error)) return false

    return error.name === 'AbortError' || error.name === 'NotFoundError'
}

export function useCccdSerialController({
    active,
    onPayload,
}: UseCccdSerialControllerOptions): UseCccdSerialControllerResult {
    const [state, setState] = useState<SerialConnectionState>(() =>
        getBrowserSerialApi() ? 'permission_required' : 'unsupported',
    )
    const [error, setError] = useState<string | null>(null)

    const onPayloadRef = useRef(onPayload)
    const isMountedRef = useRef(true)
    const portRef = useRef<BrowserSerialPortLike | null>(null)
    const readerRef = useRef<BrowserSerialReaderLike | null>(null)
    const isConnectingRef = useRef(false)
    const sessionTokenRef = useRef(0)

    useEffect(() => {
        onPayloadRef.current = onPayload
    }, [onPayload])

    const isSessionActive = useCallback((token?: number) => {
        if (!isMountedRef.current) return false
        if (token === undefined) return true
        return sessionTokenRef.current === token
    }, [])

    const releaseConnection = useCallback(async ({ resetState }: ReleaseConnectionOptions) => {
        sessionTokenRef.current += 1
        isConnectingRef.current = false

        const activeReader = readerRef.current
        const activePort = portRef.current

        readerRef.current = null
        portRef.current = null

        try {
            await activeReader?.cancel()
        } catch {
            // Best-effort cleanup; disconnect should stay recoverable.
        }

        try {
            activeReader?.releaseLock()
        } catch {
            // Ignore duplicate release attempts during teardown.
        }

        try {
            await activePort?.close()
        } catch {
            // Ignore close failures and allow user to reconnect.
        }

        if (resetState) {
            if (getBrowserSerialApi()) {
                setState('permission_required')
                setError(null)
            } else {
                setState('unsupported')
            }
        }
    }, [])

    const disconnect = useCallback(async () => {
        await releaseConnection({ resetState: true })
    }, [releaseConnection])

    const connectToPort = useCallback(
        async (port: BrowserSerialPortLike) => {
            await releaseConnection({ resetState: false })
            if (!isSessionActive()) return

            const token = sessionTokenRef.current + 1
            sessionTokenRef.current = token

            setError(null)
            isConnectingRef.current = true
            setState('connecting')

            try {
                await port.open({ baudRate: DEFAULT_CCCD_SERIAL_BAUD_RATE })
                if (!isSessionActive(token)) {
                    isConnectingRef.current = false

                    try {
                        await port.close()
                    } catch {
                        // Port may already be closing after teardown.
                    }
                    return
                }

                if (!port.readable) {
                    throw new Error('Scanner CCCD không cung cấp luồng dữ liệu để đọc.')
                }

                const reader = port.readable.getReader()
                const decoder = createCccdSerialFrameDecoder({
                    onPayload: (payload) => onPayloadRef.current(payload),
                })

                portRef.current = port
                readerRef.current = reader
                isConnectingRef.current = false
                setState('connected')

                void (async () => {
                    try {
                        while (sessionTokenRef.current === token) {
                            const { value, done } = await reader.read()

                            if (sessionTokenRef.current !== token) return
                            if (done) break
                            if (value) decoder.push(value)
                        }

                        decoder.flush()
                    } catch (readError) {
                        if (sessionTokenRef.current !== token) return

                        setError(getErrorMessage(readError))
                        setState('error')
                    } finally {
                        isConnectingRef.current = false

                        try {
                            reader.releaseLock()
                        } catch {
                            // Lock might already be released during teardown.
                        }

                        if (readerRef.current === reader) {
                            readerRef.current = null
                        }

                        if (sessionTokenRef.current !== token) return
                        portRef.current = null

                        try {
                            await port.close()
                        } catch {
                            // Ignore cleanup failures after read loop exits.
                        }

                        if (active) {
                            setState((currentState) =>
                                currentState === 'error' ? currentState : 'permission_required',
                            )
                        }
                    }
                })()
            } catch (error) {
                isConnectingRef.current = false
                if (!isSessionActive(token)) {
                    try {
                        await port.close()
                    } catch {
                        // Ignore teardown races after unmount.
                    }
                    return
                }
                throw error
            }
        },
        [active, isSessionActive, releaseConnection],
    )

    const connect = useCallback(async () => {
        const serialApi = getBrowserSerialApi()
        if (!serialApi) {
            setState('unsupported')
            return
        }

        try {
            const port = await serialApi.requestPort()
            if (!isSessionActive()) return
            await connectToPort(port)
        } catch (connectError) {
            if (!isSessionActive()) return
            if (isPortSelectionCanceled(connectError)) {
                setState('permission_required')
                return
            }

            setError(getErrorMessage(connectError))
            setState('error')
        }
    }, [connectToPort, isSessionActive])

    useEffect(() => {
        const serialApi = getBrowserSerialApi()

        if (!serialApi) {
            setState('unsupported')
            return
        }

        if (!active) {
            void disconnect()
            return
        }

        if (portRef.current || isConnectingRef.current) return

        let cancelled = false

        void (async () => {
            try {
                const [grantedPort] = await getGrantedSerialPorts(serialApi)
                if (cancelled || !grantedPort) {
                    if (!cancelled) setState('permission_required')
                    return
                }

                await connectToPort(grantedPort)
            } catch (resumeError) {
                if (cancelled) return

                setError(getErrorMessage(resumeError))
                setState('error')
            }
        })()

        return () => {
            cancelled = true
        }
    }, [active, connectToPort, disconnect])

    useEffect(() => {
        return () => {
            isMountedRef.current = false
            void releaseConnection({ resetState: false })
        }
    }, [releaseConnection])

    return {
        state,
        error,
        connect,
        disconnect,
    }
}
