'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { submitSampleForReviewClient } from '@/lib/api-client'
import { renderCoATemplate } from '@/lib/coa/template'
import { buildResultReviewDraftData } from '@/lib/result-review-draft'
import {
    SubmitResultReviewSchema,
    type ResultReferenceAssessment,
    type ResultWithAssay,
} from '@/types'

interface ResultReviewDraftDialogProps {
    hasSignature?: boolean
    onOpenChange: (open: boolean) => void
    onSubmitted: () => Promise<void> | void
    open: boolean
    results: ResultWithAssay[]
    sampleId: string
    signatureLoading?: boolean
}

const ASSESSMENT_OPTIONS: Array<{
    label: string
    value: ResultReferenceAssessment
}> = [
    {
        label: 'Trong khoảng tham chiếu',
        value: 'within_reference_range',
    },
    {
        label: 'Ngoài khoảng tham chiếu',
        value: 'outside_reference_range',
    },
]

export function ResultReviewDraftDialog({
    hasSignature = true,
    onOpenChange,
    onSubmitted,
    open,
    results,
    sampleId,
    signatureLoading = false,
}: ResultReviewDraftDialogProps) {
    const [assessments, setAssessments] = useState<Record<string, ResultReferenceAssessment>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)
    const allResultsAssessed = results.length > 0 && results.every((result) => assessments[result.id])
    const canSubmit = allResultsAssessed && hasSignature && !signatureLoading && !isSubmitting

    const draftHtml = useMemo(
        () =>
            renderCoATemplate(buildResultReviewDraftData(sampleId, results), {
                assessments,
                mode: 'draft',
            }),
        [assessments, results, sampleId],
    )

    const handleOpenChange = (nextOpen: boolean, forceClose = false) => {
        if (!nextOpen && isSubmitting && !forceClose) return

        if (!nextOpen) {
            setAssessments({})
            setIsSubmitting(false)
        }
        onOpenChange(nextOpen)
    }

    const handleAssessmentChange = (
        resultId: string,
        assessment: ResultReferenceAssessment,
    ) => {
        setAssessments((current) => ({
            ...current,
            [resultId]: assessment,
        }))
    }

    const handleSubmit = async () => {
        if (!canSubmit) return

        setIsSubmitting(true)
        try {
            const payload = SubmitResultReviewSchema.parse({
                sampleId,
                assessments: results.map((result) => ({
                    result_id: result.id,
                    assessment: assessments[result.id],
                    result_updated_at: result.updated_at,
                    assay_updated_at: result.assay_updated_at,
                })),
            })
            const response = await submitSampleForReviewClient(payload)

            if (response.error) {
                toast.error(response.error)
                return
            }

            toast.success('Đã gửi mẫu để phê duyệt')
            await onSubmitted()
            handleOpenChange(false, true)
        } catch (error) {
            const message = error instanceof Error
                ? error.message
                : 'Có lỗi xảy ra khi gửi phê duyệt'
            toast.error(message)
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="flex max-h-[94vh] w-[96vw] max-w-[1500px] flex-col overflow-hidden p-0"
                showCloseButton={!isSubmitting}
            >
                <DialogHeader className="border-b px-5 py-4">
                    <DialogTitle>Rà soát bản nháp kết quả xét nghiệm</DialogTitle>
                    <DialogDescription>
                        Kiểm tra nội dung phiếu và đánh giá thủ công từng kết quả trước khi gửi phê duyệt.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_22rem]">
                    <div className="min-h-[42vh] border-b bg-slate-100 lg:min-h-0 lg:border-r lg:border-b-0">
                        <iframe
                            className="h-full min-h-[42vh] w-full bg-white"
                            srcDoc={draftHtml}
                            title="Bản nháp kết quả xét nghiệm"
                        />
                    </div>

                    <ScrollArea className="min-h-0">
                        <div className="space-y-4 p-5">
                            <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
                                BẢN NHÁP - CHƯA GỬI DUYỆT
                            </div>

                            {!signatureLoading && !hasSignature ? (
                                <Alert variant="destructive">
                                    <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                                    <AlertTitle>Chữ ký chưa được thiết lập</AlertTitle>
                                    <AlertDescription>
                                        <Link
                                            href="/profile?tab=signature"
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="underline hover:no-underline"
                                        >
                                            Tải lên chữ ký điện tử
                                        </Link>
                                        {' '}trước khi gửi phê duyệt.
                                    </AlertDescription>
                                </Alert>
                            ) : null}

                            {results.map((result, index) => (
                                <fieldset
                                    key={result.id}
                                    className="rounded border border-slate-200 p-3"
                                >
                                    <legend className="px-1 text-sm font-semibold">
                                        {index + 1}. {result.assay_name}
                                    </legend>
                                    <dl className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                                        <dt>Kết quả</dt>
                                        <dd className="font-medium text-slate-900">
                                            {result.value || '-'} {result.assay_units || ''}
                                        </dd>
                                        <dt>Khoảng tham chiếu</dt>
                                        <dd>{result.normal_range || '-'}</dd>
                                        <dt>Phương pháp</dt>
                                        <dd>{result.method_name || '-'}</dd>
                                    </dl>
                                    <div className="space-y-2">
                                        {ASSESSMENT_OPTIONS.map((option) => {
                                            const inputId = `${result.id}-${option.value}`
                                            return (
                                                <label
                                                    key={option.value}
                                                    htmlFor={inputId}
                                                    className="flex cursor-pointer items-center gap-2 text-sm"
                                                >
                                                    <input
                                                        checked={assessments[result.id] === option.value}
                                                        id={inputId}
                                                        name={`assessment-${result.id}`}
                                                        onChange={() =>
                                                            handleAssessmentChange(result.id, option.value)
                                                        }
                                                        type="radio"
                                                        value={option.value}
                                                    />
                                                    {option.label}
                                                </label>
                                            )
                                        })}
                                    </div>
                                </fieldset>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="border-t px-5 py-4">
                    <Button
                        disabled={isSubmitting}
                        onClick={() => handleOpenChange(false)}
                        variant="outline"
                    >
                        Quay lại chỉnh sửa
                    </Button>
                    <Button
                        className="bg-emerald-600 hover:bg-emerald-700"
                        disabled={!canSubmit}
                        onClick={() => void handleSubmit()}
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang gửi...
                            </>
                        ) : (
                            'Gửi phê duyệt'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
