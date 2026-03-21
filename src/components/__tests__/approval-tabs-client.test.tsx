/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const mockReplace = vi.fn()
const mockRefresh = vi.fn()
const mockFetchSampleResultsClient = vi.fn()
const mockFetchSampleDetail = vi.fn()
const mockUseFaviconBadge = vi.fn()

let mockSearchParams = new URLSearchParams('tab=review&sampleId=sample-1')
let activeTabValue = 'review'

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: mockReplace, refresh: mockRefresh }),
    useSearchParams: () => mockSearchParams,
    usePathname: () => '/manager/approvals',
}))

vi.mock('@/lib/supabase/client', () => ({
    createClient: () => ({
        channel: () => ({
            on: () => ({
                subscribe: () => ({})
            })
        }),
        removeChannel: vi.fn(),
    }),
}))

vi.mock('@/lib/api-client', () => ({
    fetchSamplesForApprovalCountClient: vi.fn().mockResolvedValue({ data: 1 }),
    fetchSampleResultsClient: (...args: unknown[]) => mockFetchSampleResultsClient(...args),
}))

vi.mock('@/hooks/use-favicon-badge', () => ({
    useFaviconBadge: (...args: unknown[]) => mockUseFaviconBadge(...args),
}))

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: (...args: unknown[]) => mockFetchSampleDetail(...args),
}))

vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children, value }: any) => {
        activeTabValue = value
        return <div>{children}</div>
    },
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children }: any) => <button type="button">{children}</button>,
    TabsContent: ({ children, value }: any) => (value === activeTabValue ? <div>{children}</div> : null),
}))

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: any) => <span>{children}</span>,
}))

vi.mock('@/components/approval-queue-table', () => ({
    ApprovalQueueTable: ({ data, selectedSampleId, onSelectSample }: any) => (
        <div>
            <div data-testid="selected-sample-id">{selectedSampleId ?? 'none'}</div>
            {data.map((sample: any) => (
                <button
                    key={sample.id}
                    type="button"
                    data-testid={`select-${sample.id}`}
                    onClick={() => onSelectSample?.(sample.id)}
                >
                    {sample.sample_id}
                </button>
            ))}
        </div>
    ),
}))

vi.mock('@/components/approval-bottom-row', () => ({
    ApprovalBottomRow: ({ sample, results, isLoadingSample }: any) => (
        <div>
            <div data-testid="bottom-row-loading">{String(Boolean(isLoadingSample))}</div>
            <div data-testid="bottom-row-sample">{sample?.sample_id ?? 'none'}</div>
            <div data-testid="bottom-row-results">{results.map((result: any) => result.id).join(',')}</div>
        </div>
    ),
}))

import { ApprovalTabsClient } from '../approval-tabs-client'
import type { ResultWithAssay, SampleWithUser } from '@/types'

const samples = [
    {
        id: 'sample-1',
        sample_id: 'CDC-XN-0001',
        client_name: 'Nguyễn A',
        status: 'review' as const,
        received_at: '2026-01-05T10:00:00Z',
        updated_at: '2026-01-05T11:00:00Z',
        received_by_name: 'KTV A',
        total_tests: 2,
        entered_count: 2,
        approved_count: 0,
        pending_count: 0,
        coa_reports: null,
    },
    {
        id: 'sample-2',
        sample_id: 'CDC-XN-0002',
        client_name: 'Trần B',
        status: 'review' as const,
        received_at: '2026-01-06T10:00:00Z',
        updated_at: '2026-01-06T11:00:00Z',
        received_by_name: 'KTV B',
        total_tests: 1,
        entered_count: 1,
        approved_count: 0,
        pending_count: 0,
        coa_reports: null,
    },
]

const initialSample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
} as SampleWithUser

const initialResults = [{ id: 'result-1' }] as ResultWithAssay[]

describe('ApprovalTabsClient', () => {
    const originalReplaceState = window.history.replaceState

    beforeEach(() => {
        mockReplace.mockClear()
        mockRefresh.mockClear()
        mockFetchSampleDetail.mockReset()
        mockFetchSampleResultsClient.mockReset()
        mockUseFaviconBadge.mockClear()
        mockSearchParams = new URLSearchParams('tab=review&sampleId=sample-1')
        activeTabValue = 'review'
        window.history.replaceState = vi.fn()
    })

    afterEach(() => {
        window.history.replaceState = originalReplaceState
    })

    it('renders the deep-linked sample detail on first load', () => {
        render(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        expect(screen.getAllByTestId('selected-sample-id')[0].textContent).toBe('sample-1')
        expect(screen.getByTestId('bottom-row-sample').textContent).toBe('CDC-XN-0001')
        expect(screen.getByTestId('bottom-row-results').textContent).toBe('result-1')
    })

    it('updates the detail panel client-side when switching samples without queue navigation', async () => {
        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-2',
            sample_id: 'CDC-XN-0002',
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [{ id: 'result-2' }],
        })

        render(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        fireEvent.click(screen.getAllByTestId('select-sample-2')[0])

        expect(mockReplace).not.toHaveBeenCalledWith(
            expect.stringContaining('sampleId=sample-2'),
            expect.anything(),
        )
        expect(mockRefresh).not.toHaveBeenCalled()
        expect(window.history.replaceState).toHaveBeenCalledWith(
            null,
            '',
            '/manager/approvals?tab=review&sampleId=sample-2',
        )

        await waitFor(() => {
            expect(screen.getByTestId('bottom-row-sample').textContent).toBe('CDC-XN-0002')
        })

        expect(screen.getByTestId('bottom-row-results').textContent).toBe('result-2')
        expect(mockFetchSampleDetail).toHaveBeenCalledWith('sample-2')
        expect(mockFetchSampleResultsClient).toHaveBeenCalledWith('sample-2')
    })
})
