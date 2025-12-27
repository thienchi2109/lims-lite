'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import { WalkthroughTrigger } from '@/components/walkthrough'
import {
    FlaskConical,
    Plus,
    CheckCircle,
    Printer,
    FileText,
} from 'lucide-react'
import type { SampleStatus, CoAReportStatus } from '@/types'

interface AssignedTestsToolbarProps {
    resultsCount: number
    sampleId: string
    sampleStatus: SampleStatus | null
    coaStatus: CoAReportStatus | null
    canSubmitForReview: boolean
    hasPendingChanges: boolean
    isGeneratingCoA: boolean
    onPrint: () => void
    onGenerateCoA: () => void
    onSubmitForReview: () => void
    onOpenAssignment: () => void
}

export function AssignedTestsToolbar({
    resultsCount,
    sampleId,
    sampleStatus,
    coaStatus,
    canSubmitForReview,
    hasPendingChanges,
    isGeneratingCoA,
    onPrint,
    onGenerateCoA,
    onSubmitForReview,
    onOpenAssignment,
}: AssignedTestsToolbarProps) {
    return (
        <div
            id="tour-sample-info"
            className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3"
        >
            <div className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-indigo-600" />
                <h3 className="font-semibold text-slate-700">Chỉ định xét nghiệm</h3>
                <Badge
                    variant="secondary"
                    className="ml-2 bg-slate-100 text-slate-600 hover:bg-slate-200"
                >
                    {resultsCount}
                </Badge>
                {sampleStatus === 'completed' && <CoAStatusBadge status={coaStatus} />}
                <WalkthroughTrigger tourId="results" />
            </div>
            <div className="flex items-center gap-2">
                {/* Test Order Form Print Button */}
                <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-600"
                    disabled={resultsCount === 0}
                    onClick={onPrint}
                >
                    <Printer className="h-4 w-4" />
                    In Phiếu chỉ định
                </Button>

                {/* CoA Generation/View Button - Only for completed samples */}
                {sampleStatus === 'completed' && (
                    <>
                        {!coaStatus || coaStatus === 'failed' ? (
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50"
                                onClick={onGenerateCoA}
                                disabled={isGeneratingCoA}
                            >
                                <FileText
                                    className={`h-4 w-4 ${isGeneratingCoA ? 'animate-spin' : ''}`}
                                />
                                {isGeneratingCoA
                                    ? 'Đang tạo...'
                                    : coaStatus === 'failed'
                                      ? 'Tạo lại CoA'
                                      : 'Tạo CoA'}
                            </Button>
                        ) : (
                            coaStatus === 'ready' && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 border-blue-200 bg-white text-blue-600 hover:bg-blue-50"
                                    onClick={() =>
                                        window.open(`/api/coa/view?sample_id=${sampleId}`, '_blank')
                                    }
                                >
                                    <FileText className="h-4 w-4" />
                                    Xem phiếu KQ
                                </Button>
                            )
                        )}
                    </>
                )}

                {/* Submit for Review Button */}
                {sampleStatus === 'in_progress' && canSubmitForReview && (
                    <Button
                        id="tour-submit-review"
                        size="sm"
                        className="gap-2 bg-emerald-600 text-white hover:bg-emerald-700"
                        onClick={onSubmitForReview}
                        disabled={hasPendingChanges}
                    >
                        <CheckCircle className="h-4 w-4" />
                        Gửi duyệt
                    </Button>
                )}

                <Button
                    size="sm"
                    className="gap-2 bg-indigo-600 hover:bg-indigo-700"
                    onClick={onOpenAssignment}
                >
                    <Plus className="h-4 w-4" />
                    Chỉ định
                </Button>
            </div>
        </div>
    )
}
