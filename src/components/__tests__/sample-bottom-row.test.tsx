import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div {...props}>{children}</div>
        ),
    },
}))

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

import { SampleBottomRow } from '../sample-bottom-row'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
} as any

describe('SampleBottomRow', () => {
    it('keeps both animated panel shells constrained so child panels can own scrolling', () => {
        render(<SampleBottomRow sample={sample} userRole="manager" />)

        const detailPanel = screen.getByTestId('sample-detail-panel')
        const detailAnimatedContent = detailPanel.parentElement
        const detailShell = detailAnimatedContent?.parentElement
        const assignedPanel = screen.getByTestId('assigned-tests-panel')
        const assignedAnimatedContent = assignedPanel.parentElement
        const assignedShell = assignedAnimatedContent?.parentElement

        expect(detailShell?.className).toContain('min-h-0')
        expect(detailShell?.className).toContain('overflow-hidden')
        expect(detailAnimatedContent?.className).toContain('min-h-0')
        expect(assignedShell?.className).toContain('min-h-0')
        expect(assignedShell?.className).toContain('overflow-hidden')
        expect(assignedAnimatedContent?.className).toContain('min-h-0')
    })

    it('uses compact spacing between panels in the selected-sample layout', () => {
        const { container } = render(<SampleBottomRow sample={sample} userRole="manager" />)

        const grid = container.firstElementChild

        expect(grid?.className).toContain('gap-2')
    })
})
