import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const useCccdSerialControllerMock = vi.fn()

vi.mock('@/components/test-assignment-grid', () => ({
    TestAssignmentGrid: ({ context }: { context?: unknown }) => (
        <div data-testid="test-assignment-grid">
            Test Grid
            {context}
        </div>
    ),
}))

vi.mock('@/components/client-selector', () => ({
    ClientSelector: () => <div data-testid="client-selector">Client Selector</div>,
}))

vi.mock('@/components/sample-type-selector', () => ({
    SampleTypeSelector: () => <div data-testid="sample-type-selector">Sample Type</div>,
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: ({
        open,
        serialController,
    }: {
        open: boolean
        serialController?: { state: string }
    }) =>
        open ? (
            <div data-testid="client-qr-scanner-dialog">{serialController?.state ?? 'no-serial'}</div>
        ) : null,
}))

vi.mock('@/hooks/use-media-query', () => ({
    useMediaQuery: vi.fn(() => true),
}))

vi.mock('@/hooks/use-cccd-serial-controller', () => ({
    useCccdSerialController: (options: unknown) => useCccdSerialControllerMock(options),
}))

import { SampleAccessionForm } from '../sample-accession-form'

describe('SampleAccessionForm Web Serial integration', () => {
    beforeEach(() => {
        useCccdSerialControllerMock.mockReset()
        useCccdSerialControllerMock.mockReturnValue({
            state: 'permission_required',
            error: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
        })
    })

    it('creates a page-scoped serial controller and passes it to the QR dialog', () => {
        render(<SampleAccessionForm specialties={[]} />)

        expect(useCccdSerialControllerMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                active: false,
                onPayload: expect.any(Function),
            }),
        )

        fireEvent.click(screen.getByRole('button', { name: /Bấm để quét mã khách hàng/i }))

        expect(useCccdSerialControllerMock).toHaveBeenLastCalledWith(
            expect.objectContaining({
                active: true,
                onPayload: expect.any(Function),
            }),
        )

        expect(screen.getByTestId('client-qr-scanner-dialog').textContent).toBe('permission_required')
    })
})
