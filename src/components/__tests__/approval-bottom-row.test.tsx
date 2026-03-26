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

    it('keeps approval actions in a fixed footer while the assigned tests panel uses the remaining height', () => {
        render(
            <ApprovalBottomRow
                sample={sample}
                results={[]}
            />,
        )

        const assignedTestsPanel = screen.getByTestId('assigned-tests-panel')
        const approvalActions = screen.getByTestId('approval-actions')
        const assignedTestsRegion = assignedTestsPanel.parentElement
        const approvalActionsFooter = approvalActions.parentElement
        const rightColumn = assignedTestsRegion?.parentElement
        const detailPanel = screen.getByTestId('sample-detail-panel')
        const detailContent = detailPanel.parentElement
        const detailShell = detailContent?.parentElement

        expect(detailShell?.className).toContain('flex')
        expect(detailShell?.className).toContain('flex-col')
        expect(detailShell?.className).toContain('overflow-hidden')
        expect(detailShell?.className).not.toContain('overflow-y-auto')
        expect(detailContent?.className).toContain('flex-1')
        expect(detailContent?.className).toContain('min-h-0')
        expect(assignedTestsRegion?.className).toContain('space-y-2')
        expect(rightColumn?.className).toContain('overflow-y-auto')
        expect(rightColumn?.className).toContain('min-h-0')
    })
})
