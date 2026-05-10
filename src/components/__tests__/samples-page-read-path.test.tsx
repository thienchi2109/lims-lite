import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import type { SampleWithUser } from '@/types'

const mockUseSamples = vi.fn()
let mockSearchParams = new URLSearchParams()

const mockFetchSampleResultsClient = vi.fn()
const mockGetQCStatusForAssays = vi.fn()
const mockUseResultsEditor = vi.fn()
const mockUseUnsavedChangesGuard = vi.fn()
const mockUseSignatureStatus = vi.fn()
const mockUseCoaActions = vi.fn()
const mockUsePrintHandlers = vi.fn()
const mockInvalidateQueries = vi.fn()
const mockRouterPush = vi.fn()
const mockRouterReplace = vi.fn()
const mockUseSampleSelectionCore = vi.fn()

vi.mock('@/hooks/use-samples', () => ({
    useSamples: (...args: unknown[]) => mockUseSamples(...args),
}))

vi.mock('@/hooks/use-sample-selection-core', () => ({
    useSampleSelectionCore: (...args: unknown[]) => mockUseSampleSelectionCore(...args),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockRouterPush,
        replace: mockRouterReplace,
    }),
    usePathname: () => '/manager/samples',
    useSearchParams: () => mockSearchParams,
}))

vi.mock('@/components/sample-filters', () => ({
    SampleFilters: () => <div data-testid="sample-filters">filters</div>,
}))

vi.mock('@/components/sample-list-table', () => ({
    SampleListTable: ({ selectedSampleId }: { selectedSampleId?: string }) => (
        <div data-testid="sample-list-selected">{selectedSampleId ?? 'none'}</div>
    ),
}))

vi.mock('@/components/sample-inspector-column', () => ({
    SampleInspectorColumn: ({
        sample,
        results,
        isLoadingSample,
        loadErrorMessage,
    }: {
        sample: { sample_id: string; status?: string } | null
        results?: Array<{ assay_name?: string }>
        isLoadingSample?: boolean
        loadErrorMessage?: string | null
    }) => (
        <div data-testid="sample-inspector-content">
            <div data-testid="sample-detail-panel">{sample?.sample_id ?? 'empty'}</div>
            <div data-testid="sample-detail-status">{sample?.status ?? 'empty'}</div>
            <div data-testid="sample-inspector-loading">{String(Boolean(isLoadingSample))}</div>
            <div data-testid="sample-inspector-error">{loadErrorMessage ?? ''}</div>
            {results?.map((result) => (
                <div key={result.assay_name}>{result.assay_name}</div>
            ))}
        </div>
    ),
}))

vi.mock('@/components/sample-bottom-row', () => ({
    SampleBottomRow: ({
        sample,
        results,
        isLoadingSample,
        loadErrorMessage,
    }: {
        sample: { sample_id: string; status?: string } | null
        results?: Array<{ assay_name?: string }>
        isLoadingSample?: boolean
        loadErrorMessage?: string | null
    }) => (
        <div data-testid="legacy-sample-bottom-row">
            <div data-testid="sample-detail-panel">{sample?.sample_id ?? 'empty'}</div>
            <div data-testid="sample-detail-status">{sample?.status ?? 'empty'}</div>
            <div data-testid="sample-inspector-loading">{String(Boolean(isLoadingSample))}</div>
            <div data-testid="sample-inspector-error">{loadErrorMessage ?? ''}</div>
            {results?.map((result) => (
                <div key={result.assay_name}>{result.assay_name}</div>
            ))}
        </div>
    ),
}))

vi.mock('@/lib/api-client', () => ({
    fetchSampleResultsClient: (...args: unknown[]) => mockFetchSampleResultsClient(...args),
    submitSampleForReviewClient: vi.fn(),
}))

vi.mock('@/app/actions/coa', () => ({
    getCoAStatus: vi.fn(),
}))

vi.mock('@/app/actions/qc-status', () => ({
    getQCStatusForAssays: (...args: unknown[]) => mockGetQCStatusForAssays(...args),
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('@/hooks/use-results-editor', () => ({
    useResultsEditor: (...args: unknown[]) => mockUseResultsEditor(...args),
}))

vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
    useUnsavedChangesGuard: (...args: unknown[]) => mockUseUnsavedChangesGuard(...args),
}))

vi.mock('@/hooks/use-signature-status', () => ({
    useSignatureStatus: (...args: unknown[]) => mockUseSignatureStatus(...args),
}))

vi.mock('@/hooks/use-coa-actions', () => ({
    useCoaActions: (...args: unknown[]) => mockUseCoaActions(...args),
}))

