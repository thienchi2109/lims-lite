import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

const serialMocks = vi.hoisted(() => ({
    accessionAndAssignTestsClient: vi.fn(),
    createSampleClient: vi.fn(),
    findClientByIdentityClient: vi.fn(),
    parseClientIdentityQr: vi.fn(),
    toastError: vi.fn(),
    toastSuccess: vi.fn(),
    identity: {
        idCardNum: '086094006827',
        name: 'Nguyen Van A',
        dateOfBirth: '1994-09-21',
        gender: 'Nam' as const,
        address: 'Ha Noi',
    },
}))

vi.mock('@/lib/api-client', () => ({
    accessionAndAssignTestsClient: serialMocks.accessionAndAssignTestsClient,
    createSampleClient: serialMocks.createSampleClient,
    findClientByIdentityClient: serialMocks.findClientByIdentityClient,
}))

vi.mock('@/lib/qr/parse-client-identity-qr', () => ({
    parseClientIdentityQr: serialMocks.parseClientIdentityQr,
}))

vi.mock('sonner', () => ({
    toast: {
        error: serialMocks.toastError,
        success: serialMocks.toastSuccess,
    },
}))

vi.mock('@/components/test-assignment-grid', () => ({
    TestAssignmentGrid: ({ context }: { context?: unknown }) => (
        <div data-testid="test-assignment-grid">
            Test Grid
            {context}
        </div>
    ),
}))

vi.mock('@/components/client-selector', () => ({
    ClientSelector: ({
        selectedClient,
        formData,
    }: {
        selectedClient?: { name?: string } | null
        formData?: { name?: string; address?: string }
    }) => (
        <div data-testid="client-selector">
            <span data-testid="client-name">
                {selectedClient?.name ?? formData?.name ?? ''}
            </span>
            <span data-testid="client-address">{formData?.address ?? ''}</span>
        </div>
    ),
}))

vi.mock('@/components/sample-type-selector', () => ({
    SampleTypeSelector: () => <div data-testid="sample-type-selector">Sample Type</div>,
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: ({
        open,
        onIdentityScan,
        onInvalidScan,
    }: {
        open: boolean
        onIdentityScan?: (identity: typeof serialMocks.identity) => void | Promise<void>
        onInvalidScan?: () => void
    }) =>
        open ? (
            <div data-testid="client-qr-scanner-dialog">
                <button
                    type="button"
                    onClick={() => void onIdentityScan?.(serialMocks.identity)}
                >
                    Phát sự kiện CCCD serial
                </button>
                <button type="button" onClick={() => onInvalidScan?.()}>
                    Phát sự kiện serial không hợp lệ
                </button>
            </div>
        ) : null,
}))

vi.mock('@/hooks/use-media-query', () => ({
    useMediaQuery: vi.fn(() => true),
}))

import { SampleAccessionForm } from '../sample-accession-form'

describe('SampleAccessionForm dispatcher CCCD integration', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        serialMocks.findClientByIdentityClient.mockResolvedValue({ data: null })
    })

    it('runs lookup and administrative autofill exactly once for a parsed serial identity', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        fireEvent.click(screen.getByRole('button', { name: /Quét mã QR trên CCCD/i }))
        fireEvent.click(screen.getByRole('button', { name: 'Phát sự kiện CCCD serial' }))

        await waitFor(() => {
            expect(serialMocks.findClientByIdentityClient).toHaveBeenCalledTimes(1)
        })

        expect(serialMocks.findClientByIdentityClient).toHaveBeenCalledWith(
            'Nguyen Van A',
            '1994-09-21',
        )
        expect(serialMocks.parseClientIdentityQr).not.toHaveBeenCalled()
        expect(screen.queryByTestId('client-qr-scanner-dialog')).toBeNull()
        expect(screen.getByTestId('client-name').textContent).toBe('Nguyen Van A')
        expect(screen.getByTestId('client-address').textContent).toBe('Ha Noi')
    })

    it('closes the dialog and preserves invalid-QR feedback for an unknown serial event', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        fireEvent.click(screen.getByRole('button', { name: /Quét mã QR trên CCCD/i }))
        fireEvent.click(
            screen.getByRole('button', { name: 'Phát sự kiện serial không hợp lệ' }),
        )

        await waitFor(() => {
            expect(serialMocks.toastError).toHaveBeenCalledWith(
                'Mã QR không hợp lệ. Vui lòng thử lại hoặc nhập thủ công.',
            )
        })

        expect(serialMocks.findClientByIdentityClient).not.toHaveBeenCalled()
        expect(screen.queryByTestId('client-qr-scanner-dialog')).toBeNull()
    })
})
