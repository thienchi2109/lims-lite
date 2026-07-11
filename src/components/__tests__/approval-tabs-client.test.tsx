import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockReplace = vi.fn()
const mockRefresh = vi.fn()
const mockFetchSampleResultsClient = vi.fn()
const mockFetchSampleSubmissionReviewClient = vi.fn()
const mockFetchSampleDetail = vi.fn()
const mockUseFaviconBadge = vi.fn()
const mockUseApprovalQueue = vi.fn()

let mockSearchParams = new URLSearchParams('tab=review&sampleId=sample-1')
let activeTabValue = 'review'
let tabsOnValueChange: ((value: string) => void) | null = null

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
    fetchSampleSubmissionReviewClient: (...args: unknown[]) =>
        mockFetchSampleSubmissionReviewClient(...args),
}))

vi.mock('@/hooks/use-favicon-badge', () => ({
    useFaviconBadge: (...args: unknown[]) => mockUseFaviconBadge(...args),
}))

vi.mock('@/hooks/use-approval-queue', () => ({
    useApprovalQueue: (...args: unknown[]) => mockUseApprovalQueue(...args),
}))

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: (...args: unknown[]) => mockFetchSampleDetail(...args),
}))

vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children, value, onValueChange }: any) => {
        activeTabValue = value
        tabsOnValueChange = onValueChange
        return <div>{children}</div>
    },
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children, value }: any) => (
        <button type="button" onClick={() => tabsOnValueChange?.(value)}>
            {children}
        </button>
    ),
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

vi.mock('@/components/approval-inspector-column', () => ({
    ApprovalInspectorColumn: ({
        sample,
        results,
        submissionReview,
        isLoadingSample,
        loadErrorMessage,
    }: any) => (
        <div>
            <div data-testid="approval-inspector-loading">{String(Boolean(isLoadingSample))}</div>
            <div data-testid="approval-inspector-error">{loadErrorMessage ?? ''}</div>
            <div data-testid="approval-inspector-sample">{sample?.sample_id ?? 'none'}</div>
            <div data-testid="approval-inspector-results">{results.map((result: any) => result.id).join(',')}</div>
            <div data-testid="approval-inspector-submissions">
                {submissionReview?.submissions.length ?? 0}
            </div>
        </div>
    ),
}))

vi.mock('@/components/approval-page-header', () => ({
    ApprovalPageHeader: ({ samplesCount, tab }: any) => (
        <div data-testid="approval-header">{`${samplesCount}-${tab}`}</div>
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

const completedSamples = [
    {
        id: 'sample-3',
        sample_id: 'CDC-XN-9001',
        client_name: 'Lê C',
        status: 'completed' as const,
        received_at: '2026-01-07T10:00:00Z',
        updated_at: '2026-01-07T11:00:00Z',
        received_by_name: 'KTV C',
        total_tests: 3,
        entered_count: 3,
        approved_count: 3,
        pending_count: 0,
        coa_reports: null,
    },
]

const initialSample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
} as SampleWithUser

const initialResults = [{ id: 'result-1' }] as ResultWithAssay[]
const updatedServerSample = {
    id: 'sample-2',
    sample_id: 'CDC-XN-0002',
} as SampleWithUser
const updatedServerResults = [{ id: 'result-2' }] as ResultWithAssay[]
const emptySubmissionReview = { submissions: [] }
const submissionReviewFixture = {
    submissions: [
        {
            id: '11111111-1111-4111-8111-111111111111',
            sample_id: '22222222-2222-4222-8222-222222222222',
            submitted_at: '2026-07-11T03:00:00.000Z',
            submission_number: 1,
            superseded_by: null,
            is_active: true,
            assessments: [],
        },
    ],
}

function renderWithQueryClient(ui: ReactNode) {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
            },
        },
    })

    return render(ui, {
        wrapper: ({ children }) => (
            <QueryClientProvider client={queryClient}>
                {children}
            </QueryClientProvider>
        ),
    })
}

function deferredPromise<T>() {
    let resolve!: (value: T) => void
    let reject!: (reason?: unknown) => void

    const promise = new Promise<T>((res, rej) => {
        resolve = res
        reject = rej
    })

    return { promise, resolve, reject }
}

