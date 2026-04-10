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

import { SampleInspectorColumn } from '../sample-inspector-column'

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

describe('SampleInspectorColumn', () => {
    it('stacks both panel shells in a min-height constrained vertical inspector', () => {
        const { container } = render(<SampleInspectorColumn sample={sample} userRole="manager" />)

        const inspector = container.firstElementChild
        const detailPanel = screen.getByTestId('sample-detail-panel')
        const detailAnimatedContent = detailPanel.parentElement
        const detailShell = detailAnimatedContent?.parentElement
        const assignedPanel = screen.getByTestId('assigned-tests-panel')
        const assignedAnimatedContent = assignedPanel.parentElement
        const assignedShell = assignedAnimatedContent?.parentElement

        expect(inspector?.className).toContain('grid')
        expect(inspector?.className).toContain('min-h-0')
        expect(detailShell?.className).toContain('flex')
        expect(detailShell?.className).toContain('min-h-0')
        expect(detailShell?.className).toContain('overflow-hidden')
        expect(assignedShell?.className).toContain('flex')
        expect(assignedShell?.className).toContain('min-h-0')
        expect(assignedShell?.className).toContain('overflow-hidden')
    })

    it('keeps the visible sample mounted while the next sample is loading', () => {
        const { rerender } = render(<SampleInspectorColumn sample={sample} userRole="manager" />)

        expect(screen.getByTestId('sample-detail-panel').textContent).toBe('CDC-XN-0001')
        expect(screen.getByTestId('assigned-tests-panel').textContent).toBe('sample-1')

        rerender(<SampleInspectorColumn sample={sample} isLoadingSample={true} userRole="manager" />)

        expect(screen.getByTestId('sample-detail-panel').textContent).toBe('CDC-XN-0001')
        expect(screen.getByTestId('assigned-tests-panel').textContent).toBe('sample-1')
        expect(screen.getByText('Đang chuyển sang mẫu tiếp theo...')).toBeDefined()
    })

    it('renders the doctor CoA panel instead of the assigned tests panel for doctors', () => {
        render(<SampleInspectorColumn sample={sample} userRole="doctor" />)

        expect(screen.getByTestId('doctor-coa-panel').textContent).toBe('sample-1')
        expect(screen.queryByTestId('assigned-tests-panel')).toBeNull()
    })
})
