/**
 * Tests for ApprovalMobileLayout component.
 * Verifies layout orchestration: tabs area + mobile list + detail drawer.
 */

import { describe, it, expect, vi } from 'vitest'
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

// Mock next/navigation
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: mockPush, replace: mockReplace }),
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

describe('ApprovalMobileLayout', () => {
    it('renders the mobile list with samples', () => {
        render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
            />,
        )

        expect(screen.getByTestId('mobile-list')).toBeDefined()
        expect(screen.getByText('CDC-XN-0001')).toBeDefined()
        expect(screen.getByText('CDC-XN-0002')).toBeDefined()
    })

    it('does not show detail drawer when no sample is selected', () => {
        render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
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
            />,
        )

        expect(screen.getByTestId('mobile-detail')).toBeDefined()
    })

    it('opens drawer when a card is tapped', () => {
        const { rerender } = render(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
            />,
        )

        // Tap first card
        fireEvent.click(screen.getByTestId('card-uuid-1'))

        // URL update is triggered (router.replace)
        expect(mockReplace).toHaveBeenCalled()
    })
})
