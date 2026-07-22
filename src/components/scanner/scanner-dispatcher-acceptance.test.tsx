import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ScannerConsumer } from '@/lib/scanner/scanner-dispatcher'

import { ScannerSerialProvider } from './scanner-serial-provider'
import {
    createMockSerialPort,
    setNavigatorSerial,
} from './scanner-serial-test-helpers'
import {
    useScanner,
    useScannerConsumer,
} from './use-scanner'

const RAW_CCCD_PAYLOAD =
    '086094006827|331757192|Nguyen Van A|21091994|Nam|Ha Noi|10052021'
const CONSOLE_METHODS = ['debug', 'error', 'info', 'log', 'warn'] as const

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
    enabled = true,
    onEvent,
}: {
    enabled?: boolean
    onEvent: ScannerConsumer['onEvent']
}) {
    useScannerConsumer({
        enabled,
        kinds: ['identity-qr', 'sample-code', 'unknown'],
        priority: 100,
        onEvent,
    })

    return null
}

function captureConsoleMethods() {
    return CONSOLE_METHODS.map((method) =>
        vi.spyOn(console, method).mockImplementation(() => undefined),
    )
}

function expectNoSensitiveConsoleOutput(
    consoleSpies: ReturnType<typeof captureConsoleMethods>,
) {
    const output = JSON.stringify(
        consoleSpies.map((spy) => spy.mock.calls),
        (_key, value) =>
            value instanceof Error ? `${value.name}: ${value.message}` : value,
    )

    expect(output).not.toContain(RAW_CCCD_PAYLOAD)
    expect(output).not.toContain('086094006827')
}

describe('Scanner dispatcher acceptance', () => {
    afterEach(() => {
        vi.restoreAllMocks()
        setNavigatorSerial(undefined)
    })

    it('emits one typed event per frame and keeps reading after a rejected consumer', async () => {
        const consoleSpies = captureConsoleMethods()
        const onEvent = vi.fn()
            .mockRejectedValueOnce(new Error(RAW_CCCD_PAYLOAD))
            .mockResolvedValue(undefined)
        const mockPort = createMockSerialPort()
        setNavigatorSerial({
            getPorts: vi.fn().mockResolvedValue([mockPort.port]),
            requestPort: vi.fn(),
        })

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
                <ConsumerProbe onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })

        await act(async () => {
            mockPort.pushChunk(
                new TextEncoder().encode('CDC-XN-22072026-0001\r\n'),
            )
        })
        await waitFor(() => {
            expect(onEvent).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            mockPort.pushChunk(new TextEncoder().encode(`${RAW_CCCD_PAYLOAD}\n`))
        })
        await waitFor(() => {
            expect(onEvent).toHaveBeenCalledTimes(2)
        })

        expect(onEvent.mock.calls[0]?.[0]).toEqual({
            kind: 'sample-code',
            code: 'CDC-XN-22072026-0001',
        })
        expect(onEvent.mock.calls[1]?.[0]).toEqual({
            kind: 'identity-qr',
            identity: {
                idCardNum: '086094006827',
                name: 'Nguyen Van A',
                dateOfBirth: '1994-09-21',
                gender: 'Nam',
                address: 'Ha Noi',
            },
        })
        expectNoSensitiveConsoleOutput(consoleSpies)
    })

    it('does not leave duplicate registrations after reconnect or unmount', async () => {
        const firstPort = createMockSerialPort()
        const secondPort = createMockSerialPort()
        const onEvent = vi.fn()
        setNavigatorSerial({
            getPorts: vi.fn().mockResolvedValue([firstPort.port]),
            requestPort: vi.fn().mockResolvedValue(secondPort.port),
        })

        const { rerender, unmount } = render(
            <ScannerSerialProvider principalKey="staff-1">
                <span>route-a</span>
                <ConnectionProbe />
                <ConsumerProbe onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })

        await act(async () => {
            firstPort.pushChunk(
                new TextEncoder().encode('CDC-XN-22072026-0001\n'),
            )
        })
        await waitFor(() => {
            expect(onEvent).toHaveBeenCalledTimes(1)
        })

        rerender(
            <ScannerSerialProvider principalKey="staff-1">
                <span>route-b</span>
                <ConnectionProbe />
                <ConsumerProbe onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        fireEvent.click(screen.getByRole('button', { name: 'disconnect' }))
        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe(
                'permission_required',
            )
        })

        fireEvent.click(screen.getByRole('button', { name: 'connect' }))
        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
            expect(secondPort.port.open).toHaveBeenCalledTimes(1)
        })

        await act(async () => {
            secondPort.pushChunk(
                new TextEncoder().encode('CDC-XN-22072026-0002\n'),
            )
        })
        await waitFor(() => {
            expect(onEvent).toHaveBeenCalledTimes(2)
        })

        rerender(
            <ScannerSerialProvider principalKey="staff-1">
                <span>route-b</span>
                <ConnectionProbe />
                <ConsumerProbe enabled={false} onEvent={onEvent} />
            </ScannerSerialProvider>,
        )

        await act(async () => {
            secondPort.pushChunk(
                new TextEncoder().encode('CDC-XN-22072026-0003\n'),
            )
        })
        await act(async () => {
            await Promise.resolve()
        })
        expect(onEvent).toHaveBeenCalledTimes(2)

        unmount()
        await waitFor(() => {
            expect(firstPort.reader.cancel).toHaveBeenCalledTimes(1)
            expect(firstPort.port.close).toHaveBeenCalledTimes(1)
            expect(secondPort.reader.cancel).toHaveBeenCalledTimes(1)
            expect(secondPort.port.close).toHaveBeenCalledTimes(1)
        })
    })

    it('does not render or log a raw CCCD payload from a serial failure', async () => {
        const consoleSpies = captureConsoleMethods()
        const mockPort = createMockSerialPort()
        setNavigatorSerial({
            getPorts: vi.fn().mockResolvedValue([mockPort.port]),
            requestPort: vi.fn(),
        })

        render(
            <ScannerSerialProvider principalKey="staff-1">
                <ConnectionProbe />
            </ScannerSerialProvider>,
        )

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('connected')
        })

        await act(async () => {
            mockPort.failRead(new Error(RAW_CCCD_PAYLOAD))
        })

        await waitFor(() => {
            expect(screen.getByTestId('scanner-state').textContent).toBe('error')
        })

        const renderedError = screen.getByTestId('scanner-error').textContent ?? ''
        expect(renderedError).toBe('Mất kết nối scanner. Vui lòng kết nối lại.')
        expect(renderedError).not.toContain(RAW_CCCD_PAYLOAD)
        expect(renderedError).not.toContain('086094006827')
        expectNoSensitiveConsoleOutput(consoleSpies)
    })
})
