import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const mockSubmitSampleForReviewClient = vi.fn()
const mockToastError = vi.fn()
const mockToastSuccess = vi.fn()

vi.mock('@/lib/api-client', () => ({
    submitSampleForReviewClient: (...args: unknown[]) => mockSubmitSampleForReviewClient(...args),
}))

vi.mock('sonner', () => ({
    toast: {
        error: (...args: unknown[]) => mockToastError(...args),
        success: (...args: unknown[]) => mockToastSuccess(...args),
    },
}))

vi.mock('@/components/ui/dialog', () => ({
    Dialog: ({
        children,
        onOpenChange,
        open,
    }: {
        children?: ReactNode
        onOpenChange?: (open: boolean) => void
        open?: boolean
    }) => (
        open ? (
            <>
                <button onClick={() => onOpenChange?.(false)}>Đóng hộp thoại</button>
                {children}
            </>
        ) : null
    ),
    DialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogDescription: ({ children }: { children?: ReactNode }) => <p>{children}</p>,
    DialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
    DialogTitle: ({ children }: { children?: ReactNode }) => <h2>{children}</h2>,
}))

import type { ResultWithAssay } from '@/types'
import { ResultReviewDraftDialog } from '../result-review-draft-dialog'

const SAMPLE_ID = '11111111-1111-4111-8111-111111111111'
const RESULT_ONE_ID = '22222222-2222-4222-8222-222222222222'
const RESULT_TWO_ID = '33333333-3333-4333-8333-333333333333'

function createResult(id: string, assayName: string): ResultWithAssay {
    return {
        id,
        sample_id: SAMPLE_ID,
        assay_id: '44444444-4444-4444-8444-444444444444',
        method_id: null,
        value: '5.2',
        status: 'entered',
        entered_by: null,
        entered_at: '2026-07-11T08:30:00.000Z',
        approved_by: null,
        approved_at: null,
        approval_note: null,
        created_at: '2026-07-11T08:00:00.000Z',
        updated_at: '2026-07-11T09:00:00.000Z',
        assay_name: assayName,
        assay_units: 'mmol/L',
        normal_range: '4.1 - 5.9',
        method_name: 'Máy sinh hóa',
        validation_rules: {},
        assay_updated_at: '2026-07-10T09:00:00.000Z',
        sample_id_display: 'LIMS-001',
        sample_status: 'in_progress',
        sample_type: 'Máu',
        received_date: '2026-07-11T07:00:00.000Z',
        sample_quality: false,
        client_name: 'Nguyễn Văn A',
        client_dob: '1990-01-01',
        client_gender: 'Nam',
        client_address: 'Cần Thơ',
        client_health_insurance_num: 'BHYT-001',
        entered_by_name: null,
        lab_specialty_name: 'Sinh hóa',
        lab_specialty_order: 1,
    }
}

const results = [
    createResult(RESULT_ONE_ID, 'Glucose'),
    createResult(RESULT_TWO_ID, 'Creatinine'),
]

