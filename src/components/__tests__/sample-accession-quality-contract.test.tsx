import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

const mocks = vi.hoisted(() => ({
    createManualAccessionSampleClient: vi.fn(),
    assignManualAccessionTestsClient: vi.fn(),
    findClientByIdentityQrClient: vi.fn(),
    getPublishedCatalogClient: vi.fn(),
    printSampleBarcodeLabel: vi.fn(),
    toastSuccess: vi.fn(),
    client: {
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
    selection: {
        kind: 'existing' as const,
        workflow: 'manual' as const,
        client: {
            id: '11111111-1111-1111-1111-111111111111',
            id_card_num: '012345678901',
            name: 'Nguyen Van A',
            date_of_birth: '1990-01-02T00:00:00.000Z',
            gender: 'Nam' as const,
            phone: '0912345678',
            address: '1 Nguyen Trai',
            health_insurance_num: null,
            expiry_date: null,
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
        },
        resolution: {
            kind: 'existing' as const,
            governmentIdentityType: 'cccd' as const,
            governmentIdentityValue: '012345678901',
            name: 'Nguyen Van A',
            dateOfBirth: '1990-01-02',
            phone: '0912345678',
        },
    },
    selectedTest: {
        assayId: 'assay-1',
        methodId: 'method-1',
        assayName: 'ALT',
        methodName: 'Máy tự động',
        units: 'U/L',
    },
}))

vi.mock('@/lib/api-client', () => ({
    createManualAccessionSampleClient: mocks.createManualAccessionSampleClient,
    createQrAccessionSampleClient: mocks.createManualAccessionSampleClient,
    assignManualAccessionTestsClient: mocks.assignManualAccessionTestsClient,
    assignQrAccessionTestsClient: mocks.assignManualAccessionTestsClient,
    findClientByIdentityQrClient: mocks.findClientByIdentityQrClient,
    getPublishedAssaySampleTypeCatalogClient: mocks.getPublishedCatalogClient,
}))

vi.mock('@/lib/sample-label-print-client', () => ({
    printSampleBarcodeLabel: mocks.printSampleBarcodeLabel,
}))

vi.mock('@/components/test-assignment-grid', () => ({
    TestAssignmentGrid: ({
        onChange,
        context,
        onSave,
        isSaveDisabled,
    }: {
        onChange: (tests: unknown[]) => void
        context?: ReactNode
        onSave: () => void
        isSaveDisabled?: boolean
    }) => (
        <div>
            <button
                type="button"
                onClick={() => onChange([mocks.selectedTest])}
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
        selectedClient: { client: { name: string } } | null
        onSelect: (client: unknown) => void
    }) => (
        <button type="button" onClick={() => onSelect(mocks.selection)}>
            {selectedClient?.client.name ?? 'Chọn khách hàng'}
        </button>
    ),
}))

vi.mock('@/components/sample-type-selector', () => ({
    SampleTypeSelector: ({
        value,
        options,
    }: {
        value: string | null
        options: Array<{ id: string; name: string }>
    }) => (
        <div data-testid="sample-type-value">
            {options.find((sampleType) => sampleType.id === value)?.name ?? ''}
        </div>
    ),
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: () => null,
}))

vi.mock('@/components/ui/alert-dialog', () => ({
    AlertDialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
        open ? <div data-testid="confirm-dialog">{children}</div> : null,
    AlertDialogAction: ({
        children,
        onClick,
    }: {
        children: ReactNode
        onClick?: () => void
    }) => (
        <button type="button" onClick={onClick}>
            {children}
        </button>
    ),
    AlertDialogCancel: ({ children }: { children: ReactNode }) => (
        <button type="button">{children}</button>
    ),
    AlertDialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogDescription: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
    AlertDialogTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/lib/qr/parse-client-identity-qr', () => ({
    parseClientIdentityQr: vi.fn(),
}))

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: mocks.toastSuccess,
    },
}))

import { SampleAccessionForm } from '../sample-accession-form'

function getQualityCheckbox(name: 'Đạt' | 'Không đạt') {
    return screen.getByRole('checkbox', { name })
}

async function waitForCompatibilityCatalog() {
    await waitFor(() => {
        expect(screen.getByTestId('sample-type-value').textContent).toBe('Máu')
    })
}

