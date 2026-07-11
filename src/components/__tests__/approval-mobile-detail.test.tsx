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
    ApprovalActions: ({ sampleId, results, compact }: any) => (
        <div data-testid="approval-actions" data-compact={compact ? 'true' : 'false'}>{sampleId} ({results.length} results)</div>
    ),
}))

// Mock vaul Drawer to render children directly (no portal/animation)
let mockOnOpenChange: ((open: boolean) => void) | null = null
vi.mock('@/components/ui/drawer', () => ({
    Drawer: ({ open, children, onOpenChange }: any) => {
        mockOnOpenChange = onOpenChange
        return open ? <div data-testid="drawer">{children}</div> : null
    },
    DrawerContent: ({ children, className }: any) => <div className={className}>{children}</div>,
    DrawerHeader: ({ children }: any) => <div>{children}</div>,
    DrawerTitle: ({ children }: any) => <h2>{children}</h2>,
    DrawerClose: ({ children, asChild }: any) => {
        if (asChild) {
            return (
                <span data-testid="drawer-close-wrapper" onClick={() => mockOnOpenChange?.(false)}>
                    {children}
                </span>
            )
        }
        return <button data-testid="drawer-close" onClick={() => mockOnOpenChange?.(false)}>{children}</button>
    },
}))

import { render, screen, fireEvent } from '@testing-library/react'
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

    it('hides approval actions when the submitted assessment cannot be loaded', () => {
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={vi.fn()}
                loadErrorMessage="Không thể tải dữ liệu đánh giá đã gửi"
            />,
        )

        expect(screen.getByText('Không thể tải dữ liệu đánh giá đã gửi')).toBeDefined()
        expect(screen.queryByTestId('approval-actions')).toBeNull()
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

    it('renders a loading drawer when the selection is open but sample data is still pending', () => {
        render(
            <ApprovalMobileDetail
                sample={null}
                results={[]}
                open={true}
                onClose={vi.fn()}
            />,
        )

        expect(screen.getByTestId('drawer')).toBeDefined()
        expect(screen.getByText('Đang tải...')).toBeDefined()
        expect(screen.getByText('Đang tải chi tiết mẫu...')).toBeDefined()
        expect(screen.queryByTestId('sample-detail-panel')).toBeNull()
    })

    it('calls onClose when close button is clicked', () => {
        const onClose = vi.fn()
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={onClose}
            />,
        )

        // DrawerClose asChild renders a wrapper, the real button is inside
        const wrapper = screen.getByTestId('drawer-close-wrapper')
        const closeButton = wrapper.querySelector('button')!
        fireEvent.click(closeButton)
        expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('passes compact prop to ApprovalActions', () => {
        render(
            <ApprovalMobileDetail
                sample={mockSample}
                results={mockResults}
                open={true}
                onClose={vi.fn()}
            />,
        )

        // The mocked ApprovalActions should render — verify it receives compact
        const actionsEl = screen.getByTestId('approval-actions')
        expect(actionsEl.getAttribute('data-compact')).toBe('true')
    })
})
