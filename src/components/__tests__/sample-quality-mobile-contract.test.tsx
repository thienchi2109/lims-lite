import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/accession-wizard-stepper', () => ({
    AccessionWizardStepper: () => <div />,
}))

vi.mock('@/components/accession-wizard-step-tests', () => ({
    AccessionWizardStepTests: ({ onNext }: { onNext: () => void }) => (
        <button type="button" onClick={onNext}>
            Tiếp tục xét nghiệm
        </button>
    ),
}))

vi.mock('@/components/accession-wizard-step-success', () => ({
    AccessionWizardStepSuccess: () => <div />,
}))

vi.mock('@/components/client-selector', () => ({
    ClientSelector: ({ selectedClient }: { selectedClient: { name: string } | null }) => (
        <div>{selectedClient?.name ?? 'Chọn khách hàng'}</div>
    ),
}))

vi.mock('@/components/sample-type-selector', () => ({
    SampleTypeSelector: ({ value }: { value: string }) => (
        <div data-testid="mobile-sample-type">{value}</div>
    ),
}))

vi.mock('@/components/client-qr-scanner-dialog', () => ({
    ClientQrScannerDialog: () => null,
}))

import { AccessionMobileWizard } from '../accession-mobile-wizard'
import type { AccessionMobileWizardProps } from '../accession-mobile-wizard'

const client = {
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
}

function createWizardProps(): AccessionMobileWizardProps {
    return {
        selectedClient: client,
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
        sampleQuality: null,
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
    }
}

function MobileQualityHarness({ initialQuality = null }: {
    initialQuality?: boolean | null
}) {
    const [sampleQuality, setSampleQuality] = useState<boolean | null>(initialQuality)

    return (
        <AccessionMobileWizard
            {...createWizardProps()}
            sampleQuality={sampleQuality}
            onSampleQualityChange={setSampleQuality}
        />
    )
}

describe('mobile sample quality accession contract', () => {
    it('renders the required exclusive checkboxes below sample type and blocks next by default', () => {
        render(<MobileQualityHarness />)

        const sampleTypeLabel = screen.getByText(/Loại mẫu/)
        const qualityLabel = screen.getByText(/Chất lượng mẫu/)
        const receivedAtLabel = screen.getByText('Thời gian nhận')
        const acceptable = screen.getByRole('checkbox', { name: 'Đạt' })
        const unacceptable = screen.getByRole('checkbox', { name: 'Không đạt' })
        const nextButton = screen.getByRole('button', { name: /Tiếp theo/ }) as HTMLButtonElement

        expect(screen.getAllByRole('checkbox')).toHaveLength(2)
        expect(acceptable.getAttribute('data-state')).toBe('unchecked')
        expect(unacceptable.getAttribute('data-state')).toBe('unchecked')
        expect(nextButton.disabled).toBe(true)
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
        expect(nextButton.disabled).toBe(false)

        fireEvent.click(unacceptable)
        expect(acceptable.getAttribute('data-state')).toBe('unchecked')
        expect(unacceptable.getAttribute('data-state')).toBe('checked')
    })

    it('preserves unacceptable quality into the mobile review step', () => {
        render(<MobileQualityHarness initialQuality={false} />)

        fireEvent.click(screen.getByRole('button', { name: /Tiếp theo/ }))
        fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục xét nghiệm' }))

        expect(screen.getByText('Chất lượng mẫu')).toBeDefined()
        expect(screen.getByText('Không đạt')).toBeDefined()
    })
})