describe('desktop sample quality accession contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mocks.findClientByIdentityQrClient.mockResolvedValue({ data: null })
        mocks.getPublishedCatalogClient.mockResolvedValue({
            data: {
                revisionNumber: 7,
                sampleTypeId: null,
                sampleTypes: [{
                    id: '11111111-1111-4111-8111-111111111111',
                    importCode: 'LM-000001',
                    name: 'Máu',
                }],
                assays: [{
                    sampleTypeId: '11111111-1111-4111-8111-111111111111',
                    assayDefinitionId: 'assay-1',
                    importCode: 'CT-000001',
                    name: 'ALT',
                    methodName: 'Máy tự động',
                    specialtyId: null,
                }],
            },
        })
        mocks.createManualAccessionSampleClient.mockResolvedValue({
            data: { id: 'sample-created-1', sample_id: 'SMP-001' },
        })
        mocks.assignManualAccessionTestsClient.mockResolvedValue({
            data: {
                sample: { id: 'sample-created-2', sample_id: 'SMP-002' },
                results: [{ id: 'result-1' }],
            },
        })
    })

    it('renders two Shadcn checkboxes below sample type with no default and mutual exclusion', () => {
        render(<SampleAccessionForm specialties={[]} />)

        const sampleTypeLabel = screen.getByText(/Loại mẫu/)
        const qualityLabel = screen.getByText(/Chất lượng mẫu/)
        const receivedAtLabel = screen.getByText('Thời gian nhận')
        const acceptable = getQualityCheckbox('Đạt')
        const unacceptable = getQualityCheckbox('Không đạt')

        expect(screen.getAllByRole('checkbox')).toHaveLength(2)
        expect(acceptable.getAttribute('data-state')).toBe('unchecked')
        expect(unacceptable.getAttribute('data-state')).toBe('unchecked')
        expect(
            sampleTypeLabel.compareDocumentPosition(qualityLabel)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ).not.toBe(0)
        expect(
            qualityLabel.compareDocumentPosition(receivedAtLabel)
            & Node.DOCUMENT_POSITION_FOLLOWING,
        ).not.toBe(0)

        fireEvent.click(acceptable)
        expect(acceptable.getAttribute('data-state')).toBe('checked')
        expect(unacceptable.getAttribute('data-state')).toBe('unchecked')

        fireEvent.click(unacceptable)
        expect(acceptable.getAttribute('data-state')).toBe('unchecked')
        expect(unacceptable.getAttribute('data-state')).toBe('checked')
    })

    it('blocks desktop save with Vietnamese validation when quality is missing', async () => {
        render(<SampleAccessionForm specialties={[]} />)

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        const saveButton = screen.getByRole('button', { name: 'Lưu mẫu' }) as HTMLButtonElement
        const form = document.querySelector('form')

        expect(saveButton.disabled).toBe(true)
        expect(form).not.toBeNull()
        fireEvent.submit(form!)

        await waitFor(() => {
            expect(
                screen.getByText(/chất lượng mẫu.*bắt buộc|vui lòng.*chất lượng mẫu/i),
            ).toBeDefined()
        })
        expect(screen.queryByTestId('confirm-dialog')).toBeNull()
        expect(mocks.createManualAccessionSampleClient).not.toHaveBeenCalled()
        expect(mocks.assignManualAccessionTestsClient).not.toHaveBeenCalled()
    })

    it('preserves unacceptable quality through no-test confirmation and clears it on reset', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(getQualityCheckbox('Không đạt'))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(screen.getByTestId('confirm-dialog')).toBeDefined()
        })
        expect(getQualityCheckbox('Không đạt').getAttribute('data-state')).toBe('checked')

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tạo mẫu' }))

        await waitFor(() => {
            expect(mocks.createManualAccessionSampleClient).toHaveBeenCalledWith(
                expect.objectContaining({ sample_quality: false }),
            )
        })

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận mẫu mới' }))

        expect(getQualityCheckbox('Đạt').getAttribute('data-state')).toBe('unchecked')
        expect(getQualityCheckbox('Không đạt').getAttribute('data-state')).toBe('unchecked')
    })

    it('includes acceptable quality in the assigned-tests payload', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(getQualityCheckbox('Đạt'))
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(mocks.assignManualAccessionTestsClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    sample_quality: true,
                    tests: [{
                        assayId: 'assay-1',
                        methodId: 'method-1',
                    }],
                }),
            )
        })
    })
})
