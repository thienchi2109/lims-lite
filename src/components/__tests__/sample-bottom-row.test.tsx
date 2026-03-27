import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const assignedTestsPanelCalls: Array<Record<string, unknown>> = []

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
    AssignedTestsPanel: (props: { sampleId: string; initialResults?: unknown[] }) => {
        assignedTestsPanelCalls.push(props)

        return <div data-testid="assigned-tests-panel">{props.sampleId}</div>
    },
}))

import { SampleBottomRow } from '../sample-bottom-row'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
} as any

describe('SampleBottomRow', () => {
    beforeEach(() => {
        assignedTestsPanelCalls.length = 0
    })

    it('keeps both animated panel shells in a flex min-height chain so child panels can own scrolling', () => {
        render(<SampleBottomRow sample={sample} userRole="manager" />)

        const detailPanel = screen.getByTestId('sample-detail-panel')
        const detailAnimatedContent = detailPanel.parentElement
        const detailShell = detailAnimatedContent?.parentElement
        const assignedPanel = screen.getByTestId('assigned-tests-panel')
        const assignedAnimatedContent = assignedPanel.parentElement
        const assignedShell = assignedAnimatedContent?.parentElement

        expect(detailShell?.className).toContain('flex')
        expect(detailShell?.className).toContain('min-h-0')
        expect(detailShell?.className).toContain('overflow-hidden')
        expect(detailAnimatedContent?.className).toContain('flex-1')
        expect(detailAnimatedContent?.className).toContain('min-h-0')
        expect(assignedShell?.className).toContain('flex')
        expect(assignedShell?.className).toContain('min-h-0')
        expect(assignedShell?.className).toContain('overflow-hidden')
        expect(assignedAnimatedContent?.className).toContain('flex-1')
        expect(assignedAnimatedContent?.className).toContain('min-h-0')
    })

    it('uses compact spacing between panels in the selected-sample layout', () => {
        const { container } = render(<SampleBottomRow sample={sample} userRole="manager" />)

        const grid = container.firstElementChild

        expect(grid?.className).toContain('gap-2')
    })

    it('forwards embedded core results into the assigned-tests panel so the right side can render without a second fetch', () => {
        const sampleWithEmbeddedResults = {
            ...sample,
            results: [
                {
                    id: 'result-1',
                    assay_id: 'assay-1',
                    assay_name: 'Creatinine',
                },
            ],
        } as any

        render(<SampleBottomRow sample={sampleWithEmbeddedResults} userRole="manager" />)

        expect(assignedTestsPanelCalls.at(-1)).toMatchObject({
            sampleId: 'sample-1',
            initialResults: sampleWithEmbeddedResults.results,
        })
    })
})