describe('ApprovalTabsClient', () => {
    const originalReplaceState = window.history.replaceState.bind(window.history)
    let historyReplaceSpy: ReturnType<typeof vi.spyOn> | null = null
    let consoleErrorSpy: ReturnType<typeof vi.spyOn> | null = null

    beforeEach(() => {
        mockReplace.mockClear()
        mockRefresh.mockClear()
        mockFetchSampleDetail.mockReset()
    mockFetchSampleResultsClient.mockReset()
    mockFetchSampleSubmissionReviewClient.mockReset()
    mockFetchSampleSubmissionReviewClient.mockResolvedValue({
        data: emptySubmissionReview,
    })
        mockUseFaviconBadge.mockClear()
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockUseApprovalQueue.mockImplementation(({ tab }: { tab: 'review' | 'completed' }) => ({
            data: tab === 'review' ? samples : completedSamples,
            isSuccess: true,
            isError: false,
        }))
        mockSearchParams = new URLSearchParams('tab=review&sampleId=sample-1')
        activeTabValue = 'review'
        tabsOnValueChange = null
        originalReplaceState(null, '', '/manager/approvals?tab=review&sampleId=sample-1')
        historyReplaceSpy = vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
            return Reflect.apply(originalReplaceState, window.history, args)
        })
    })

    afterEach(() => {
        consoleErrorSpy?.mockRestore()
        consoleErrorSpy = null
        historyReplaceSpy?.mockRestore()
        historyReplaceSpy = null
    })

    it('renders the deep-linked sample detail on first load', () => {
        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        expect(screen.getByTestId('approvals-workspace')).toBeDefined()
        expect(screen.getByTestId('approvals-grid-column')).toBeDefined()
        expect(screen.getByTestId('approvals-inspector-column')).toBeDefined()
        expect(screen.getAllByTestId('selected-sample-id')[0].textContent).toBe('sample-1')
        expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0001')
        expect(screen.getByTestId('approval-inspector-results').textContent).toBe('result-1')
    })

    it('keeps the initial snapshot load error visible for a deep link', async () => {
        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
                initialSampleLoadError="Không thể tải dữ liệu đánh giá đã gửi"
            />,
        )

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-error').textContent).toBe(
                'Không thể tải dữ liệu đánh giá đã gửi',
            )
        })
    })

    it('updates the detail panel client-side when switching samples without queue navigation', async () => {
        const user = userEvent.setup()
        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-2',
            sample_id: 'CDC-XN-0002',
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [{ id: 'result-2' }],
        })
        mockFetchSampleSubmissionReviewClient.mockResolvedValue({
            data: submissionReviewFixture,
        })

        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        await user.click(screen.getAllByTestId('select-sample-2')[0])

        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockRefresh).not.toHaveBeenCalled()
        expect(window.history.replaceState).toHaveBeenCalledWith(
            null,
            '',
            '/manager/approvals?tab=review&sampleId=sample-2',
        )

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
        })

        expect(screen.getByTestId('approval-inspector-results').textContent).toBe('result-2')
        expect(screen.getByTestId('approval-inspector-submissions').textContent).toBe('1')
        expect(mockFetchSampleDetail).toHaveBeenCalledWith('sample-2')
        expect(mockFetchSampleResultsClient).toHaveBeenCalledWith('sample-2')
        expect(mockFetchSampleSubmissionReviewClient).toHaveBeenCalledWith('sample-2')
    })

    it('keeps rendering the previous detail while the next sample is still loading', async () => {
        const user = userEvent.setup()
        const sampleDeferred = deferredPromise<{ id: string; sample_id: string }>()
        const resultsDeferred = deferredPromise<{ data: Array<{ id: string }> }>()

        mockFetchSampleDetail.mockReturnValue(sampleDeferred.promise)
        mockFetchSampleResultsClient.mockReturnValue(resultsDeferred.promise)

        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        await user.click(screen.getAllByTestId('select-sample-2')[0])

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-loading').textContent).toBe('true')
        })

        expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0001')
        expect(screen.getByTestId('approval-inspector-results').textContent).toBe('result-1')

        sampleDeferred.resolve({ id: 'sample-2', sample_id: 'CDC-XN-0002' })
        resultsDeferred.resolve({ data: [{ id: 'result-2' }] })

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
        })
    })

    it('preserves the client-selected detail when stale server props rerender while a request is in-flight', async () => {
        const user = userEvent.setup()
        const sampleDeferred = deferredPromise<{ id: string; sample_id: string }>()
        const resultsDeferred = deferredPromise<{ data: Array<{ id: string }> }>()

        mockFetchSampleDetail.mockReturnValue(sampleDeferred.promise)
        mockFetchSampleResultsClient.mockReturnValue(resultsDeferred.promise)

        const { rerender } = renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        await user.click(screen.getAllByTestId('select-sample-2')[0])

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-loading').textContent).toBe('true')
        })

        rerender(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={{ ...initialSample }}
                initialResults={[...initialResults]}
            />,
        )

        sampleDeferred.resolve({ id: 'sample-2', sample_id: 'CDC-XN-0002' })
        resultsDeferred.resolve({ data: [{ id: 'result-2' }] })

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-loading').textContent).toBe('false')
        })

        expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
        expect(screen.getByTestId('approval-inspector-results').textContent).toBe('result-2')
    })

    it('surfaces an explicit error state when detail fetch fails', async () => {
        const user = userEvent.setup()
        mockFetchSampleDetail.mockRejectedValue(new Error('network failed'))
        mockFetchSampleResultsClient.mockResolvedValue({ data: [] })

        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        await user.click(screen.getAllByTestId('select-sample-2')[0])

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-error').textContent).toBe(
                'Không thể tải chi tiết mẫu. Vui lòng thử lại.',
            )
        })
    })

    it('retries the same sample after a detail fetch failure', async () => {
        const user = userEvent.setup()
        mockFetchSampleDetail
            .mockRejectedValueOnce(new Error('network failed'))
            .mockResolvedValueOnce({
                id: 'sample-2',
                sample_id: 'CDC-XN-0002',
            })
        mockFetchSampleResultsClient
            .mockResolvedValueOnce({ data: [] })
            .mockResolvedValueOnce({ data: [{ id: 'result-2' }] })

        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        await user.click(screen.getAllByTestId('select-sample-2')[0])

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-error').textContent).toBe(
                'Không thể tải chi tiết mẫu. Vui lòng thử lại.',
            )
        })

        await user.click(screen.getAllByTestId('select-sample-2')[0])

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
        })

        expect(screen.getByTestId('approval-inspector-error').textContent).toBe('')
        expect(mockFetchSampleDetail).toHaveBeenCalledTimes(2)
        expect(mockFetchSampleResultsClient).toHaveBeenCalledTimes(2)
    })

    it('syncs the detail panel when the server selection changes to match the current URL', async () => {
        const { rerender } = renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        originalReplaceState(null, '', '/manager/approvals?tab=review&sampleId=sample-2')

        rerender(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-2"
                initialSample={updatedServerSample}
                initialResults={updatedServerResults}
            />,
        )

        await waitFor(() => {
            expect(screen.getAllByTestId('selected-sample-id')[0].textContent).toBe('sample-2')
            expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
            expect(screen.getByTestId('approval-inspector-results').textContent).toBe('result-2')
        })
    })

    it('preserves client-selected detail when server refresh returns stale empty selection props', async () => {
        const user = userEvent.setup()
        originalReplaceState(null, '', '/manager/approvals?tab=review')
        mockFetchSampleDetail.mockResolvedValue({
            id: 'sample-2',
            sample_id: 'CDC-XN-0002',
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [{ id: 'result-2' }],
        })

        const { rerender } = renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId={undefined}
                initialSample={null}
                initialResults={[]}
            />,
        )

        await user.click(screen.getByTestId('select-sample-2'))

        await waitFor(() => {
            expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
        })

        rerender(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId={undefined}
                initialSample={null}
                initialResults={[]}
            />,
        )

        expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('CDC-XN-0002')
        expect(screen.getByTestId('approval-inspector-results').textContent).toBe('result-2')
    })

    it('switches tabs with local URL sync and clears stale sample selection', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        await user.click(screen.getByRole('button', { name: 'Đã duyệt KQ' }))

        expect(mockReplace).not.toHaveBeenCalled()
        expect(mockRefresh).not.toHaveBeenCalled()
        expect(window.history.replaceState).toHaveBeenCalledWith(
            null,
            '',
            '/manager/approvals?tab=completed',
        )
        expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('none')
        expect(screen.getByTestId('approval-inspector-results').textContent).toBe('')
        expect(screen.getAllByTestId('selected-sample-id')[0].textContent).toBe('none')
        expect(screen.getByTestId('select-sample-3')).toBeDefined()
        expect(screen.queryByTestId('select-sample-1')).toBeNull()
        expect(screen.getByTestId('approval-header').textContent).toBe('1-completed')
    })

    it('renders a Vietnamese queue error state when the active tab fetch fails', () => {
        mockUseApprovalQueue.mockReturnValue({
            data: undefined,
            isSuccess: false,
            isError: true,
        })

        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId={undefined}
                initialSample={null}
                initialResults={[]}
            />,
        )

        expect(screen.getByText('Không thể tải hàng đợi phê duyệt. Vui lòng thử lại.')).toBeDefined()
        expect(screen.queryByTestId('select-sample-1')).toBeNull()
    })

    it('reads the current URL on mount so breakpoint swaps do not restore stale tab and sample props', () => {
        originalReplaceState(null, '', '/manager/approvals?tab=completed')

        renderWithQueryClient(
            <ApprovalTabsClient
                tab="review"
                samples={samples}
                reviewCount={1}
                selectedSampleId="sample-1"
                initialSample={initialSample}
                initialResults={initialResults}
            />,
        )

        expect(screen.getByTestId('select-sample-3')).toBeDefined()
        expect(screen.queryByTestId('select-sample-1')).toBeNull()
        expect(screen.getByTestId('approval-inspector-sample').textContent).toBe('none')
        expect(screen.getAllByTestId('selected-sample-id')[0].textContent).toBe('none')
    })
})
