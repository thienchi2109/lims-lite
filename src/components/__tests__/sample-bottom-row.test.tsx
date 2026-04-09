import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SampleWithUser } from '@/types'

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

vi.mock('@/components/doctor-coa-panel', () => ({
    DoctorCoAPanel: ({ sampleId }: { sampleId: string }) => (
        <div data-testid="doctor-coa-panel">{sampleId}</div>
    ),
}))

import { SampleBottomRow } from '../sample-bottom-row'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
    client_id: null,
    client_name: null,
    type: 'Máu',
    status: 'completed',
    received_at: '2026-04-09T00:00:00.000Z',
    received_by: null,
    received_by_name: null,
    created_at: '2026-04-09T00:00:00.000Z',
    updated_at: '2026-04-09T00:00:00.000Z',
    deleted_at: null,
} satisfies SampleWithUser

describe('SampleBottomRow', () => {
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

    it('keeps the visible right panel content mounted while the next sample is loading and shows a localized transition notice', () => {
        const sampleA = {
            ...sample,
            id: 'sample-a',
            sample_id: 'CDC-XN-0001',
        }

        const { rerender } = render(<SampleBottomRow sample={sampleA} userRole="manager" />)

        expect(screen.getByTestId('sample-detail-panel')).toBeDefined()
        expect(screen.getByTestId('assigned-tests-panel')).toBeDefined()

        rerender(<SampleBottomRow sample={sampleA} isLoadingSample={true} userRole="manager" />)

        expect(screen.getByTestId('sample-detail-panel').textContent).toBe('CDC-XN-0001')
        expect(screen.getByTestId('assigned-tests-panel').textContent).toBe('sample-a')
        expect(screen.getByText('Đang chuyển sang mẫu tiếp theo...')).toBeDefined()
        expect(screen.queryByText('Đang tải chi tiết mẫu...')).toBeNull()
        expect(screen.queryByText('Đang tải...')).toBeNull()
    })

    it('renders the doctor CoA panel instead of the assigned tests panel for doctors', () => {
        render(<SampleBottomRow sample={sample} userRole="doctor" />)

        expect(screen.getByTestId('doctor-coa-panel').textContent).toBe('sample-1')
        expect(screen.queryByTestId('assigned-tests-panel')).toBeNull()
    })
})
