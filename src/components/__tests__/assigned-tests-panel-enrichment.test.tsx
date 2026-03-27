import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

const mockCoAStatus = vi.fn()
const mockQCStatusForAssays = vi.fn()

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

vi.mock('@/app/actions/coa', () => ({
    getCoAStatus: (...args: unknown[]) => mockCoAStatus(...args),
}))

vi.mock('@/app/actions/qc-status', () => ({
    getQCStatusForAssays: (...args: unknown[]) => mockQCStatusForAssays(...args),
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
    AssignedTestsToolbar: ({
        enrichmentNotice,
        enrichmentError,
    }: {
        enrichmentNotice?: string
        enrichmentError?: string
    }) => {
        return (
            <div
                data-testid="assigned-tests-toolbar"
                data-notice={enrichmentNotice ?? ''}
                data-error={enrichmentError ?? ''}
            >
                {enrichmentError || enrichmentNotice || 'Tóm tắt xét nghiệm'}
            </div>
        )
    },
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

import { AssignedTestsPanel } from '../assigned-tests-panel'

const initialResults = [
    {
        id: 'result-1',
        assay_id: 'assay-1',
        assay_name: 'Glucose',
        sample_status: 'completed',
        status: 'entered',
        value: '5.2',
    },
]

describe('AssignedTestsPanel enrichment isolation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        mockCoAStatus.mockImplementation(async () => new Promise(() => {}))
        mockQCStatusForAssays.mockImplementation(async () => new Promise(() => {}))
    })

    it('keeps the core assigned-results table visible while enrichment remains pending', () => {
        render(<AssignedTestsPanel sampleId="sample-1" initialResults={initialResults as any} />)

        expect(screen.getByText('Glucose')).toBeDefined()
        expect(screen.getByText('Đang tải trạng thái bổ sung...')).toBeDefined()
    })

    it('keeps the core assigned-results table visible while enrichment fails', async () => {
        mockCoAStatus.mockRejectedValueOnce(new Error('CoA enrichment failed'))
        mockQCStatusForAssays.mockResolvedValueOnce({})

        render(<AssignedTestsPanel sampleId="sample-1" initialResults={initialResults as any} />)

        expect(screen.getByText('Glucose')).toBeDefined()
        expect(screen.getByText('Không thể tải trạng thái bổ sung')).toBeDefined()
    })
})
