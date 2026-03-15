/**
 * Tests for ApprovalSampleCard component.
 * Verifies card renders sample info correctly and handles user interaction.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ApprovalSampleCard, type ApprovalCardSample } from '../approval-sample-card'

const baseSample: ApprovalCardSample = {
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
}

describe('ApprovalSampleCard', () => {
    it('renders sample ID in monospace', () => {
        render(<ApprovalSampleCard sample={baseSample} onSelect={vi.fn()} />)

        const sampleId = screen.getByText('CDC-XN-05012026-0001')
        expect(sampleId).toBeDefined()
        expect(sampleId.className).toContain('font-mono')
    })

    it('renders client name', () => {
        render(<ApprovalSampleCard sample={baseSample} onSelect={vi.fn()} />)

        expect(screen.getByText('Nguyễn Thành Duy')).toBeDefined()
    })

    it('renders progress text with combined counts', () => {
        render(<ApprovalSampleCard sample={baseSample} onSelect={vi.fn()} />)

        expect(screen.getByText(/2\/3 xét nghiệm/)).toBeDefined()
    })

    it('calls onSelect with sample id when tapped', () => {
        const onSelect = vi.fn()
        render(<ApprovalSampleCard sample={baseSample} onSelect={onSelect} />)

        const card = screen.getByRole('button')
        fireEvent.click(card)

        expect(onSelect).toHaveBeenCalledWith('uuid-1')
    })

    it('shows selected state with accent border', () => {
        render(
            <ApprovalSampleCard sample={baseSample} isSelected onSelect={vi.fn()} />,
        )

        const card = screen.getByRole('button')
        expect(card.className).toContain('border-sky-500')
    })

    it('does not show selected state when not selected', () => {
        render(
            <ApprovalSampleCard sample={baseSample} isSelected={false} onSelect={vi.fn()} />,
        )

        const card = screen.getByRole('button')
        expect(card.className).not.toContain('border-sky-500')
    })

    it('renders "Không có tên" when client_name is null', () => {
        const sampleNoClient = { ...baseSample, client_name: null }
        render(<ApprovalSampleCard sample={sampleNoClient} onSelect={vi.fn()} />)

        expect(screen.getByText('Không có tên')).toBeDefined()
    })
})
