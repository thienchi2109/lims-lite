/**
 * Tests for ApprovalMobileDetail component.
 * Verifies drawer content rendering with sample data.
 *
 * Note: vaul Drawer portal/animation is not testable in jsdom.
 * We test the content rendering logic; drawer open/close is verified in browser.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock the heavy child components to keep test focused and fast
vi.mock('@/components/sample-detail-panel', () => ({
    SampleDetailPanel: ({ sample }: any) => (
        <div data-testid="sample-detail-panel">{sample.sample_id}</div>
    ),
}))

vi.mock('@/components/assigned-tests-panel', () => ({
    AssignedTestsPanel: ({ sampleId }: any) => (
        <div data-testid="assigned-tests-panel">{sampleId}</div>
    ),
}))

vi.mock('@/components/approval-actions', () => ({
    ApprovalActions: ({ sampleId, results }: any) => (
        <div data-testid="approval-actions">{sampleId} ({results.length} results)</div>
    ),
}))

// Mock vaul Drawer to render children directly (no portal/animation)
vi.mock('@/components/ui/drawer', () => ({
    Drawer: ({ open, children }: any) => open ? <div data-testid="drawer">{children}</div> : null,
    DrawerContent: ({ children, className }: any) => <div className={className}>{children}</div>,
    DrawerHeader: ({ children }: any) => <div>{children}</div>,
    DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
    DrawerClose: ({ children }: any) => <button data-testid="drawer-close">{children}</button>,
}))

import { render, screen } from '@testing-library/react'
import { ApprovalMobileDetail } from '../approval-mobile-detail'
import type { SampleWithUser, ResultWithAssay } from '@/types'

const mockSample = {
    id: 'uuid-1',
    sample_id: 'CDC-XN-05012026-0001',
    status: 'review',
    client_id: 'client-1',
    client_name: 'Nguyễn Thành Duy',
    received_at: '2026-01-05T08:00:00Z',
    updated_at: '2026-01-05T10:30:00Z',
} as unknown as SampleWithUser

const mockResults: ResultWithAssay[] = [
    { id: 'r1', assay_name: 'Creatinine', status: 'entered' },
    { id: 'r2', assay_name: 'Glucose', status: 'entered' },
] as unknown as ResultWithAssay[]

describe('ApprovalMobileDetail', () => {
    it('renders nothing when not open', () => {
        const { container } = render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={false}
                onClose={vi.fn()}
            />,
        )

        expect(container.innerHTML).toBe('')
    })

    it('renders drawer with sample detail panel when open', () => {
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByTestId('sample-detail-panel')).toBeDefined()
        expect(screen.getByTestId('sample-detail-panel').textContent).toContain('CDC-XN-05012026-0001')
    })

    it('renders assigned tests panel with sampleId', () => {
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByTestId('assigned-tests-panel')).toBeDefined()
        expect(screen.getByTestId('assigned-tests-panel').textContent).toContain('uuid-1')
    })

    it('renders approval actions with results', () => {
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByTestId('approval-actions')).toBeDefined()
        expect(screen.getByTestId('approval-actions').textContent).toContain('2 results')
    })

    it('renders sample ID in the drawer header', () => {
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={vi.fn()}
            />,
        )

        // Sample ID appears in both DrawerTitle and mocked SampleDetailPanel
        const matches = screen.getAllByText('CDC-XN-05012026-0001')
        expect(matches.length).toBeGreaterThanOrEqual(1)

        // Verify at least one is inside an h2 (DrawerTitle)
        const headerMatch = matches.find((el) => el.tagName === 'H2')
        expect(headerMatch).toBeDefined()
    })

    it('renders nothing when sample is null even if open', () => {
        const { container } = render(
            <ApprovalMobileDetail
                sample={null}
                results={[]}
                open={true}
                onClose={vi.fn()}
            />,
        )

        expect(screen.queryByTestId('drawer')).toBeNull()
    })
})
