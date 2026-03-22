import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/sample-detail-panel', () => ({
    SampleDetailPanel: ({ sample }: { sample: { sample_id: string } }) => (
        <div data-testid="sample-detail-panel">{sample.sample_id}</div>
    ),
}))

vi.mock('@/components/assigned-tests-panel', () => ({
    AssignedTestsPanel: ({ sampleId }: { sampleId: string }) => (
        <div data-testid="assigned-tests-panel">{sampleId}</div>
    ),
}))

vi.mock('@/components/approval-actions', () => ({
    ApprovalActions: ({ sampleId }: { sampleId: string }) => (
        <button type="button" data-testid="approval-actions">{sampleId}</button>
    ),
}))

import { ApprovalBottomRow } from '../approval-bottom-row'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
} as any

describe('ApprovalBottomRow', () => {
    it('renders a blocking loading overlay while the next sample detail is loading', () => {
        render(
            <ApprovalBottomRow
                sample={sample}
                results={[]}
                isLoadingSample
            />,
        )

        const overlay = screen.getByText('Đang tải chi tiết mẫu...').parentElement

        expect(overlay?.className).toContain('absolute')
        expect(overlay?.className).not.toContain('pointer-events-none')
    })
})
