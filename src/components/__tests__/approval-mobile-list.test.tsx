/**
 * Tests for ApprovalMobileList component.
 * Verifies card list rendering, empty state, and selection behavior.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApprovalMobileList } from '../approval-mobile-list'
import type { ApprovalCardSample } from '../approval-sample-card'

const makeSample = (overrides: Partial<ApprovalCardSample> = {}): ApprovalCardSample => ({
    id: 'uuid-1',
    sample_id: 'CDC-XN-05012026-0001',
    status: 'review',
    client_name: 'Nguyễn Thành Duy',
    total_tests: 3,
    entered_count: 2,
    approved_count: 0,
    pending_count: 1,
    updated_at: '2026-01-05T10:30:00Z',
    coa_reports: null,
    ...overrides,
})

const samples: ApprovalCardSample[] = [
    makeSample({ id: 'uuid-1', sample_id: 'CDC-XN-05012026-0001', client_name: 'Nguyễn A' }),
    makeSample({ id: 'uuid-2', sample_id: 'CDC-XN-05012026-0002', client_name: 'Trần B' }),
    makeSample({ id: 'uuid-3', sample_id: 'CDC-XN-05012026-0003', client_name: 'Lê C' }),
]

describe('ApprovalMobileList', () => {
    it('renders a card for each sample', () => {
        render(
            <ApprovalMobileList
                samples={samples}
                selectedSampleId={null}
                onSelectSample={vi.fn()}
            />,
        )

        expect(screen.getByText('CDC-XN-05012026-0001')).toBeDefined()
        expect(screen.getByText('CDC-XN-05012026-0002')).toBeDefined()
        expect(screen.getByText('CDC-XN-05012026-0003')).toBeDefined()
    })

    it('shows summary counter with sample count', () => {
        render(
            <ApprovalMobileList
                samples={samples}
                selectedSampleId={null}
                onSelectSample={vi.fn()}
            />,
        )

        expect(screen.getByText(/3 mẫu/)).toBeDefined()
    })

    it('shows empty state when no samples', () => {
        render(
            <ApprovalMobileList
                samples={[]}
                selectedSampleId={null}
                onSelectSample={vi.fn()}
            />,
        )

        expect(screen.getByText(/Không có mẫu/)).toBeDefined()
    })

    it('calls onSelectSample when a card is tapped', () => {
        const onSelect = vi.fn()
        render(
            <ApprovalMobileList
                samples={samples}
                selectedSampleId={null}
                onSelectSample={onSelect}
            />,
        )

        // Tap the second card
        const secondCard = screen.getByText('Trần B').closest('button')!
        fireEvent.click(secondCard)

        expect(onSelect).toHaveBeenCalledWith('uuid-2')
    })

    it('highlights the selected card', () => {
        render(
            <ApprovalMobileList
                samples={samples}
                selectedSampleId="uuid-2"
                onSelectSample={vi.fn()}
            />,
        )

        // The selected card should have the accent border class
        const selectedCard = screen.getByText('Trần B').closest('button')!
        expect(selectedCard.className).toContain('border-sky-500')

        // Other cards should not
        const otherCard = screen.getByText('Nguyễn A').closest('button')!
        expect(otherCard.className).not.toContain('border-sky-500')
    })
})
