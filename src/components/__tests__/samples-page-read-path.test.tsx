import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockUseSamples = vi.fn()
const mockUseSampleDetail = vi.fn()
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

vi.mock('@/hooks/use-samples', () => ({
    useSamples: (...args: unknown[]) => mockUseSamples(...args),
}))

vi.mock('@/hooks/use-sample-detail', () => ({
    useSampleDetail: (...args: unknown[]) => mockUseSampleDetail(...args),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockRouterPush,
    }),
    useSearchParams: () => mockSearchParams,
}))

vi.mock('@/components/sample-filters', () => ({
    SampleFilters: () => null,
}))

vi.mock('@/components/sample-list-table', () => ({
    SampleListTable: ({ selectedSampleId }: { selectedSampleId?: string }) => (
        <div data-testid="sample-list-selected">{selectedSampleId ?? 'none'}</div>
    ),
}))

vi.mock('@/components/sample-detail-panel', () => ({
    SampleDetailPanel: ({ sample }: { sample: { sample_id: string } | null }) => (
        <div data-testid="sample-detail-panel">{sample?.sample_id ?? 'empty'}</div>
    ),
}))

vi.mock('@/components/assigned-tests-panel', () => ({
    AssignedTestsPanel: ({ sampleId }: { sampleId: string }) => (
        <div data-testid="assigned-tests-panel">{sampleId}</div>
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

function buildSample(sampleId: string, overrides: Record<string, unknown> = {}) {
    return {
        id: sampleId,
        sample_id: sampleId.toUpperCase(),
        status: 'assigned',
        received_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        received_by_name: 'User A',
        ...overrides,
    }
}

describe('SamplesPageClient read-path contract', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockSearchParams = new URLSearchParams()

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
    })

    it('does not start a results fetch when the selected sample already carries embedded core results', () => {
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

        mockUseSampleDetail.mockReturnValue({
            data: buildSample('sample-1', { results: embeddedResults }) as any,
            isLoading: false,
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

        expect(mockFetchSampleResultsClient).not.toHaveBeenCalled()
    })

    it('keeps sample A visible while sample B is loading and moves grid selection immediately', () => {
        const sampleA = buildSample('sample-a', { sample_id: 'CDC-XN-A' })
        const sampleB = buildSample('sample-b', { sample_id: 'CDC-XN-B' })

        mockUseSampleDetail.mockImplementation(({ sampleId }: { sampleId: string | null }) => {
            if (sampleId === 'sample-b') {
                return {
                    data: sampleB as any,
                    isLoading: true,
                }
            }

            return {
                data: sampleA as any,
                isLoading: false,
            }
        })

        mockSearchParams = new URLSearchParams('sampleId=sample-a')

        const { rerender } = render(
            <SamplesPageClient
                role="analyst"
                permissions={basePermissions}
                homeHref="/"
                receiverOptions={[]}
                specialties={[]}
            />,
        )

        expect(screen.getByTestId('sample-list-selected').textContent).toBe('sample-a')
        expect(screen.getByText('CDC-XN-A')).toBeDefined()

        mockSearchParams = new URLSearchParams('sampleId=sample-b')
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
        expect(screen.getByTestId('assigned-tests-panel').textContent).toBe('sample-b')
    })
})
