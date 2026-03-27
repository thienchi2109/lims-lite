import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'

const mockFetchSampleResultsClient = vi.fn()
const mockGetCoAStatus = vi.fn()
const mockGetQCStatusForAssays = vi.fn()

vi.mock('motion/react', () => ({
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
    motion: {
        div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
            <div {...props}>{children}</div>
        ),
    },
}))

vi.mock('@tanstack/react-query', () => ({
    useQueryClient: () => ({
        invalidateQueries: vi.fn(),
    }),
}))

vi.mock('next/navigation', () => ({
    useRouter: () => ({
        push: vi.fn(),
    }),
}))

vi.mock('@/lib/api-client', () => ({
    fetchSampleResultsClient: (...args: unknown[]) => mockFetchSampleResultsClient(...args),
    submitSampleForReviewClient: vi.fn(),
}))

vi.mock('@/app/actions/coa', () => ({
    getCoAStatus: (...args: unknown[]) => mockGetCoAStatus(...args),
}))

vi.mock('@/app/actions/qc-status', () => ({
    getQCStatusForAssays: (...args: unknown[]) => mockGetQCStatusForAssays(...args),
}))

vi.mock('@/components/sample-detail-panel', () => ({
    SampleDetailPanel: ({ sample }: { sample: { sample_id: string } | null }) => (
        <div data-testid="sample-detail-panel">{sample?.sample_id ?? 'empty'}</div>
    ),
}))

vi.mock('@/hooks/use-results-editor', () => ({
    useResultsEditor: () => ({
        pendingCount: 0,
        resultValues: {},
        validationErrors: {},
        isSaving: false,
        handleSave: vi.fn(),
        handleDiscard: vi.fn(),
        getDisplayValue: (result: { value?: string | null }) => result.value ?? '',
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
    AssignedTestsToolbar: () => <div data-testid="assigned-tests-toolbar" />,
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

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

import { SampleBottomRow } from '../sample-bottom-row'

const sample = {
    id: 'sample-1',
    sample_id: 'CDC-XN-0001',
    results: [
        {
            id: 'result-1',
            assay_id: 'assay-1',
            assay_name: 'Glucose',
            sample_status: 'assigned',
            status: 'entered',
            value: '5.2',
        },
    ],
} as any

describe('SampleBottomRow composition dedupe', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockFetchSampleResultsClient.mockResolvedValue({
            data: [],
            error: null,
        })
        mockGetCoAStatus.mockResolvedValue({
            status: null,
        })
        mockGetQCStatusForAssays.mockResolvedValue({})
    })

    it('keeps the core assigned-results row visible without refetching when the bottom row already has core results', async () => {
        render(<SampleBottomRow sample={sample} userRole="manager" />)

        await waitFor(() => {
            expect(mockFetchSampleResultsClient).not.toHaveBeenCalled()
        })

        expect(screen.getByText('Glucose')).toBeDefined()
        expect(screen.getByTestId('assigned-tests-panel')).toBeDefined()
    })
})
