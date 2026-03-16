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

    it('keeps USB/Bluetooth input and camera scanner in the same dialog', () => {
        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={vi.fn()}
            />,
        )

        expect(screen.getByText('Máy quét QR (USB/Bluetooth)')).toBeDefined()
        expect(screen.getByPlaceholderText('Đặt con trỏ ở đây rồi quét CCCD…')).toBeDefined()
        expect(screen.getByTestId('camera-scan-trigger')).toBeDefined()
    })

    it('processes USB/Bluetooth payload and camera payload without flow regression', async () => {
        const onScan = vi.fn()

        render(
            <ClientQrScannerDialog
                open={true}
                onOpenChange={vi.fn()}
                onScan={onScan}
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
})
