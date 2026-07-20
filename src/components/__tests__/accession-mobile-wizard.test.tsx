import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/accession-wizard-stepper', () => ({
    AccessionWizardStepper: () => <div data-testid="wizard-stepper" />,
}))

vi.mock('@/components/accession-wizard-step-customer', () => ({
    AccessionWizardStepCustomer: ({ onNext }: { onNext: () => void }) => (
        <button type="button" onClick={onNext}>
            Tiếp tục khách hàng
        </button>
    ),
}))

vi.mock('@/components/accession-wizard-step-tests', () => ({
    AccessionWizardStepTests: ({ onNext }: { onNext: () => void }) => (
        <button type="button" onClick={onNext}>
            Tiếp tục xét nghiệm
        </button>
    ),
}))

vi.mock('@/components/accession-wizard-step-review', () => ({
    AccessionWizardStepReview: ({
        submitError,
        onConfirm,
        isSaveDisabled,
    }: {
        submitError?: string | null
        onConfirm: () => void
        isSaveDisabled?: boolean
    }) => (
        <div>
            <div data-testid="review-submit-error">{submitError ?? ''}</div>
            <button type="button" onClick={onConfirm} disabled={isSaveDisabled}>
                Xác nhận lưu
            </button>
        </div>
    ),
}))

vi.mock('@/components/accession-wizard-step-success', () => ({
    AccessionWizardStepSuccess: ({
        successMessage,
        onNewAccession,
    }: {
        successMessage: string
        onNewAccession: () => void
    }) => (
        <div data-testid="wizard-success">
            <span>{successMessage}</span>
            <button type="button" onClick={onNewAccession}>
                Tạo mẫu mới
            </button>
        </div>
    ),
}))

import { AccessionMobileWizard } from '../accession-mobile-wizard'
import type { AccessionMobileWizardProps } from '../accession-mobile-wizard'

function createWizardProps(overrides: Partial<AccessionMobileWizardProps> = {}): AccessionMobileWizardProps {
    return {
        selectedClient: {
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
        onSelectClient: vi.fn(),
        showClientForm: false,
        onOpenFormChange: vi.fn(),
        clientFormData: undefined,
        onFormDataChange: vi.fn(),
        showQRScanner: false,
        onShowQRScanner: vi.fn(),
        onQRScan: vi.fn(),
        selectedSampleType: 'Máu',
        onSampleTypeChange: vi.fn(),
        sampleQuality: true,
        onSampleQualityChange: vi.fn(),
        receivedAtRegister: {
            name: 'received_at',
            onChange: vi.fn(),
            onBlur: vi.fn(),
            ref: vi.fn(),
        },
        receivedAtValue: '2026-03-17T08:30',
        searchQuery: '',
        setSearchQuery: vi.fn(),
        selectedSpecialtyId: 'all',
        setSelectedSpecialtyId: vi.fn(),
        specialties: [],
        groupedRows: [],
        isLoading: false,
        disabledSet: new Set(),
        specialtiesMap: new Map(),
        selected: [],
        onChange: vi.fn(),
        toggleTestSelection: vi.fn(),
        handleMethodChange: vi.fn(),
        onSave: vi.fn(),
        isSaving: false,
        submitError: null,
        submitSuccess: null,
        onReset: vi.fn(),
        ...overrides,
    }
}

describe('AccessionMobileWizard', () => {
    it('passes submitError into the review step', () => {
        render(
            <AccessionMobileWizard {...createWizardProps({ submitError: 'Không thể lưu mẫu' })} />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xét nghiệm' }))

        expect(screen.getByTestId('review-submit-error').textContent).toBe('Không thể lưu mẫu')
    })

    it('disables review confirmation when sample quality is missing', () => {
        render(
            <AccessionMobileWizard {...createWizardProps({ sampleQuality: null })} />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xét nghiệm' }))

        expect(
            (screen.getByRole('button', { name: 'Xác nhận lưu' }) as HTMLButtonElement).disabled,
        ).toBe(true)
    })

    it('calls onSave from the review step', () => {
        const onSave = vi.fn()

        render(<AccessionMobileWizard {...createWizardProps({ onSave })} />)

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xét nghiệm' }))
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận lưu' }))

        expect(onSave).toHaveBeenCalledTimes(1)
    })

    it('moves to success after submitSuccess changes and starts a new accession', () => {
        const onReset = vi.fn()
        const props = createWizardProps({ onReset })
        const { rerender } = render(<AccessionMobileWizard {...props} />)

        rerender(
            <AccessionMobileWizard
                {...props}
                submitSuccess="Đã tạo mẫu thành công"
            />,
        )

        expect(screen.getByTestId('wizard-success').textContent).toContain('Đã tạo mẫu thành công')

        fireEvent.click(screen.getByRole('button', { name: 'Tạo mẫu mới' }))

        expect(onReset).toHaveBeenCalledTimes(1)

        rerender(<AccessionMobileWizard {...props} />)

        expect(screen.getByTestId('wizard-stepper')).toBeDefined()
    })
})
