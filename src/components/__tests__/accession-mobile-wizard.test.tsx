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
    AccessionWizardStepReview: ({ submitError }: { submitError?: string | null }) => (
        <div data-testid="review-submit-error">{submitError ?? ''}</div>
    ),
}))

vi.mock('@/components/accession-wizard-step-success', () => ({
    AccessionWizardStepSuccess: () => <div data-testid="wizard-success" />,
}))

import { AccessionMobileWizard } from '../accession-mobile-wizard'

describe('AccessionMobileWizard', () => {
    it('passes submitError into the review step', () => {
        render(
            <AccessionMobileWizard
                selectedClient={{
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
                }}
                onSelectClient={vi.fn()}
                showClientForm={false}
                onOpenFormChange={vi.fn()}
                clientFormData={undefined}
                onFormDataChange={vi.fn()}
                showQRScanner={false}
                onShowQRScanner={vi.fn()}
                onQRScan={vi.fn()}
                selectedSampleType="Máu"
                onSampleTypeChange={vi.fn()}
                receivedAtRegister={{
                    name: 'received_at',
                    onChange: vi.fn(),
                    onBlur: vi.fn(),
                    ref: vi.fn(),
                }}
                receivedAtValue="2026-03-17T08:30"
                searchQuery=""
                setSearchQuery={vi.fn()}
                selectedSpecialtyId="all"
                setSelectedSpecialtyId={vi.fn()}
                specialties={[]}
                groupedRows={[]}
                isLoading={false}
                disabledSet={new Set()}
                specialtiesMap={new Map()}
                selected={[]}
                onChange={vi.fn()}
                toggleTestSelection={vi.fn()}
                handleMethodChange={vi.fn()}
                onSave={vi.fn()}
                isSaving={false}
                submitError="Không thể lưu mẫu"
                submitSuccess={null}
                onReset={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục khách hàng' }))
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xét nghiệm' }))

        expect(screen.getByTestId('review-submit-error').textContent).toBe('Không thể lưu mẫu')
    })
})