vi.mock('@/hooks/use-print-handlers', () => ({
    usePrintHandlers: (...args: unknown[]) => mockUsePrintHandlers(...args),
}))

vi.mock('@/components/assigned-tests-toolbar', () => ({
    AssignedTestsToolbar: () => null,
}))

vi.mock('@/components/batch-save-toolbar', () => ({
    BatchSaveToolbar: () => null,
}))

vi.mock('@/components/result-cell-editor', () => ({
    ResultCellEditor: ({ value }: { value: string }) => <span>{value}</span>,
}))

vi.mock('@/components/result-status-badge', () => ({
    ResultStatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}))

vi.mock('@/components/test-assignment-module', () => ({
    TestAssignmentModule: () => null,
}))

vi.mock('@/components/qc/qc-row-indicator', () => ({
    QCRowIndicator: () => null,
}))

vi.mock('@/components/coa-preview-dialog', () => ({
    CoAPreviewDialog: () => null,
}))

vi.mock('@/components/ui/button', () => ({
    Button: ({ children, ...props }: { children?: ReactNode }) => <button {...props}>{children}</button>,
}))

vi.mock('@/components/ui/card', () => ({
    Card: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    CardContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('@/components/ui/table', () => ({
    Table: ({ children }: { children?: ReactNode }) => <table>{children}</table>,
    TableBody: ({ children }: { children?: ReactNode }) => <tbody>{children}</tbody>,
    TableCell: ({ children }: { children?: ReactNode }) => <td>{children}</td>,
    TableHead: ({ children }: { children?: ReactNode }) => <th>{children}</th>,
    TableHeader: ({ children }: { children?: ReactNode }) => <thead>{children}</thead>,
    TableRow: ({ children }: { children?: ReactNode }) => <tr>{children}</tr>,
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
    DialogContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogFooter: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock('@/components/ui/alert', () => ({
    Alert: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    AlertDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    AlertTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div {...props}>{children}</div>
        ),
    },
}))

vi.mock('next/link', () => ({
    default: ({ children }: { children: React.ReactNode }) => children,
}))

import { SamplesPageClient } from '../samples-page-client'

const basePermissions = {
    canDiscard: false,
    canEdit: false,
    canViewResults: false,
    canEnterResults: false,
}

function buildSample(sampleId: string, overrides: Partial<SampleWithUser> = {}): SampleWithUser {
    return {
        id: sampleId,
        sample_id: sampleId.toUpperCase(),
        client_id: null,
        client_name: null,
        type: 'Máu',
        status: 'assigned',
        received_at: '2026-01-01T00:00:00.000Z',
        received_by: null,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        deleted_at: null,
        received_by_name: 'User A',
        ...overrides,
    }
}

describe('SamplesPageClient read-path contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSearchParams = new URLSearchParams()
        mockRouterReplace.mockClear()

        mockUseSamples.mockReturnValue({
            data: {
                data: [],
                totalPages: 1,
                count: 0,
                page: 1,
                pageSize: 20,
            },
            isLoading: false,
            error: null,
        })

        mockUseResultsEditor.mockReturnValue({
            pendingCount: 0,
            resultValues: {},
            validationErrors: {},
            isSaving: false,
            handleSave: vi.fn(),
            handleDiscard: vi.fn(),
            getDisplayValue: (result: { value?: string | null }) => result.value ?? '',
            handleValueChange: vi.fn(),
        })

        mockUseUnsavedChangesGuard.mockReturnValue(undefined)
        mockUseSignatureStatus.mockReturnValue({
            hasSignature: true,
            isLoading: false,
            error: null,
        })
        mockUseCoaActions.mockReturnValue({
            isGeneratingCoA: false,
            handleGenerateCoA: vi.fn(),
        })
        mockUsePrintHandlers.mockReturnValue({
            handlePrint: vi.fn(),
            handlePrintCoABody: vi.fn(),
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [],
            error: null,
        })
        mockGetQCStatusForAssays.mockResolvedValue({})
        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: buildSample('sample-1'),
                results: [],
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })
    })

    it('renders the current selection core payload immediately when the selected sample query already has data', async () => {
        const embeddedResults = [
            {
                id: 'result-1',
                assay_id: 'assay-1',
                assay_name: 'Creatinine',
                method_name: 'Jaffe',
                value: '5.2',
                status: 'assigned',
                sample_status: 'assigned',
                assay_units: 'mg/dL',
            },
        ]

        mockSearchParams = new URLSearchParams('sampleId=sample-1')
        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: buildSample('sample-1'),
                results: embeddedResults,
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })

        const rendered = render(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        await waitFor(() => {
            expect(screen.getByText('Creatinine')).toBeDefined()
        })
        const workspace = screen.getByTestId('samples-workspace')
        const gridColumn = screen.getByTestId('samples-grid-column')
        const inspectorColumn = screen.getByTestId('samples-inspector-column')
        const filters = screen.getByTestId('sample-filters')

        expect(workspace).toBeDefined()
        expect(gridColumn).toBeDefined()
        expect(inspectorColumn).toBeDefined()
        expect(filters).toBeDefined()
        expect(workspace.contains(filters)).toBe(false)
        expect(gridColumn.contains(filters)).toBe(false)
        expect(mockUseSampleSelectionCore).toHaveBeenCalledWith({
            sampleId: 'sample-1',
            includeResults: true,
        })
        rendered.unmount()
    })

    it('keeps sample A visible while sample B is loading and moves grid selection immediately', async () => {
        const sampleAResults = [
            {
                id: 'result-a',
                assay_id: 'assay-a',
                assay_name: 'Creatinine',
                method_name: 'Jaffe',
                value: '5.2',
                status: 'assigned',
                sample_status: 'assigned',
                assay_units: 'mg/dL',
            },
        ]
        const sampleA = buildSample('sample-a', {
            sample_id: 'CDC-XN-A',
        })
        const sampleB = buildSample('sample-b', {
            sample_id: 'CDC-XN-B',
        })

        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: sampleA,
                results: sampleAResults,
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })

        mockSearchParams = new URLSearchParams('sampleId=sample-a')

        const rendered = render(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )
        const { rerender, unmount } = rendered

        await waitFor(() => {
            expect(screen.getByText('CDC-XN-A')).toBeDefined()
        })
        expect(screen.getByTestId('sample-list-selected').textContent).toBe('sample-a')

        mockSearchParams = new URLSearchParams('sampleId=sample-b')
        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: sampleA,
                results: sampleAResults,
            },
            isLoading: false,
            isFetching: true,
            error: null,
        })

        rerender(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        expect(screen.getByTestId('sample-list-selected').textContent).toBe('sample-b')
        expect(screen.getByText('CDC-XN-A')).toBeDefined()

        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: sampleB,
                results: sampleAResults,
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })

        rerender(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        await waitFor(() => {
            expect(screen.getByText('CDC-XN-B')).toBeDefined()
        })

        unmount()
    })

    it('updates the displayed sample when the current selection core refetches with fresh data', async () => {
        const sampleAssigned = buildSample('sample-1', {
            sample_id: 'CDC-XN-0001',
            status: 'assigned',
        })
        const sampleReview = buildSample('sample-1', {
            sample_id: 'CDC-XN-0001',
            status: 'review',
        })

        mockSearchParams = new URLSearchParams('sampleId=sample-1')
        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: sampleAssigned,
                results: [],
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })

        const rendered = render(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )
        const { rerender, unmount } = rendered

        await waitFor(() => {
            expect(screen.getByTestId('sample-detail-status').textContent).toBe('assigned')
        })

        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: sampleReview,
                results: [],
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })

        rerender(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        await waitFor(() => {
            expect(screen.getByTestId('sample-detail-status').textContent).toBe('review')
        })

        unmount()
    })

    it('keeps sample detail visible when the shared core only has detail', async () => {
        const sampleOnlyCore = buildSample('sample-4', {
            sample_id: 'CDC-XN-0004',
            status: 'assigned',
        })

        mockSearchParams = new URLSearchParams('sampleId=sample-4')
        mockUseSampleSelectionCore.mockReturnValue({
            data: {
                sample: sampleOnlyCore,
                results: undefined,
            },
            isLoading: false,
            isFetching: false,
            error: null,
        })
        mockFetchSampleResultsClient.mockResolvedValue({
            data: null,
            error: 'Network error',
        })

        render(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        await waitFor(() => {
            expect(screen.getByTestId('sample-detail-panel').textContent).toBe('CDC-XN-0004')
        })
    })

    it('passes rejectedOnly=true to useSamples when deep-link query includes rejectedOnly=true', () => {
        mockSearchParams = new URLSearchParams('status=in_progress&rejectedOnly=true')

        render(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        const firstCallArgs = mockUseSamples.mock.calls.at(0)?.[0]
        expect(firstCallArgs).toMatchObject({
            params: expect.objectContaining({
                status: 'in_progress',
                rejectedOnly: true,
            }),
        })
    })
})
