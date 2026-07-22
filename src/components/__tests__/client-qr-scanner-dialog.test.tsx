import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const scannerMocks = vi.hoisted(() => ({
    connection: {
        state: 'permission_required',
        error: null as string | null,
        connect: vi.fn(),
        disconnect: vi.fn(),
    },
    useScannerConsumer: vi.fn(),
}))

vi.mock('@/components/scanner/use-scanner', () => ({
    useScanner: () => scannerMocks.connection,
    useScannerConsumer: scannerMocks.useScannerConsumer,
}))

vi.mock('@/components/qr-scanner', () => ({
    QRScanner: ({ onScan }: { onScan: (decodedText: string) => void }) => (
        <button
            type="button"
            data-testid="camera-scan-trigger"
            onClick={() => onScan('CAMERA|QR|PAYLOAD')}
        >
            Camera Scanner Mock
        </button>
    ),
}))

import { ClientQrScannerDialog } from '../client-qr-scanner-dialog'

describe('ClientQrScannerDialog continuity', () => {
    beforeEach(() => {
        vi.useFakeTimers()
        scannerMocks.connection.state = 'permission_required'
        scannerMocks.connection.error = null
    })

    afterEach(() => {
        vi.clearAllMocks()
        vi.useRealTimers()
    })

    it('shows COM connect button, keyboard input, and camera when serial is available but not connected', () => {
        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        expect(screen.getByText(/Scanner CCCD \(COM\)/i)).toBeDefined()
        expect(screen.getByRole('button', { name: 'Kết nối scanner CCCD' })).toBeDefined()
        expect(screen.getByPlaceholderText('Đặt con trỏ ở đây rồi quét CCCD…')).toBeDefined()
        expect(screen.getByTestId('camera-scan-trigger')).toBeDefined()
    })

    it('processes keyboard payload and camera payload without flow regression', async () => {
        const onScan = vi.fn()

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={onScan}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        const scannerInput = screen.getByPlaceholderText('Đặt con trỏ ở đây rồi quét CCCD…')
        fireEvent.change(scannerInput, {
            target: { value: '086094006827|331757192|Nguyen Van A|21091994|Nam|Ha Noi|10052021' },
        })

        await act(async () => {
            vi.advanceTimersByTime(400)
            await Promise.resolve()
        })

        expect(onScan).toHaveBeenCalledWith(
            '086094006827|331757192|Nguyen Van A|21091994|Nam|Ha Noi|10052021',
        )

        fireEvent.click(screen.getByTestId('camera-scan-trigger'))
        expect(onScan).toHaveBeenCalledWith('CAMERA|QR|PAYLOAD')
    })

    it('requests serial connection from an explicit user click', () => {
        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Kết nối scanner CCCD' }))
        expect(scannerMocks.connection.connect).toHaveBeenCalledTimes(1)
    })

    it('shows connected status, hides camera, and allows disconnecting', () => {
        scannerMocks.connection.state = 'connected'

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        expect(screen.getByText('Đã kết nối')).toBeDefined()
        // Camera should be hidden when COM is connected
        expect(screen.queryByTestId('camera-scan-trigger')).toBeNull()

        fireEvent.click(screen.getByText('Ngắt'))
        expect(scannerMocks.connection.disconnect).toHaveBeenCalledTimes(1)
    })

    it('hides COM section when serial is unsupported but preserves keyboard and camera', () => {
        scannerMocks.connection.state = 'unsupported'

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        // COM section should be hidden when unsupported
        expect(screen.queryByText(/Scanner CCCD \(COM\)/i)).toBeNull()
        expect(screen.getByPlaceholderText('Đặt con trỏ ở đây rồi quét CCCD…')).toBeDefined()
        expect(screen.getByTestId('camera-scan-trigger')).toBeDefined()
    })

    it('keeps the built-in close button available for dismissing the scanner dialog', () => {
        const onOpenChange = vi.fn()

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={onOpenChange}
                onScan={vi.fn()}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: /close/i }))
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('adds mobile-safe height and scrolling constraints to the scanner dialog', () => {
        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                onIdentityScan={vi.fn()}
                onInvalidScan={vi.fn()}
            />,
        )

        const dialogClassName = screen.getByRole('dialog').getAttribute('class') ?? ''

        expect(dialogClassName).toContain('max-h-[90vh]')
        expect(dialogClassName).toContain('overflow-y-auto')
        expect(dialogClassName).toContain('p-4')
        expect(dialogClassName).toContain('sm:p-6')
    })

    it('registers the CCCD consumer only while open with identity priority 300', () => {
        const props = {
            onOpenChange: vi.fn(),
            onScan: vi.fn(),
            onIdentityScan: vi.fn(),
            onInvalidScan: vi.fn(),
        }
        const { rerender } = render(<ClientQrScannerDialog open={false} {...props} />)

        expect(scannerMocks.useScannerConsumer).toHaveBeenLastCalledWith(
            expect.objectContaining({
                enabled: false,
                kinds: ['identity-qr', 'unknown'],
                priority: 300,
                onEvent: expect.any(Function),
            }),
        )

        rerender(<ClientQrScannerDialog open={true} {...props} />)

        expect(scannerMocks.useScannerConsumer).toHaveBeenLastCalledWith(
            expect.objectContaining({
                enabled: true,
                kinds: ['identity-qr', 'unknown'],
                priority: 300,
                onEvent: expect.any(Function),
            }),
        )
    })

    it('routes parsed identity and unknown serial events without reparsing raw text', async () => {
        const onScan = vi.fn()
        const onIdentityScan = vi.fn()
        const onInvalidScan = vi.fn()

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={onScan}
                onIdentityScan={onIdentityScan}
                onInvalidScan={onInvalidScan}
            />,
        )

        const consumer = scannerMocks.useScannerConsumer.mock.calls.at(-1)?.[0]
        expect(consumer).toBeDefined()
        if (!consumer) return

        const identity = {
            idCardNum: '086094006827',
            name: 'Nguyen Van A',
            dateOfBirth: '1994-09-21',
            gender: 'Nam' as const,
            address: 'Ha Noi',
        }

        await act(async () => {
            await consumer.onEvent({ kind: 'identity-qr', identity })
            await consumer.onEvent({ kind: 'unknown' })
        })

        expect(onIdentityScan).toHaveBeenCalledTimes(1)
        expect(onIdentityScan).toHaveBeenCalledWith(identity)
        expect(onInvalidScan).toHaveBeenCalledTimes(1)
        expect(onScan).not.toHaveBeenCalled()
    })
})
