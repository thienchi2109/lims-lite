'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import { WalkthroughTrigger, useWalkthrough } from '@/components/walkthrough'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    FlaskConical,
    Plus,
    CheckCircle,
    Printer,
    FileText,
    RefreshCw,
    ExternalLink,
    Activity,
    MoreHorizontal,
    HelpCircle,
} from 'lucide-react'
import type { SampleStatus, CoAReportStatus } from '@/types'
import { cn } from '@/lib/utils'

interface AssignedTestsToolbarProps {
    resultsCount: number
    sampleStatus: SampleStatus | null
    coaStatus: CoAReportStatus | null
    canSubmitForReview: boolean
    hasPendingChanges: boolean
    hasSignature: boolean
    signatureLoading: boolean
    isGeneratingCoA: boolean
    onPrint: () => void
    onGenerateCoA: () => void
    onSubmitForReview: () => void
    onOpenAssignment: () => void
    onPreviewCoA: () => void
    onPrintCoABody: () => void
    userRole?: 'analyst' | 'manager'
}

export function AssignedTestsToolbar({
    resultsCount,
    sampleStatus,
    coaStatus,
    canSubmitForReview,
    hasPendingChanges,
    hasSignature,
    signatureLoading,
    isGeneratingCoA,
    onPrint,
    onGenerateCoA,
    onSubmitForReview,
    onOpenAssignment,
    onPreviewCoA,
    onPrintCoABody,
    userRole,
}: AssignedTestsToolbarProps) {
    // Determine QC page link based on user role
    const qcHref = userRole === 'manager' ? '/manager/quality-control' : '/analyst/qc-entry'
    const walkthroughTourId = sampleStatus === 'completed' && coaStatus !== 'ready' ? 'coa' : 'results'
    const isReadyCoA = sampleStatus === 'completed' && coaStatus === 'ready'
    const { startTour, isReady: isWalkthroughReady } = useWalkthrough()

    return (
        <div
            id="tour-sample-info"
            className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/60 bg-white/80 px-4 py-3 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:bg-slate-900/80 dark:border-slate-800/60 transition-all duration-200"
        >
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 ring-1 ring-indigo-500/10 dark:bg-indigo-900/20 dark:text-indigo-400">
                    <FlaskConical className="h-4 w-4" />
                </div>
                <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                        Chỉ định xét nghiệm
                    </h3>
                    <Badge
                        variant="secondary"
                        className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-md border border-slate-200 bg-slate-100 px-1.5 text-[11px] font-medium text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-400"
                    >
                        {resultsCount}
                    </Badge>
                </div>

                {(sampleStatus === 'completed' || coaStatus) && (
                    <div className="flex items-center gap-2 border-l border-slate-200 pl-3 dark:border-slate-700">
                        {sampleStatus === 'completed' && <CoAStatusBadge status={coaStatus} />}
                    </div>
                )}

                <span className="hidden sm:inline-flex">
                    <WalkthroughTrigger tourId={walkthroughTourId} />
                </span>
            </div>

            <div className="flex items-center gap-1">
                {/* Visual Separator */}
                <div className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-800" />

                {/* Test Order Form Print Button — desktop only */}
                <span className="hidden sm:inline-flex">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 transition-transform hover:scale-105 hover:bg-slate-100 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-indigo-400"
                                disabled={resultsCount === 0}
                                onClick={onPrint}
                            >
                                <Printer className="h-4 w-4" />
                                <span className="sr-only">In Phiếu chỉ định</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>In Phiếu chỉ định</TooltipContent>
                    </Tooltip>
                </span>

                {/* IQC Button - Internal Quality Control */}
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="sm"
                            className={cn(
                                "h-8 gap-1.5 text-white shadow-md transition-all hover:scale-105 hover:shadow-lg",
                                "bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-amber-500/20"
                            )}
                            asChild
                        >
                            <Link href={qcHref}>
                                <Activity className="h-4 w-4" />
                                <span className="hidden sm:inline text-xs font-medium">IQC</span>
                            </Link>
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent>Kiểm soát chất lượng nội bộ</TooltipContent>
                </Tooltip>

                {/* CoA Generation/View Button - Only for completed samples */}
                {sampleStatus === 'completed' && (
                    <>
                        {!coaStatus || coaStatus === 'failed' || coaStatus === 'pending' ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        id="tour-coa-generate"
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-emerald-600 transition-transform hover:scale-105 hover:bg-emerald-50 hover:text-emerald-700 dark:text-emerald-500 dark:hover:bg-emerald-900/20"
                                        onClick={onGenerateCoA}
                                        disabled={isGeneratingCoA}
                                    >
                                        {isGeneratingCoA ? (
                                            <RefreshCw className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <FileText className="h-4 w-4" />
                                        )}
                                        <span className="sr-only">
                                            {isGeneratingCoA
                                                ? 'Đang tạo...'
                                                : coaStatus === 'failed' || coaStatus === 'pending'
                                                    ? 'Tạo lại CoA'
                                                    : 'Tạo CoA'}
                                        </span>
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    {coaStatus === 'failed' || coaStatus === 'pending' ? 'Tạo lại CoA' : 'Tạo chứng nhận (CoA)'}
                                </TooltipContent>
                            </Tooltip>
                        ) : (
                            isReadyCoA && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            id="tour-coa-view"
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-blue-600 transition-transform hover:scale-105 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-500 dark:hover:bg-blue-900/20"
                                            title="Phiếu kết quả (CoA)"
                                        >
                                            <ExternalLink className="h-4 w-4" />
                                            <span className="sr-only">Phiếu kết quả (CoA)</span>
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={onPreviewCoA}>
                                            <ExternalLink className="mr-2 h-4 w-4" />
                                            Xem CoA đầy đủ
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={onPrintCoABody}>
                                            <Printer className="mr-2 h-4 w-4" />
                                            Chỉ in bảng kết quả
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )
                        )}
                    </>
                )}

                {/* Submit for Review Button */}
                {sampleStatus === 'in_progress' && canSubmitForReview && (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                id="tour-submit-review"
                                size="icon"
                                className="h-8 w-8 bg-emerald-600 text-white shadow-sm transition-all hover:scale-105 hover:bg-emerald-700 hover:shadow-emerald-500/20"
                                onClick={onSubmitForReview}
                                disabled={hasPendingChanges || !hasSignature || signatureLoading}
                                title={!hasSignature ? "Vui lòng tải lên chữ ký trước khi nộp" : undefined}
                                aria-disabled={hasPendingChanges || !hasSignature || signatureLoading}
                            >
                                <CheckCircle className="h-4 w-4" />
                                <span className="sr-only">Gửi duyệt</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                            {signatureLoading
                                ? 'Đang kiểm tra chữ ký...'
                                : !hasSignature
                                    ? 'Vui lòng tải lên chữ ký trước khi nộp'
                                    : hasPendingChanges
                                        ? 'Lưu thay đổi trước khi gửi duyệt'
                                        : 'Gửi duyệt kết quả'}
                        </TooltipContent>
                    </Tooltip>
                )}

                {/* Add Test Button — desktop only */}
                <span className="hidden sm:inline-flex">
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="icon"
                                className={cn(
                                    "ml-1 h-8 w-8 text-white shadow-md transition-all hover:scale-105 hover:shadow-lg",
                                    "bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-indigo-500/20"
                                )}
                                onClick={onOpenAssignment}
                            >
                                <Plus className="h-4 w-4" />
                                <span className="sr-only">Chỉ định</span>
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Chỉ định xét nghiệm</TooltipContent>
                    </Tooltip>
                </span>

                {/* Mobile overflow menu — collapses Print, Hướng dẫn, Add Test */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-slate-500 sm:hidden flex"
                            data-testid="mobile-overflow-menu"
                        >
                            <MoreHorizontal className="h-4 w-4" />
                            <span className="sr-only">Thêm thao tác</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        {isReadyCoA && (
                            <>
                                <DropdownMenuItem onClick={onPreviewCoA}>
                                    <ExternalLink className="mr-2 h-4 w-4" />
                                    Xem CoA đầy đủ
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={onPrintCoABody}>
                                    <Printer className="mr-2 h-4 w-4" />
                                    Chỉ in bảng kết quả
                                </DropdownMenuItem>
                            </>
                        )}
                        <DropdownMenuItem onClick={onPrint} disabled={resultsCount === 0}>
                            <Printer className="mr-2 h-4 w-4" />
                            In Phiếu chỉ định
                        </DropdownMenuItem>
                        {isWalkthroughReady && (
                            <DropdownMenuItem onClick={() => startTour(walkthroughTourId)}>
                                <HelpCircle className="mr-2 h-4 w-4" />
                                Hướng dẫn
                            </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={onOpenAssignment}>
                            <Plus className="mr-2 h-4 w-4" />
                            Chỉ định xét nghiệm
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )
}