describe('ResultReviewDraftDialog', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('requires one explicit manual assessment for every result', () => {
        render(
            <ResultReviewDraftDialog
                open
                onOpenChange={vi.fn()}
                sampleId={SAMPLE_ID}
                results={results}
                onSubmitted={vi.fn()}
            />,
        )

        expect(screen.getByText('BẢN NHÁP - CHƯA GỬI DUYỆT')).toBeDefined()
        expect(screen.getAllByLabelText('Trong khoảng tham chiếu')).toHaveLength(2)
        expect(screen.getAllByLabelText('Ngoài khoảng tham chiếu')).toHaveLength(2)
        expect(
            (screen.getByRole('button', { name: 'Gửi phê duyệt' }) as HTMLButtonElement)
                .disabled,
        ).toBe(true)
        expect(screen.getByTitle('Bản nháp kết quả xét nghiệm').getAttribute('srcdoc')).toContain('4.1 - 5.9')
        expect(screen.getByTitle('Bản nháp kết quả xét nghiệm').getAttribute('srcdoc')).toContain('Không đạt')
    })

    it('cancels without attempting a mutation', () => {
        const onOpenChange = vi.fn()

        render(
            <ResultReviewDraftDialog
                open
                onOpenChange={onOpenChange}
                sampleId={SAMPLE_ID}
                results={results}
                onSubmitted={vi.fn()}
            />,
        )

        fireEvent.click(screen.getByRole('button', { name: 'Quay lại chỉnh sửa' }))

        expect(onOpenChange).toHaveBeenCalledWith(false)
        expect(mockSubmitSampleForReviewClient).not.toHaveBeenCalled()
    })

    it('submits only identifiers, assessments, and revision tokens', async () => {
        const onSubmitted = vi.fn().mockResolvedValue(undefined)
        const onOpenChange = vi.fn()
        mockSubmitSampleForReviewClient.mockResolvedValue({ success: true })

        render(
            <ResultReviewDraftDialog
                open
                onOpenChange={onOpenChange}
                sampleId={SAMPLE_ID}
                results={results}
                onSubmitted={onSubmitted}
            />,
        )

        fireEvent.click(screen.getAllByLabelText('Trong khoảng tham chiếu')[0])
        fireEvent.click(screen.getAllByLabelText('Ngoài khoảng tham chiếu')[1])
        fireEvent.click(screen.getByRole('button', { name: 'Gửi phê duyệt' }))

        await waitFor(() =>
            expect(mockSubmitSampleForReviewClient).toHaveBeenCalledWith({
                sampleId: SAMPLE_ID,
                assessments: [
                    {
                        result_id: RESULT_ONE_ID,
                        assessment: 'within_reference_range',
                        result_updated_at: '2026-07-11T09:00:00.000Z',
                        assay_updated_at: '2026-07-10T09:00:00.000Z',
                    },
                    {
                        result_id: RESULT_TWO_ID,
                        assessment: 'outside_reference_range',
                        result_updated_at: '2026-07-11T09:00:00.000Z',
                        assay_updated_at: '2026-07-10T09:00:00.000Z',
                    },
                ],
            }),
        )
        expect(onSubmitted).toHaveBeenCalledTimes(1)
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })

    it('keeps the draft open when the server rejects stale data', async () => {
        const onSubmitted = vi.fn()
        const onOpenChange = vi.fn()
        mockSubmitSampleForReviewClient.mockResolvedValue({
            error: 'Dữ liệu kết quả đã thay đổi. Vui lòng mở lại bản nháp.',
        })

        render(
            <ResultReviewDraftDialog
                open
                onOpenChange={onOpenChange}
                sampleId={SAMPLE_ID}
                results={results}
                onSubmitted={onSubmitted}
            />,
        )

        fireEvent.click(screen.getAllByLabelText('Trong khoảng tham chiếu')[0])
        fireEvent.click(screen.getAllByLabelText('Trong khoảng tham chiếu')[1])
        fireEvent.click(screen.getByRole('button', { name: 'Gửi phê duyệt' }))

        await waitFor(() =>
            expect(mockToastError).toHaveBeenCalledWith(
                'Dữ liệu kết quả đã thay đổi. Vui lòng mở lại bản nháp.',
            ),
        )
        expect(onSubmitted).not.toHaveBeenCalled()
        expect(onOpenChange).not.toHaveBeenCalledWith(false)
    })

    it('does not close while the submission request is running', async () => {
        let resolveSubmission: ((value: { success: true }) => void) | undefined
        mockSubmitSampleForReviewClient.mockReturnValue(
            new Promise((resolve) => {
                resolveSubmission = resolve
            }),
        )
        const onOpenChange = vi.fn()
        const onSubmitted = vi.fn()

        render(
            <ResultReviewDraftDialog
                open
                onOpenChange={onOpenChange}
                sampleId={SAMPLE_ID}
                results={results}
                onSubmitted={onSubmitted}
            />,
        )

        fireEvent.click(screen.getAllByLabelText('Trong khoảng tham chiếu')[0])
        fireEvent.click(screen.getAllByLabelText('Ngoài khoảng tham chiếu')[1])
        fireEvent.click(screen.getByRole('button', { name: 'Gửi phê duyệt' }))
        await waitFor(() => expect(mockSubmitSampleForReviewClient).toHaveBeenCalledTimes(1))

        fireEvent.click(screen.getByRole('button', { name: 'Đóng hộp thoại' }))

        expect(onOpenChange).not.toHaveBeenCalled()
        resolveSubmission?.({ success: true })
        await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1))
        expect(onOpenChange).toHaveBeenCalledWith(false)
    })
})
