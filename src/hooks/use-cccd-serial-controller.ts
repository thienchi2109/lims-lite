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
    const portRef = useRef<BrowserSerialPortLike | null>(null)
    const readerRef = useRef<BrowserSerialReaderLike | null>(null)
    const sessionTokenRef = useRef(0)

    useEffect(() => {
        onPayloadRef.current = onPayload
    }, [onPayload])

    const disconnect = useCallback(async () => {
        sessionTokenRef.current += 1

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

        if (getBrowserSerialApi()) {
            setState('permission_required')
            setError(null)
        } else {
            setState('unsupported')
        }
    }, [])

    const connectToPort = useCallback(
        async (port: BrowserSerialPortLike) => {
            const token = sessionTokenRef.current + 1
            sessionTokenRef.current = token

            await disconnect()
            sessionTokenRef.current = token

            setError(null)
            setState('connecting')

            await port.open({ baudRate: DEFAULT_CCCD_SERIAL_BAUD_RATE })

            if (!port.readable) {
                throw new Error('Scanner CCCD không cung cấp luồng dữ liệu để đọc.')
            }

            const reader = port.readable.getReader()
            const decoder = createCccdSerialFrameDecoder({
                onPayload: (payload) => onPayloadRef.current(payload),
            })

            portRef.current = port
            readerRef.current = reader
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
        },
        [active, disconnect],
    )

    const connect = useCallback(async () => {
        const serialApi = getBrowserSerialApi()
        if (!serialApi) {
            setState('unsupported')
            return
        }

        try {
            const port = await serialApi.requestPort()
            await connectToPort(port)
        } catch (connectError) {
            if (isPortSelectionCanceled(connectError)) {
                setState('permission_required')
                return
            }

            setError(getErrorMessage(connectError))
            setState('error')
        }
    }, [connectToPort])

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

        if (portRef.current || state === 'connecting') return

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
    }, [active, connectToPort, disconnect, state])

    return {
        state,
        error,
        connect,
        disconnect,
    }
}
