import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ScannerEvent } from '@/lib/scanner/scanner-event'

import { ScannerSerialProvider } from './scanner-serial-provider'
import {
    createDeferred,
    createMockSerialPort,
    setNavigatorSerial,
} from './scanner-serial-test-helpers'
import { useScanner, useScannerConsumer } from './use-scanner'

function ConnectionProbe() {
    const scanner = useScanner()

    return (
        <>
            <span data-testid="scanner-state">{scanner.state}</span>
            <span data-testid="scanner-error">{scanner.error}</span>
            <button type="button" onClick={() => void scanner.connect()}>
                connect
            </button>
            <button type="button" onClick={() => void scanner.disconnect()}>
                disconnect
            </button>
        </>
    )
}

function ConsumerProbe({
    onEvent,
}: {
    onEvent: (event: ScannerEvent) => void
}) {
    useScannerConsumer({
        enabled: true,
        kinds: ['identity-qr', 'sample-code', 'unknown'],
        priority: 100,
        onEvent,
    })

    return null
}

describe('ScannerSerialProvider', () => {
    afterEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
        setNavigatorSerial(undefined)
    })

    it('auto-resumes one granted port without requesting browser permission', async () => {
        const { port } = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([port]),
            requestPort: vi.fn(),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })

        expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
        expect(serialApi.requestPort).not.toHaveBeenCalled()
        expect(port.open).toHaveBeenCalledWith({ baudRate: 9600 })
    })

    it('requests a port only after an explicit connect action', async () => {
        const { port } = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([]),
            requestPort: vi.fn().mockResolvedValue(port),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('permission_required')
        })
        expect(serialApi.requestPort).not.toHaveBeenCalled()

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })
        expect(serialApi.requestPort).toHaveBeenCalledTimes(1)
        expect(port.open).toHaveBeenCalledTimes(1)
    })

    it('serializes repeated explicit connect actions while permission is pending', async () => {
        const requestedPort = createDeferred<ReturnType<typeof createMockSerialPort>['port']>()
        const mockPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([]),
            requestPort: vi.fn(() => requestedPort.promise),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('permission_required')
        })

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))
        fireEvent.click(screen.getByRole('button', { name: 'connect' }))

        expect(screen.getByTestId('scanner-state').textContent).toBe('connecting')
        await waitFor(() => {
            expect(serialApi.requestPort).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            requestedPort.resolve(mockPort.port)
        })

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })
        expect(mockPort.port.open).toHaveBeenCalledTimes(1)
    })

    it('does not start explicit permission while automatic resume is pending', async () => {
        const grantedPorts = createDeferred<ReturnType<typeof createMockSerialPort>['port'][]>()
        const requestedPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn(() => grantedPorts.promise),
            requestPort: vi.fn().mockResolvedValue(requestedPort.port),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
        })

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))
        expect(serialApi.requestPort).not.toHaveBeenCalled()

        await act(async () => {
            grantedPorts.resolve([])
        })

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('permission_required')
        })

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })
        expect(serialApi.requestPort).toHaveBeenCalledTimes(1)
    })

    it('keeps the port open across child changes and dispatches classified frames', async () => {
        const onEvent = vi.fn()
        const mockPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([mockPort.port]),
            requestPort: vi.fn(),
        }
        setNavigatorSerial(serialApi)

        const { rerender } = render(
            <ScannerSerialProvider principalKey="staff-1">
                <span>route-a</span>
                <ConsumerProbe onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(mockPort.port.open).toHaveBeenCalledTimes(1)
        })

        rerender(
            <ScannerSerialProvider principalKey="staff-1">
                <span>route-b</span>
                <ConsumerProbe onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        await act(async () => {
            mockPort.pushChunk(new TextEncoder().encode('CDC-XN-22072026-0001\r\n'))
        })

        await waitFor(() => {
            expect(onEvent).toHaveBeenCalledWith({
                kind: 'sample-code',
                code: 'CDC-XN-22072026-0001',
            })
        })
        expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
        expect(mockPort.port.open).toHaveBeenCalledTimes(1)
        expect(mockPort.port.close).not.toHaveBeenCalled()
    })

    it('does not retry a busy granted port and can recover through explicit connect', async () => {
        const busyPort = {
            readable: null,
            open: vi.fn().mockRejectedValue(new Error('Port busy')),
            close: vi.fn(async () => {}),
        }
        const recoveredPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([busyPort]),
            requestPort: vi.fn().mockResolvedValue(recoveredPort.port),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('error')
        })
        expect(screen.getByTestId('scanner-error').textContent).toBe(
            'Không thể kết nối scanner.',
        )
        expect(serialApi.getPorts).toHaveBeenCalledTimes(1)
        expect(busyPort.open).toHaveBeenCalledTimes(1)

        await act(async () => {
            await Promise.resolve()
            await Promise.resolve()
        })
        expect(busyPort.open).toHaveBeenCalledTimes(1)

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })
        expect(serialApi.requestPort).toHaveBeenCalledTimes(1)
    })

    it('turns stream failures into a recoverable error state', async () => {
        const mockPort = createMockSerialPort()
        const recoveredPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([mockPort.port]),
            requestPort: vi.fn().mockResolvedValue(recoveredPort.port),
        }
        setNavigatorSerial(serialApi)

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })

        await act(async () => {
            mockPort.failRead(new Error('Mất luồng serial'))
        })

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('error')
            expect(mockPort.port.close).toHaveBeenCalledTimes(1)
        })

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })
    })
})
