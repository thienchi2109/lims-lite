/**
 * Tests for ApprovalMobileLayout component.
 * Verifies layout orchestration: tabs + mobile list + detail drawer.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock child components for isolation
vi.mock('@/components/approval-mobile-list', () => ({
    ApprovalMobileList: ({ samples, selectedSampleId, onSelectSample }: any) => (
        <div data-testid="mobile-list">
            {samples.map((s: any) => (
                <button key={s.id} data-testid={`card-${s.id}`} onClick={() => onSelectSample(s.id)}>
                    {s.sample_id}
                </button>
            ))}
        </div>
    ),
}))

vi.mock('@/components/approval-mobile-detail', () => ({
    ApprovalMobileDetail: ({ sample, open, onClose }: any) =>
        open && sample ? (
            <div data-testid="mobile-detail">
                <span>{sample.sample_id}</span>
                <button data-testid="close-drawer" onClick={onClose}>Close</button>
            </div>
        ) : null,
}))

// Mock UI components (tabs)
vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children, value, onValueChange }: any) => (
        <div data-testid="tabs" data-value={value}>{children}</div>
    ),
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children, value, ...props }: any) => (
        <button data-testid={props['data-testid']}>{children}</button>
    ),
}))

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}))

// Mock next/navigation
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
    useSearchParams: () => new URLSearchParams(),
    usePathname: () => '/manager/approvals',
}))

import { ApprovalMobileLayout } from '../approval-mobile-layout'
import type { SampleWithUser, ResultWithAssay } from '@/types'

const mockSamples = [
    {
        id: 'uuid-1',
        sample_id: 'CDC-XN-0001',
        status: 'review' as const,
        client_name: 'Nguyễn A',
        total_tests: 2,
        entered_count: 2,
        approved_count: 0,
        pending_count: 0,
        updated_at: '2026-01-05T10:00:00Z',
        coa_reports: null,
    },
    {
        id: 'uuid-2',
        sample_id: 'CDC-XN-0002',
        status: 'review' as const,
        client_name: 'Trần B',
        total_tests: 1,
        entered_count: 1,
        approved_count: 0,
        pending_count: 0,
        updated_at: '2026-01-05T11:00:00Z',
        coa_reports: null,
    },
]

const mockSelectedSample = {
    id: 'uuid-1',
    sample_id: 'CDC-XN-0001',
    status: 'review',
    client_name: 'Nguyễn A',
} as unknown as SampleWithUser

const mockResults: ResultWithAssay[] = [
    { id: 'r1', assay_name: 'Creatinine', status: 'entered' },
] as unknown as ResultWithAssay[]

beforeEach(() => {
    mockReplace.mockClear()
})

describe('ApprovalMobileLayout', () => {
    it('renders the mobile list with samples', () => {
        render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        expect(screen.getByTestId('mobile-list')).toBeDefined()
        expect(screen.getByText('CDC-XN-0001')).toBeDefined()
        expect(screen.getByText('CDC-XN-0002')).toBeDefined()
    })

    it('renders tab switcher with review and completed tabs', () => {
        render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={3}
            />,
        )

        expect(screen.getByTestId('tab-review')).toBeDefined()
        expect(screen.getByTestId('tab-completed')).toBeDefined()
        expect(screen.getByTestId('badge').textContent).toBe('3')
    })

    it('does not show detail drawer when no sample is selected', () => {
        render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        expect(screen.queryByTestId('mobile-detail')).toBeNull()
    })

    it('shows detail drawer when a sample is selected', () => {
        render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={mockSelectedSample}
                results={mockResults}
                tab="review"
                reviewCount={2}
            />,
        )

        expect(screen.getByTestId('mobile-detail')).toBeDefined()
    })

    it('updates URL and shows drawer after rerender with selected sample', () => {
        const { rerender } = render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        // Tap first card — triggers URL update
        fireEvent.click(screen.getByTestId('card-uuid-1'))
        expect(mockReplace).toHaveBeenCalledWith(
            expect.stringContaining('sampleId=uuid-1'),
        )

        // Simulate server round-trip: parent re-renders with selectedSample
        rerender(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={mockSelectedSample}
                results={mockResults}
                tab="review"
                reviewCount={2}
            />,
        )

        // Now the drawer should actually render
        expect(screen.getByTestId('mobile-detail')).toBeDefined()
        expect(screen.getByTestId('mobile-detail').textContent).toContain('CDC-XN-0001')
    })
})
