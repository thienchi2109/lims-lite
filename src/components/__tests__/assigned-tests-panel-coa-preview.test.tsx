import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockHandlePrintCoABody = vi.fn()
const mockHandlePrint = vi.fn()
const mockClosePrintPreview = vi.fn()
const mockDialogProps: Array<Record<string, unknown>> = []
const mockDocumentPreviewProps: Array<Record<string, unknown>> = []

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
    submitSampleForReviewClient: vi.fn(),
}))

vi.mock('@/hooks/use-assigned-tests-data', () => ({
    useAssignedTestsData: () => ({
        results: [
            {
                id: 'result-1',
                assay_id: 'assay-1',
                assay_name: 'Glucose',
                sample_status: 'completed',
                value: '5.2',
            },
        ],
        loading: false,
        error: null,
        sampleStatus: 'completed',
        qcStatuses: {},
        coaStatus: 'ready',
        setCoaStatus: vi.fn(),
        fetchTests: vi.fn(),
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
        getDisplayValue: vi.fn(() => '5.2'),
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
        handlePrint: mockHandlePrint,
        handlePrintCoABody: mockHandlePrintCoABody,
        handlePrintBarcodeLabel: vi.fn(),
        closePrintPreview: mockClosePrintPreview,
        printPreview: {
            open: true,
            loading: false,
            error: null,
            html: '<html>Phiếu chỉ định</html>',
        },
    }),
}))

vi.mock('@/components/assigned-tests-toolbar', () => ({
    AssignedTestsToolbar: ({
        onPrint,
        onPreviewCoA,
        onPrintCoABody,
        onSubmitForReview,
        onOpenAssignment,
    }: {
        onPrint: () => void
        onPreviewCoA: () => void
        onPrintCoABody: () => void
        onSubmitForReview: () => void
        onOpenAssignment?: () => void
    }) => (
        <>
            <button onClick={onPrint}>In phiếu chỉ định</button>
            <button onClick={onPreviewCoA}>Xem CoA đầy đủ</button>
            <button onClick={onPrintCoABody}>Chỉ in bảng kết quả</button>
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
    TestAssignmentModule: () => null,
}))

vi.mock('@/components/qc/qc-row-indicator', () => ({
    QCRowIndicator: () => null,
}))

vi.mock('@/components/coa-preview-dialog', () => ({
    CoAPreviewDialog: (props: Record<string, unknown>) => {
        mockDialogProps.push(props)
        return props.open ? (
            <div data-testid="coa-preview-dialog">
                <button onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}>
                    Đóng
                </button>
            </div>
        ) : null
    },
}))

vi.mock('@/components/document-preview-dialog', () => ({
    DocumentPreviewDialog: (props: Record<string, unknown>) => {
        mockDocumentPreviewProps.push(props)
        return props.open ? (
            <div data-testid="document-preview-dialog">
                <button onClick={() => (props.onOpenChange as (open: boolean) => void)(false)}>
                    Đóng phiếu chỉ định
                </button>
            </div>
        ) : null
    },
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

describe('AssignedTestsPanel CoA preview wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockDialogProps.length = 0
        mockDocumentPreviewProps.length = 0
    })

    it('opens the staff CoA preview dialog from the toolbar and closes it again', async () => {
        render(<AssignedTestsPanel sampleId="sample-1" />)

        fireEvent.click(screen.getByRole('button', { name: 'Xem CoA đầy đủ' }))

        await waitFor(() => expect(screen.getByTestId('coa-preview-dialog')).toBeDefined())
        expect(mockDialogProps.at(-1)).toMatchObject({
            open: true,
            sampleId: 'sample-1',
            route: 'staff',
            title: 'Phiếu Kết Quả Phân Tích',
        })
        expect((mockDialogProps.at(-1) as { subtitle?: unknown }).subtitle).toBeUndefined()

        fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))

        await waitFor(() => expect(screen.queryByTestId('coa-preview-dialog')).toBeNull())
    })

    it('wires the print-body action through the toolbar', () => {
        render(<AssignedTestsPanel sampleId="sample-1" />)

        fireEvent.click(screen.getByRole('button', { name: 'Chỉ in bảng kết quả' }))

        expect(mockHandlePrintCoABody).toHaveBeenCalledTimes(1)
    })

    it('renders the test-order form through the shared document preview dialog', () => {
        render(<AssignedTestsPanel sampleId="sample-1" />)

        fireEvent.click(screen.getByRole('button', { name: 'In phiếu chỉ định' }))

        expect(mockHandlePrint).toHaveBeenCalledTimes(1)
        expect(mockDocumentPreviewProps.at(-1)).toMatchObject({
            open: true,
            title: 'Phiếu chỉ định xét nghiệm',
            subtitle: 'Mẫu sample-1',
            loading: false,
            error: null,
            html: '<html>Phiếu chỉ định</html>',
            onRetry: mockHandlePrint,
        })

        fireEvent.click(screen.getByRole('button', { name: 'Đóng phiếu chỉ định' }))

        expect(mockClosePrintPreview).toHaveBeenCalledTimes(1)
    })

    it('keeps the results region in a constrained scroll chain for split-panel layouts', () => {
        const { container } = render(<AssignedTestsPanel sampleId="sample-1" />)

        const panel = container.firstElementChild as HTMLDivElement | null
        const scrollRegion = screen.getByRole('table').parentElement?.parentElement?.parentElement as HTMLDivElement | null

        expect(panel?.className).toContain('min-h-0')
        expect(scrollRegion?.className).toContain('flex-1')
        expect(scrollRegion?.className).toContain('min-h-0')
        expect(scrollRegion?.className).toContain('overflow-auto')
    })
})
