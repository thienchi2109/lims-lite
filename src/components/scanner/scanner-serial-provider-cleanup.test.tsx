import { act, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ScannerEvent } from '@/lib/scanner/scanner-event'

import { ScannerSerialProvider } from './scanner-serial-provider'
import { createMockSerialPort, setNavigatorSerial } from './scanner-serial-test-helpers'
import { useScanner, useScannerConsumer } from './use-scanner'

function StateProbe() {
    const scanner = useScanner()
    return <span data-testid="scanner-state">{scanner.state}</span>
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

describe('ScannerSerialProvider cleanup', () => {
    afterEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
        setNavigatorSerial(undefined)
    })

    it('cancels the reader, releases the lock, closes the port, and discards partial frames', async () => {
        const onEvent = vi.fn()
        const mockPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn().mockResolvedValue([mockPort.port]),
            requestPort: vi.fn(),
        }
        setNavigatorSerial(serialApi)

        const { unmount } = render(
            <ScannerSerialProvider principalKey="staff-1">
                <StateProbe />
                <ConsumerProbe onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })

        await act(async () => {
            mockPort.pushChunk(new TextEncoder().encode('CDC-XN-22072026'))
        })

        vi.useFakeTimers()
        unmount()

        await act(async () => {
            await Promise.resolve()
            await vi.advanceTimersByTimeAsync(200)
        })

        expect(mockPort.reader.cancel).toHaveBeenCalledTimes(1)
        expect(mockPort.reader.releaseLock).toHaveBeenCalledTimes(1)
        expect(mockPort.port.close).toHaveBeenCalledTimes(1)
        expect(onEvent).not.toHaveBeenCalled()
    })

    it('releases the old connection and resumes once when the principal changes', async () => {
        const firstPort = createMockSerialPort()
        const secondPort = createMockSerialPort()
        const serialApi = {
            getPorts: vi.fn()
                .mockResolvedValueOnce([firstPort.port])
                .mockResolvedValueOnce([secondPort.port]),
            requestPort: vi.fn(),
        }
        setNavigatorSerial(serialApi)

        const { rerender } = render(
            <ScannerSerialProvider key="staff-1" principalKey="staff-1">
                <StateProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(firstPort.port.open).toHaveBeenCalledTimes(1)
        })

        rerender(
            <ScannerSerialProvider key="staff-2" principalKey="staff-2">
                <StateProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(firstPort.reader.cancel).toHaveBeenCalledTimes(1)
            expect(firstPort.port.close).toHaveBeenCalledTimes(1)
            expect(secondPort.port.open).toHaveBeenCalledTimes(1)
        })
        expect(serialApi.getPorts).toHaveBeenCalledTimes(2)
        expect(serialApi.requestPort).not.toHaveBeenCalled()
        expect(firstPort.port.close.mock.invocationCallOrder[0]).toBeLessThan(
            secondPort.port.open.mock.invocationCallOrder[0],
        )
    })
})
