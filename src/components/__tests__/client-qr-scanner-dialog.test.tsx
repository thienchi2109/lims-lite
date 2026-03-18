import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
                serialController={{
                    state: 'permission_required',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                }}
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
                serialController={{
                    state: 'unsupported',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                }}
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
        const connect = vi.fn()

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                serialController={{
                    state: 'permission_required',
                    error: null,
                    connect,
                    disconnect: vi.fn(),
                }}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Kết nối scanner CCCD' }))
        expect(connect).toHaveBeenCalledTimes(1)
    })

    it('shows connected status, hides camera, and allows disconnecting', () => {
        const disconnect = vi.fn()

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                serialController={{
                    state: 'connected',
                    error: null,
                    connect: vi.fn(),
                    disconnect,
                }}
            />,
        )

        expect(screen.getByText('Đã kết nối')).toBeDefined()
        // Camera should be hidden when COM is connected
        expect(screen.queryByTestId('camera-scan-trigger')).toBeNull()

        fireEvent.click(screen.getByText('Ngắt'))
        expect(disconnect).toHaveBeenCalledTimes(1)
    })

    it('hides COM section when serial is unsupported but preserves keyboard and camera', () => {
        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
                serialController={{
                    state: 'unsupported',
                    error: null,
                    connect: vi.fn(),
                    disconnect: vi.fn(),
                }}
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
            />,
        )

        const dialogClassName = screen.getByRole('dialog').getAttribute('class') ?? ''

        expect(dialogClassName).toContain('max-h-[90vh]')
        expect(dialogClassName).toContain('overflow-y-auto')
        expect(dialogClassName).toContain('p-4')
        expect(dialogClassName).toContain('sm:p-6')
    })
})
