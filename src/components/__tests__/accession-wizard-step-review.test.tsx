import React from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AccessionWizardStepReview } from '../accession-wizard-step-review'

describe('AccessionWizardStepReview', () => {
    it('adds extra scroll padding when submitError is shown above the footer actions', () => {
        const { container } = render(
            <AccessionWizardStepReview
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
                selectedSampleType="Máu"
                receivedAt="2026-03-17T08:30"
                selected={[]}
                submitError="Không thể lưu mẫu"
                onBack={vi.fn()}
                onGoToStep={vi.fn()}
                onConfirm={vi.fn()}
                isSaving={false}
            />,
        )

        const scrollArea = container.querySelector('.overflow-y-auto')

        expect(scrollArea?.className ?? '').toContain('pb-40')
        expect(screen.getByText('Không thể lưu mẫu')).toBeDefined()
    })

    it('disables confirm when saving is explicitly disabled', () => {
        render(
            React.createElement(AccessionWizardStepReview as any, {
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
                selectedSampleType: 'Máu',
                receivedAt: '2026-03-17T08:30',
                selected: [],
                onBack: vi.fn(),
                onGoToStep: vi.fn(),
                onConfirm: vi.fn(),
                isSaving: false,
                isSaveDisabled: true,
            }),
        )

        expect((screen.getByRole('button', { name: /Xác nhận/i }) as HTMLButtonElement).disabled).toBe(true)
    })
})
