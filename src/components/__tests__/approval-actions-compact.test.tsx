/**
 * Tests for ApprovalActions compact mode (mobile drawer).
 * Verifies that compact=true removes Card wrapper and uses smaller buttons.
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

// Mock dialog components to keep tests focused
vi.mock('@/components/approval-dialog', () => ({
    ApprovalDialog: () => null,
}))
vi.mock('@/components/reject-sample-dialog', () => ({
    RejectSampleDialog: () => null,
}))
vi.mock('@/components/discard-sample-dialog', () => ({
    DiscardSampleDialog: () => null,
}))

import { ApprovalActions } from '../approval-actions'
import type { ResultWithAssay } from '@/types'

const mockResults: ResultWithAssay[] = [
    { id: 'r1', assay_name: 'Creatinine', status: 'entered', sample_status: 'review' },
    { id: 'r2', assay_name: 'Glucose', status: 'approved', sample_status: 'review' },
] as unknown as ResultWithAssay[]

describe('ApprovalActions compact mode', () => {
    it('does not render Card wrapper in compact mode', () => {
        const { container } = render(
            <ApprovalActions sampleId="s1" results={mockResults} compact />,
        )

        // Card wrapper has id="tour-approval-actions" in non-compact mode
        expect(container.querySelector('#tour-approval-actions')).toBeNull()
        // Should not have CardTitle text
        expect(screen.queryByText('Thao tác phê duyệt')).toBeNull()
    })

    it('renders Card wrapper in default (non-compact) mode', () => {
        const { container } = render(
            <ApprovalActions sampleId="s1" results={mockResults} />,
        )

        expect(container.querySelector('#tour-approval-actions')).not.toBeNull()
        expect(screen.getByText('Thao tác phê duyệt')).toBeDefined()
    })

    it('uses shorter button labels in compact mode', () => {
        render(
            <ApprovalActions sampleId="s1" results={mockResults} compact />,
        )

        // Short labels instead of full labels
        expect(screen.getByText(/Duyệt/)).toBeDefined()
        expect(screen.getByText(/Hủy/)).toBeDefined()
        // Should NOT show long labels
        expect(screen.queryByText(/Phê duyệt 1 kết quả/)).toBeNull()
        expect(screen.queryByText(/Hủy phê duyệt/)).toBeNull()
    })

    it('hides summary bullet points in compact mode', () => {
        render(
            <ApprovalActions sampleId="s1" results={mockResults} compact />,
        )

        expect(screen.queryByText(/kết quả sẵn sàng phê duyệt/)).toBeNull()
        expect(screen.queryByText(/kết quả đã được phê duyệt/)).toBeNull()
        expect(screen.queryByText(/kết quả đang chờ nhập liệu/)).toBeNull()
    })
})
