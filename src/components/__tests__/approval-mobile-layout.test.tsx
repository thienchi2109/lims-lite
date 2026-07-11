/**
 * Tests for ApprovalMobileLayout component.
 * Verifies layout orchestration: tabs + mobile list + detail drawer.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const mockUseApprovalQueue = vi.fn()
const mockFetchSampleDetail = vi.fn()
const mockFetchSampleResultsClient = vi.fn()
const mockFetchSampleSubmissionReviewClient = vi.fn()

// Mock child components for isolation
vi.mock('@/components/approval-mobile-list', () => ({
    ApprovalMobileList: ({ samples, onSelectSample }: any) => (
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
    ApprovalMobileDetail: ({
        sample,
        submissionReview,
        open,
        onClose,
        loadErrorMessage,
    }: any) =>
        open && sample ? (
            <div data-testid="mobile-detail">
                <span>{sample.sample_id}</span>
                <span data-testid="mobile-detail-error">{loadErrorMessage ?? ''}</span>
                <span data-testid="mobile-submission-count">
                    {submissionReview?.submissions.length ?? 0}
                </span>
                <button data-testid="close-drawer" onClick={onClose}>Close</button>
            </div>
        ) : null,
}))

// Mock UI components (tabs)
// Shared ref so TabsTrigger can call the parent Tabs onValueChange
let tabsOnValueChange: ((v: string) => void) | null = null

vi.mock('@/components/ui/tabs', () => ({
    Tabs: ({ children, value, onValueChange }: any) => {
        tabsOnValueChange = onValueChange
        return <div data-testid="tabs" data-value={value}>{children}</div>
    },
    TabsList: ({ children }: any) => <div>{children}</div>,
    TabsTrigger: ({ children, value, ...props }: any) => (
        <button
            data-testid={props['data-testid']}
            onClick={() => tabsOnValueChange?.(value)}
        >
            {children}
        </button>
    ),
}))

vi.mock('@/components/ui/badge', () => ({
    Badge: ({ children }: any) => <span data-testid="badge">{children}</span>,
}))

vi.mock('@/components/approval-page-header', () => ({
    ApprovalPageHeader: ({ samplesCount, tab }: any) => (
        <div data-testid="approval-header">{`${samplesCount}-${tab}`}</div>
    ),
}))

vi.mock('@/hooks/use-approval-queue', () => ({
    useApprovalQueue: (...args: unknown[]) => mockUseApprovalQueue(...args),
}))

vi.mock('@/hooks/use-sample-detail', () => ({
    fetchSampleDetail: (...args: unknown[]) => mockFetchSampleDetail(...args),
}))

vi.mock('@/lib/api-client', () => ({
    fetchSampleResultsClient: (...args: unknown[]) => mockFetchSampleResultsClient(...args),
    fetchSampleSubmissionReviewClient: (...args: unknown[]) =>
        mockFetchSampleSubmissionReviewClient(...args),
}))

// Mock next/navigation
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()
vi.mock('next/navigation', () => ({
    useRouter: () => ({ push: vi.fn(), replace: mockReplace }),
    useSearchParams: () => mockSearchParams,
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
        received_at: '2026-01-05T09:15:00Z',
        received_by_name: 'KTV A',
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
        received_at: '2026-01-05T10:30:00Z',
        received_by_name: 'KTV B',
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
const originalReplaceState = window.history.replaceState.bind(window.history)
let historyReplaceSpy: ReturnType<typeof vi.spyOn> | null = null

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

beforeEach(() => {
    mockReplace.mockClear()
    mockFetchSampleDetail.mockReset()
    mockFetchSampleResultsClient.mockReset()
    mockFetchSampleSubmissionReviewClient.mockReset()
    mockFetchSampleSubmissionReviewClient.mockResolvedValue({
        data: { submissions: [] },
    })
    mockSearchParams = new URLSearchParams()
    originalReplaceState(null, '', '/manager/approvals')
    historyReplaceSpy = vi.spyOn(window.history, 'replaceState').mockImplementation((...args) => {
        return Reflect.apply(originalReplaceState, window.history, args)
    })
    mockUseApprovalQueue.mockImplementation(({ initialData }: any) => ({
        data: initialData,
        isSuccess: true,
        isError: false,
    }))
})

afterEach(() => {
    historyReplaceSpy?.mockRestore()
    historyReplaceSpy = null
})

describe('ApprovalMobileLayout', () => {
    it('renders the mobile list with samples', () => {
        renderWithQueryClient(
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

    it('keeps the initial snapshot load error visible in the detail drawer', async () => {
        mockSearchParams = new URLSearchParams('tab=review&sampleId=uuid-1')
        originalReplaceState(
            null,
            '',
            '/manager/approvals?tab=review&sampleId=uuid-1',
        )

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={mockSelectedSample}
                results={mockResults}
                initialSampleLoadError="Không thể tải dữ liệu đánh giá đã gửi"
                tab="review"
                reviewCount={2}
            />,
        )

        await waitFor(() => {
            expect(screen.getByTestId('mobile-detail-error').textContent).toBe(
                'Không thể tải dữ liệu đánh giá đã gửi',
            )
        })
    })

    it('renders tab switcher with review and completed tabs', () => {
        renderWithQueryClient(
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
        renderWithQueryClient(
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
        originalReplaceState(null, '', '/manager/approvals?tab=review&sampleId=uuid-1')

        renderWithQueryClient(
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

    it('closes the detail drawer immediately when the close button is pressed', async () => {
        const user = userEvent.setup()
        originalReplaceState(null, '', '/manager/approvals?tab=review&sampleId=uuid-1')

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={mockSelectedSample}
                results={mockResults}
                tab="review"
                reviewCount={2}
            />,
        )

        expect(screen.getByTestId('mobile-detail')).toBeDefined()

        await user.click(screen.getByTestId('close-drawer'))

        expect(mockReplace).not.toHaveBeenCalled()
        expect(historyReplaceSpy?.mock.calls.at(-1)?.[2]).toBe('/manager/approvals?tab=review')
        expect(screen.queryByTestId('mobile-detail')).toBeNull()
    })

    it('loads and shows drawer client-side when a sample is selected', async () => {
        const user = userEvent.setup()
        mockFetchSampleDetail.mockResolvedValueOnce(mockSelectedSample)
        mockFetchSampleResultsClient.mockResolvedValueOnce({ data: mockResults })
        mockFetchSampleSubmissionReviewClient.mockResolvedValueOnce({
            data: {
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
            },
        })

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        await user.click(screen.getByTestId('card-uuid-1'))

        expect(mockReplace).not.toHaveBeenCalled()
        expect(historyReplaceSpy?.mock.calls.at(-1)?.[2]).toContain('sampleId=uuid-1')
        await waitFor(() => {
            expect(mockFetchSampleDetail).toHaveBeenCalledWith('uuid-1')
            expect(mockFetchSampleResultsClient).toHaveBeenCalledWith('uuid-1')
            expect(mockFetchSampleSubmissionReviewClient).toHaveBeenCalledWith('uuid-1')
        })

        await waitFor(() => {
            expect(screen.getByTestId('mobile-detail').textContent).toContain('CDC-XN-0001')
        })
        expect(screen.getByTestId('mobile-submission-count').textContent).toBe('1')
    })

    it('navigates to completed tab when clicking tab trigger', async () => {
        const user = userEvent.setup()
        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        await user.click(screen.getByTestId('tab-completed'))
        expect(historyReplaceSpy?.mock.calls.at(-1)?.[2]).toContain('tab=completed')
        expect(screen.getByTestId('approval-header').textContent).toBe('2-completed')
    })

    it('clears sampleId from URL when switching tabs', async () => {
        const user = userEvent.setup()
        // Set searchParams with an existing sampleId to prove delete works
        originalReplaceState(null, '', '/manager/approvals?tab=review&sampleId=uuid-1')
        historyReplaceSpy?.mockClear()

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={mockSelectedSample}
                results={mockResults}
                tab="review"
                reviewCount={2}
            />,
        )

        await user.click(screen.getByTestId('tab-completed'))
        const calledUrl = historyReplaceSpy?.mock.calls.at(-1)?.[2] as string
        expect(calledUrl).toContain('tab=completed')
        expect(calledUrl).not.toContain('sampleId')
    })

    it('keeps the active tab in the URL when selecting a sample after a local tab switch', async () => {
        const user = userEvent.setup()
        originalReplaceState(null, '', '/manager/approvals?tab=review')
        historyReplaceSpy?.mockClear()
        mockFetchSampleDetail.mockResolvedValueOnce(mockSelectedSample)
        mockFetchSampleResultsClient.mockResolvedValueOnce({ data: mockResults })

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        await user.click(screen.getByTestId('tab-completed'))
        await user.click(screen.getByTestId('card-uuid-1'))

        await waitFor(() => {
            expect(mockFetchSampleDetail).toHaveBeenCalledWith('uuid-1')
        })

        const lastCalledUrl = historyReplaceSpy?.mock.calls.at(-1)?.[2] as string
        expect(lastCalledUrl).toContain('tab=completed')
        expect(lastCalledUrl).toContain('sampleId=uuid-1')
    })

    it('renders a Vietnamese queue error state when the active tab fetch fails', () => {
        mockUseApprovalQueue.mockReturnValue({
            data: undefined,
            isSuccess: false,
            isError: true,
        })

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={null}
                results={[]}
                tab="review"
                reviewCount={2}
            />,
        )

        expect(screen.getByText('Không thể tải hàng đợi phê duyệt. Vui lòng thử lại.')).toBeDefined()
        expect(screen.queryByTestId('mobile-list')).toBeNull()
    })

    it('reads the current URL on mount so breakpoint swaps do not reopen stale mobile detail', () => {
        originalReplaceState(null, '', '/manager/approvals?tab=completed')

        renderWithQueryClient(
            <ApprovalMobileLayout
                samples={mockSamples}
                selectedSample={mockSelectedSample}
                results={mockResults}
                tab="review"
                reviewCount={2}
            />,
        )

        expect(screen.getByTestId('tabs').getAttribute('data-value')).toBe('completed')
        expect(screen.queryByTestId('mobile-detail')).toBeNull()
    })
})
