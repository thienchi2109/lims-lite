import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
}

vi.stubGlobal('ResizeObserver', ResizeObserverMock)

const accessionFormMocks = vi.hoisted(() => {
    const createSampleClient = vi.fn()
    const accessionAndAssignTestsClient = vi.fn()
    const createManualAccessionSampleClient = vi.fn()
    const createQrAccessionSampleClient = vi.fn()
    const assignManualAccessionTestsClient = vi.fn()
    const assignQrAccessionTestsClient = vi.fn()
    const findClientByIdentityClient = vi.fn()
    const getPublishedCatalogClient = vi.fn()
    const printSampleBarcodeLabel = vi.fn()
    const toastSuccess = vi.fn()

    const mockClient = {
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
    }

    return {
        createSampleClient,
        accessionAndAssignTestsClient,
        createManualAccessionSampleClient,
        createQrAccessionSampleClient,
        assignManualAccessionTestsClient,
        assignQrAccessionTestsClient,
        findClientByIdentityClient,
        getPublishedCatalogClient,
        printSampleBarcodeLabel,
        toastSuccess,
        mockClient,
        existingSelection: {
            kind: 'existing' as const,
            workflow: 'manual' as const,
            client: mockClient,
            resolution: {
                kind: 'existing' as const,
                governmentIdentityType: 'cccd' as const,
                governmentIdentityValue: '012345678901',
                name: 'Nguyen Van A',
                dateOfBirth: '1990-01-02',
                phone: '0912345678',
            },
        },
        qrDraftSelection: {
            kind: 'draft' as const,
            workflow: 'qr' as const,
            client: {
                id_card_num: '086094006827',
                name: 'Nguyen Van B',
                date_of_birth: '1994-09-21',
                gender: 'Nữ' as const,
                phone: '0901234567',
                address: 'Can Tho',
            },
            resolution: {
                kind: 'draft' as const,
                governmentIdentityType: 'cccd' as const,
                governmentIdentityValue: '086094006827',
                name: 'Nguyen Van B',
                dateOfBirth: '1994-09-21',
                gender: 'Nữ' as const,
                phone: '0901234567',
                address: 'Can Tho',
                healthInsuranceNum: null,
                expiryDate: null,
            },
        },
        mockSelectedTest: {
            assayId: 'assay-1',
            methodId: 'method-1',
            assayName: 'ALT',
            methodName: 'Máy tự động',
            units: 'U/L',
        },
    }
})

vi.mock('@/lib/api-client', () => ({
    createSampleClient: accessionFormMocks.createSampleClient,
    accessionAndAssignTestsClient: accessionFormMocks.accessionAndAssignTestsClient,
    createManualAccessionSampleClient: accessionFormMocks.createManualAccessionSampleClient,
    createQrAccessionSampleClient: accessionFormMocks.createQrAccessionSampleClient,
    assignManualAccessionTestsClient: accessionFormMocks.assignManualAccessionTestsClient,
    assignQrAccessionTestsClient: accessionFormMocks.assignQrAccessionTestsClient,
    findClientByIdentityClient: accessionFormMocks.findClientByIdentityClient,
    getPublishedAssaySampleTypeCatalogClient: accessionFormMocks.getPublishedCatalogClient,
}))

vi.mock('@/lib/sample-label-print-client', () => ({
    printSampleBarcodeLabel: accessionFormMocks.printSampleBarcodeLabel,
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
            selectedClient?: {
                name?: string
                client?: { name: string }
            } | null
            selectedSampleType?: string
            receivedAtValue?: string
            submitError?: string | null
            submitSuccess?: string | null
        }
    }) => (
        <div data-testid="test-assignment-grid">
            <div data-testid="selected-count">{String(selected.length)}</div>
            <div data-testid="selected-client">
                {wizardProps?.selectedClient?.client?.name
                    ?? wizardProps?.selectedClient?.name
                    ?? ''}
            </div>
            <div data-testid="selected-sample-type">{wizardProps?.selectedSampleType ?? ''}</div>
            <div data-testid="received-at-value">{wizardProps?.receivedAtValue ?? ''}</div>
            <div data-testid="submit-error">{wizardProps?.submitError ?? ''}</div>
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
        formData,
        onFormDataChange,
    }: {
        selectedClient: {
            client: { name: string }
        } | null
        onSelect: (client: unknown) => void
        formData?: { name?: string }
        onFormDataChange?: (data: unknown) => void
    }) => (
        <div>
            <div data-testid="client-form-draft-name">{formData?.name ?? ''}</div>
            <button
                type="button"
                onClick={() => onSelect(accessionFormMocks.existingSelection)}
            >
                {selectedClient?.client.name ?? 'Chọn khách hàng'}
            </button>
            <button
                type="button"
                onClick={() => onSelect(accessionFormMocks.qrDraftSelection)}
            >
                Chọn khách hàng QR nháp
            </button>
            <button
                type="button"
                onClick={() => onFormDataChange?.({ name: 'Khách hàng nháp' })}
            >
                Điền nháp khách hàng
            </button>
        </div>
    ),
}))

