import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockInvalidateQueries = vi.fn().mockResolvedValue(undefined)
const mockPush = vi.fn()
const mockFetchTests = vi.fn()
const capturedSpecialties: unknown[] = []

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: mockInvalidateQueries,
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: mockPush,
    }),
    useSearchParams: () => new URLSearchParams('page=2'),
}))

vi.mock('@/lib/api-client', () => ({
    submitSampleForReviewClient: vi.fn(),
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
    }),
}))

vi.mock('@/components/assigned-tests-toolbar', () => ({
    AssignedTestsToolbar: ({ onSubmitForReview }: { onSubmitForReview: () => void }) => (
        <button onClick={onSubmitForReview}>Submit for review</button>
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
    Dialog: ({ children }: { children?: ReactNode }) => <>{children}</>,
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

import { submitSampleForReviewClient } from '@/lib/api-client'
import { AssignedTestsPanel } from '../assigned-tests-panel'
import { approvalKeys, rejectionKeys } from '@/types/query-keys'

const mockSubmitSampleForReviewClient = vi.mocked(submitSampleForReviewClient)

describe('AssignedTestsPanel rejection invalidation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        capturedSpecialties.length = 0
    })

    it('invalidates approval and rejection counts after submit for review', async () => {
        mockSubmitSampleForReviewClient.mockResolvedValue({ success: true })

        render(<AssignedTestsPanel sampleId="sample-1" />)

        fireEvent.click(screen.getByRole('button', { name: 'Submit for review' }))
        fireEvent.click(screen.getByRole('button', { name: 'Xác nhận gửi' }))

        await waitFor(() =>
            expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: approvalKeys.count }),
        )
        expect(mockInvalidateQueries).toHaveBeenCalledWith({ queryKey: rejectionKeys.count })
        expect(mockFetchTests).toHaveBeenCalled()
    })

    it('keeps the default specialties reference stable across rerenders', () => {
        const { rerender } = render(<AssignedTestsPanel sampleId="sample-1" />)

        rerender(<AssignedTestsPanel sampleId="sample-1" />)

        expect(capturedSpecialties.length).toBeGreaterThan(1)
        expect(new Set(capturedSpecialties).size).toBe(1)
    })
})
