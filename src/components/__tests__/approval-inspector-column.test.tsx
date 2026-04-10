import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'

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

vi.mock('@/components/ui/sticky-panel-shell', () => ({
    StickyPanelShell: ({
        children,
        header,
        bodyClassName,
    }: {
        children: ReactNode
        header: ReactNode
        bodyClassName?: string
    }) => (
        <div data-testid="sticky-panel-shell">
            <div data-testid="sticky-panel-header">{header}</div>
            <div data-testid="sticky-panel-body" className={bodyClassName}>
                {children}
            </div>
        </div>
    ),
}))

import { ApprovalInspectorColumn } from '../approval-inspector-column'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
} as const

describe('ApprovalInspectorColumn', () => {
    it('stacks detail and tests panels in a min-height constrained inspector column', () => {
        const { container } = render(
            <ApprovalInspectorColumn
                sample={sample as never}
                results={[]}
            />,
        )

        const inspector = container.firstElementChild
        const shells = screen.getAllByTestId('sticky-panel-shell')
        const bodies = screen.getAllByTestId('sticky-panel-body')

        expect(inspector?.className).toContain('grid')
        expect(inspector?.className).toContain('min-h-0')
        expect(shells).toHaveLength(2)
        expect(bodies[0]?.className).toContain('min-h-0')
        expect(bodies[1]?.className).toContain('min-h-0')
    })

    it('keeps approval actions in the lower panel while tests remain mounted during loading', () => {
        const { rerender } = render(
            <ApprovalInspectorColumn
                sample={sample as never}
                results={[]}
            />,
        )

        expect(screen.getByTestId('assigned-tests-panel').textContent).toBe('sample-1')
        expect(screen.getByTestId('approval-actions').textContent).toBe('sample-1')

        rerender(
            <ApprovalInspectorColumn
                sample={sample as never}
                results={[]}
                isLoadingSample={true}
            />,
        )

        expect(screen.getByTestId('assigned-tests-panel').textContent).toBe('sample-1')
        expect(screen.getByTestId('approval-actions').textContent).toBe('sample-1')
        expect(screen.getByText('Đang tải chi tiết mẫu...')).toBeDefined()
    })
})