vi.mock('@/components/sample-type-selector', () => ({
    SampleTypeSelector: ({
        value,
        options,
        onChange,
    }: {
        value: string | null
        options: Array<{ id: string; name: string }>
        onChange: (sampleTypeId: string) => void
    }) => (
        <div>
            <div data-testid="sample-type-value">
                {options.find((sampleType) => sampleType.id === value)?.name ?? ''}
            </div>
            <button
                type="button"
                onClick={() => onChange('22222222-2222-4222-8222-222222222222')}
            >
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

vi.mock('@/lib/qr/parse-client-identity-qr', () => ({
    parseClientIdentityQr: vi.fn(),
}))

vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: accessionFormMocks.toastSuccess,
    },
}))

import { SampleAccessionForm } from '../sample-accession-form'

function selectAcceptableQuality() {
    fireEvent.click(screen.getByRole('checkbox', { name: 'Đạt' }))
}

async function waitForCompatibilityCatalog() {
    await waitFor(() => {
        expect(screen.getByTestId('sample-type-value').textContent).toBe('Máu')
    })
}

describe('SampleAccessionForm', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        accessionFormMocks.findClientByIdentityClient.mockResolvedValue({ data: null })
        accessionFormMocks.getPublishedCatalogClient.mockResolvedValue({
            data: {
                revisionNumber: 7,
                sampleTypeId: null,
                sampleTypes: [
                    {
                        id: '11111111-1111-4111-8111-111111111111',
                        importCode: 'LM-000001',
                        name: 'Máu',
                    },
                    {
                        id: '22222222-2222-4222-8222-222222222222',
                        importCode: 'LM-000002',
                        name: 'Nước tiểu',
                    },
                ],
                assays: [{
                    sampleTypeId: '22222222-2222-4222-8222-222222222222',
                    assayDefinitionId: 'assay-1',
                    importCode: 'CT-000001',
                    name: 'ALT',
                    methodName: 'Máy tự động',
                    specialtyId: null,
                }],
            },
        })
        accessionFormMocks.createSampleClient.mockResolvedValue({
            data: { id: 'sample-created-1', sample_id: 'SMP-001' },
        })
        accessionFormMocks.accessionAndAssignTestsClient.mockResolvedValue({
            data: {
                sample: { id: 'sample-created-2', sample_id: 'SMP-002' },
                results: [{ id: 'result-1' }],
            },
        })
        accessionFormMocks.createManualAccessionSampleClient.mockResolvedValue({
            data: { id: 'sample-created-1', sample_id: 'SMP-001' },
        })
        accessionFormMocks.createQrAccessionSampleClient.mockResolvedValue({
            data: { id: 'sample-created-1', sample_id: 'SMP-001' },
        })
        accessionFormMocks.assignManualAccessionTestsClient.mockResolvedValue({
            data: {
                sample: { id: 'sample-created-2', sample_id: 'SMP-002' },
                results: [{ id: 'result-1' }],
            },
        })
        accessionFormMocks.assignQrAccessionTestsClient.mockResolvedValue({
            data: {
                sample: { id: 'sample-created-2', sample_id: 'SMP-002' },
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

    it('passes submit errors into wizard props for the mobile review flow', async () => {
        accessionFormMocks.assignManualAccessionTestsClient.mockRejectedValueOnce(
            new Error('Không thể lưu mẫu'),
        )

        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(screen.getByTestId('submit-error').textContent).toBe('Không thể lưu mẫu')
        })
    })

    it('preserves submitted state after creating a sample with assigned tests', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(accessionFormMocks.assignManualAccessionTestsClient).toHaveBeenCalledTimes(1)
        })

        expect(screen.getByTestId('submit-success').textContent).toBe(
            'Mẫu SMP-002 đã được tạo và chỉ định 1 xét nghiệm.',
        )
        expect(accessionFormMocks.toastSuccess).toHaveBeenCalledWith(
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
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(screen.getByTestId('confirm-dialog')).toBeDefined()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tạo mẫu' }))

        await waitFor(() => {
            expect(accessionFormMocks.createManualAccessionSampleClient).toHaveBeenCalledTimes(1)
        })

        expect(screen.getByTestId('submit-success').textContent).toBe('Mẫu SMP-001 đã được tạo.')
        expect(accessionFormMocks.toastSuccess).toHaveBeenCalledWith('Mẫu SMP-001 đã được tạo.')
        expect(screen.getByTestId('selected-client').textContent).toBe(
            accessionFormMocks.mockClient.name,
        )
        expect(screen.getByTestId('selected-sample-type').textContent).toBe('Nước tiểu')
        expect(screen.getByTestId('selected-count').textContent).toBe('0')
    })

    it('submits a QR draft through the fixed QR accession action', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng QR nháp' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(accessionFormMocks.assignQrAccessionTestsClient).toHaveBeenCalledWith(
                expect.objectContaining({
                    client_resolution: accessionFormMocks.qrDraftSelection.resolution,
                }),
            )
        })
        const payload =
            accessionFormMocks.assignQrAccessionTestsClient.mock.calls[0][0]
        expect(payload).not.toHaveProperty('client_id')
        expect(payload).not.toHaveProperty('client_name')
        expect(accessionFormMocks.assignManualAccessionTestsClient).not.toHaveBeenCalled()
    })

    it('offers barcode label printing after creating a sample', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(screen.getByTestId('confirm-dialog')).toBeDefined()
        })

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục tạo mẫu' }))

        await waitFor(() => {
            expect(screen.getByRole('button', { name: 'In nhãn barcode' })).toBeDefined()
        })

        const printButton = screen.getByRole('button', { name: 'In nhãn barcode' })
        const viewSampleLink = screen.getByRole('link', { name: 'Xem mẫu vừa tạo' })
        const newAccessionButton = screen.getByRole('button', { name: 'Tiếp nhận mẫu mới' })
        expect(
            Array.from(printButton.parentElement?.children ?? []).map((element) =>
                element.textContent?.replace(/\s+/g, ' ').trim(),
            ),
        ).toEqual(['Xem mẫu vừa tạo', 'In nhãn barcode', 'Tiếp nhận mẫu mới'])
        expect(viewSampleLink.getAttribute('href')).toBe('/samples?sampleId=sample-created-1')
        expect(printButton.parentElement?.className).not.toContain('sm:flex-row')
        expect(printButton.className).toContain('whitespace-normal')
        expect(newAccessionButton.className).toContain('whitespace-normal')

        fireEvent.click(printButton)

        expect(screen.getByRole('dialog', { name: 'Cấu hình nhãn barcode' })).toBeDefined()

        fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }))

        expect(accessionFormMocks.printSampleBarcodeLabel).toHaveBeenCalledWith('sample-created-1', {
            preset: 'thermal-35x23-sheet-2up',
        })
    })

    it('requires an explicit desktop reset before another save after success', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Chọn Nước tiểu' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))

        const saveButton = screen.getByRole('button', { name: 'Lưu mẫu' })
        fireEvent.click(saveButton)

        await waitFor(() => {
            expect(accessionFormMocks.assignManualAccessionTestsClient).toHaveBeenCalledTimes(1)
        })

        expect((saveButton as HTMLButtonElement).disabled).toBe(true)

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận mẫu mới' }))

        expect(screen.getByTestId('submit-success').textContent).toBe('')
        expect(screen.getByTestId('selected-client').textContent).toBe('')
        expect(screen.getByTestId('selected-sample-type').textContent).toBe('Máu')
        expect(screen.getByTestId('selected-count').textContent).toBe('0')
        expect(screen.getByRole('checkbox', { name: 'Đạt' }).getAttribute('data-state')).toBe('unchecked')
        expect(screen.getByRole('checkbox', { name: 'Không đạt' }).getAttribute('data-state')).toBe('unchecked')
        expect((saveButton as HTMLButtonElement).disabled).toBe(true)
    })

    it('clears the client draft data when starting a new accession', async () => {
        render(<SampleAccessionForm specialties={[]} />)
        await waitForCompatibilityCatalog()

        fireEvent.click(screen.getByRole('button', { name: 'Điền nháp khách hàng' }))
        expect(screen.getByTestId('client-form-draft-name').textContent).toBe('Khách hàng nháp')

        fireEvent.click(screen.getByRole('button', { name: 'Chọn khách hàng' }))
        selectAcceptableQuality()
        fireEvent.click(screen.getByRole('button', { name: 'Thêm xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Lưu mẫu' }))

        await waitFor(() => {
            expect(accessionFormMocks.assignManualAccessionTestsClient).toHaveBeenCalledTimes(1)
        })

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp nhận mẫu mới' }))

        expect(screen.getByTestId('client-form-draft-name').textContent).toBe('')
    })
})
