import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
const mockRefetchQueries = vi.fn().mockResolvedValue(undefined)
const mockPush = vi.fn()
const mockFetchTests = vi.fn()
const capturedSpecialties: unknown[] = []

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
        refetchQueries: mockRefetchQueries,
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
}))

vi.mock('@/components/result-review-draft-dialog', () => ({
    ResultReviewDraftDialog: ({
        open,
        onSubmitted,
    }: {
        open: boolean
        onSubmitted: () => Promise<void>
    }) =>
        open ? (
            <button onClick={() => void onSubmitted()}>
                Complete draft review
            </button>
        ) : null,
}))

vi.mock('@/hooks/use-assigned-tests-data', () => ({
    useAssignedTestsData: () => ({
        results: [],
        loading: false,
        error: null,
        sampleStatus: 'in_progress',
        qcStatuses: {},
        coaStatus: null,
        setCoaStatus: vi.fn(),
        fetchTests: mockFetchTests,
    }),
}))

vi.mock('@/hooks/use-results-editor', () => ({
    useResultsEditor: () => ({
        pendingCount: 0,
        resultValues: {},
        validationErrors: {},
        isSaving: false,
        handleSave: vi.fn(),
        handleDiscard: vi.fn(),
        getDisplayValue: vi.fn(),
        handleValueChange: vi.fn(),
    }),
}))

vi.mock('@/hooks/use-unsaved-changes-guard', () => ({
    useUnsavedChangesGuard: vi.fn(),
}))

vi.mock('@/hooks/use-signature-status', () => ({
    useSignatureStatus: () => ({
        hasSignature: true,
        isLoading: false,
        error: null,
    }),
}))

vi.mock('@/hooks/use-coa-actions', () => ({
    useCoaActions: () => ({
        isGeneratingCoA: false,
        handleGenerateCoA: vi.fn(),
    }),
}))

vi.mock('@/hooks/use-print-handlers', () => ({
    usePrintHandlers: () => ({
        handlePrint: vi.fn(),
        handlePrintCoABody: vi.fn(),
        handlePrintBarcodeLabel: vi.fn(),
        closePrintPreview: vi.fn(),
        printPreview: {
            open: false,
            loading: false,
            error: null,
            html: null,
        },
    }),
}))

vi.mock('@/components/assigned-tests-toolbar', () => ({
    AssignedTestsToolbar: ({
        onSubmitForReview,
        onOpenAssignment,
    }: {
        onSubmitForReview: () => void
        onOpenAssignment?: () => void
    }) => (
        <>
            <button onClick={onSubmitForReview}>Submit for review</button>
            <button onClick={onOpenAssignment}>Open assignment</button>
        </>
    ),
}))

vi.mock('@/components/batch-save-toolbar', () => ({
    BatchSaveToolbar: () => null,
}))

vi.mock('@/components/result-cell-editor', () => ({
    ResultCellEditor: () => null,
}))

vi.mock('@/components/result-status-badge', () => ({
    ResultStatusBadge: () => null,
}))

vi.mock('@/components/test-assignment-module', () => ({
    TestAssignmentModule: (props: { specialties?: unknown }) => {
        capturedSpecialties.push(props.specialties)
        return null
    },
}))

vi.mock('@/components/qc/qc-row-indicator', () => ({
    QCRowIndicator: () => null,
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({ children, open }: { children?: ReactNode; open?: boolean }) => (open ? <>{children}</> : null),
    DialogContent: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogFooter: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <>{children}</>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <>{children}</>,
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

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

import { AssignedTestsPanel } from '../assigned-tests-panel'
import { approvalKeys, rejectionKeys } from '@/types/query-keys'

describe('AssignedTestsPanel rejection invalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedSpecialties.length = 0
    })

    it('invalidates approval and rejection counts after submit for review', async () => {
        const user = userEvent.setup()
        render(<AssignedTestsPanel sampleId="sample-1" />)

        expect(screen.queryByRole('button', { name: 'Complete draft review' })).toBeNull()
        await user.click(screen.getByRole('button', { name: 'Submit for review' }))
        await user.click(screen.getByRole('button', { name: 'Complete draft review' }))

        await waitFor(() =>
            expect(mockInvalidateQueries).toHaveBeenCalledWith({
                queryKey: approvalKeys.all,
                refetchType: 'all',
            }),
        )
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
            queryKey: approvalKeys.all,
            refetchType: 'all',
        })
        expect(mockInvalidateQueries).not.toHaveBeenCalledWith({
            queryKey: approvalKeys.count,
        })
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: rejectionKeys.count })
        expect(mockRefetchQueries).not.toHaveBeenCalled()
        expect(mockFetchTests).toHaveBeenCalled()
    })

    it('keeps the default specialties reference stable across rerenders', async () => {
        const user = userEvent.setup()
        const { rerender } = render(<AssignedTestsPanel sampleId="sample-1" />)
        await user.click(screen.getByRole('button', { name: 'Open assignment' }))

        rerender(<AssignedTestsPanel sampleId="sample-1" />)

        expect(capturedSpecialties.length).toBeGreaterThan(1)
        expect(new Set(capturedSpecialties).size).toBe(1)
    })
})
