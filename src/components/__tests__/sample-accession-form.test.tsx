import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const accessionFormMocks = vi.hoisted(() => {
    const createSampleClient = vi.fn()
    const accessionAndAssignTestsClient = vi.fn()
    const findClientByIdentityClient = vi.fn()

    return {
        createSampleClient,
        accessionAndAssignTestsClient,
        findClientByIdentityClient,
        mockClient: {
            id: '11111111-1111-1111-1111-111111111111',
            id_card_num: '012345678901',
            name: 'Nguyen Van A',
            date_of_birth: '1990-01-02T00:00:00.000Z',
            gender: 'Nam',
            phone: '0912345678',
            address: '1 Nguyen Trai',
            health_insurance_num: null,
            expiry_date: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        },
        mockSelectedTest: {
            assayId: 'assay-1',
            methodId: 'method-1',
            assayName: 'ALT',
            methodName: 'Máy tự động',
            units: 'U/L',
        },
        serialController: {
            state: 'idle',
            error: null,
            connect: vi.fn(),
            disconnect: vi.fn(),
        },
    }
})

vi.mock('@/lib/api-client', () => ({
    createSampleClient: accessionFormMocks.createSampleClient,
    accessionAndAssignTestsClient: accessionFormMocks.accessionAndAssignTestsClient,
    findClientByIdentityClient: accessionFormMocks.findClientByIdentityClient,
}))

vi.mock('@/components/test-assignment-grid', () => ({
    TestAssignmentGrid: ({
        selected,
        onChange,
        context,
        onSave,
        isSaveDisabled,
        wizardProps,
    }: {
        selected: Array<{ assayId: string }>
        onChange: (tests: unknown[]) => void
        context?: React.ReactNode
        onSave: () => void
        isSaveDisabled?: boolean
        wizardProps?: {
            selectedClient?: { name: string } | null
            selectedSampleType?: string
            receivedAtValue?: string
            submitSuccess?: string | null
        }
    }) => (
        <div data-testid="test-assignment-grid">
            <div data-testid="selected-count">{String(selected.length)}</div>
            <div data-testid="selected-client">{wizardProps?.selectedClient?.name ?? ''}</div>
            <div data-testid="selected-sample-type">{wizardProps?.selectedSampleType ?? ''}</div>
            <div data-testid="received-at-value">{wizardProps?.receivedAtValue ?? ''}</div>
            <div data-testid="submit-success">{wizardProps?.submitSuccess ?? ''}</div>
            <button
                type="button"
                onClick={() => onChange([accessionFormMocks.mockSelectedTest])}
            >
                Thêm xét nghiệm
            </button>
            <button type="button" onClick={onSave} disabled={isSaveDisabled}>
                Lưu mẫu
            </button>
            {context}
        </div>
    ),
}))

vi.mock('@/components/client-selector', () => ({
    ClientSelector: ({
        selectedClient,
        onSelect,
    }: {
        selectedClient: { name: string } | null
        onSelect: (client: unknown) => void
    }) => (
        <button
            type="button"
            onClick={() => onSelect(accessionFormMocks.mockClient)}
        >
            {selectedClient?.name ?? 'Chọn khách hàng'}
        </button>
    ),
}))

vi.mock('@/components/sample-type-selector', () => ({
    SampleTypeSelector: ({
        value,
        onChange,
    }: {
        value: string
        onChange: (value: 'Nước tiểu') => void
    }) => (
        <div>
            <div data-testid="sample-type-value">{value}</div>
            <button type="button" onClick={() => onChange('Nước tiểu')}>
                Chọn Nước tiểu
            </button>
        </div>
    ),
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: () => null,
}))

vi.mock('@/components/ui/alert-dialog', () => ({
    AlertDialog: ({ open, children }: { open: boolean; children: React.ReactNode }) =>
        open ? <div data-testid="confirm-dialog">{children}</div> : null,
    AlertDialogAction: ({
        children,
        onClick,
    }: {
        children: React.ReactNode
        onClick?: () => void
    }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
    AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
        <button type="button">{children}</button>
    ),
    AlertDialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/hooks/use-cccd-serial-controller', () => ({
    useCccdSerialController: () => accessionFormMocks.serialController,
}))

vi.mock('@/lib/qr/parse-client-identity-qr', () => ({
    parseClientIdentityQr: vi.fn(),
}))

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}))

import { SampleAccessionForm } from '../sample-accession-form'

describe('SampleAccessionForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        accessionFormMocks.findClientByIdentityClient.mockResolvedValue({ data: null })
        accessionFormMocks.createSampleClient.mockResolvedValue({
            data: { sample_id: 'SMP-001' },
        })
        accessionFormMocks.accessionAndAssignTestsClient.mockResolvedValue({
            data: {
                sample: { sample_id: 'SMP-002' },
                results: [{ id: 'result-1' }],
            },
        })
    })

    it('passes the watched received time into wizard props', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        const receivedAtInput = document.querySelector(
            'input[type="datetime-local"]',
        ) as HTMLInputElement | null

        expect(receivedAtInput).not.toBeNull()

        fireEvent.change(receivedAtInput!, {
            target: { value: '2026-03-17T08:30' },
        })

        await waitFor(() => {
            expect(screen.getByTestId('received-at-value').textContent).toBe('2026-03-17T08:30')
        })
    })

    it('preserves submitted state after creating a sample with assigned tests', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(accessionFormMocks.accessionAndAssignTestsClient).toHaveBeenCalledTimes(1)
        })

        expect(screen.getByTestId('submit-success').textContent).toBe(
            'Mẫu SMP-002 đã được tạo và chỉ định 1 xét nghiệm.',
        )
        expect(screen.getByTestId('selected-client').textContent).toBe(
            accessionFormMocks.mockClient.name,
        )
        expect(screen.getByTestId('selected-sample-type').textContent).toBe('Nước tiểu')
        expect(screen.getByTestId('selected-count').textContent).toBe('1')
    })

    it('preserves submitted state after creating a sample without assigned tests', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(screen.getByTestId('confirm-dialog')).toBeDefined()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tạo mẫu' }))

        await waitFor(() => {
            expect(accessionFormMocks.createSampleClient).toHaveBeenCalledTimes(1)
        })

        expect(screen.getByTestId('submit-success').textContent).toBe('Mẫu SMP-001 đã được tạo.')
        expect(screen.getByTestId('selected-client').textContent).toBe(
            accessionFormMocks.mockClient.name,
        )
        expect(screen.getByTestId('selected-sample-type').textContent).toBe('Nước tiểu')
        expect(screen.getByTestId('selected-count').textContent).toBe('0')
    })

    it('requires an explicit desktop reset before another save after success', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))

        const saveButton = screen.getByRole('button', { name: 'Lưu mẫu' })
        fireEvent.click(saveButton)

        await waitFor(() => {
            expect(accessionFormMocks.accessionAndAssignTestsClient).toHaveBeenCalledTimes(1)
        })

        expect((saveButton as HTMLButtonElement).disabled).toBe(true)

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận mẫu mới' }))

        expect(screen.getByTestId('submit-success').textContent).toBe('')
        expect(screen.getByTestId('selected-client').textContent).toBe('')
        expect(screen.getByTestId('selected-sample-type').textContent).toBe('Máu')
        expect(screen.getByTestId('selected-count').textContent).toBe('0')
        expect((saveButton as HTMLButtonElement).disabled).toBe(false)
    })
})
