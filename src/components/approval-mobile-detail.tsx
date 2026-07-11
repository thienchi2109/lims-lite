'use client'

/**
 * ApprovalMobileDetail
 *
 * Bottom drawer for viewing sample details and approving/rejecting on mobile.
 * Reuses existing SampleDetailPanel, AssignedTestsPanel, and ApprovalActions.
 * Opens when a sample is selected from the mobile card list.
 *
 * Close flow: DrawerClose asChild wraps a button that calls onClose.
 * The Drawer's onOpenChange handles swipe-to-dismiss (single close path).
 */

import { X } from 'lucide-react'
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { ApprovalActions } from '@/components/approval-actions'
import { SubmittedAssessmentReview } from '@/components/submitted-assessment-review'
import type {
    SampleWithUser,
    ResultWithAssay,
    SampleSubmissionReview,
} from '@/types'

interface ApprovalMobileDetailProps {
    sample: SampleWithUser | null
    results: ResultWithAssay[]
    submissionReview?: SampleSubmissionReview | null
    open: boolean
    onClose: () => void
    isLoadingSample?: boolean
    loadErrorMessage?: string | null
}

export function ApprovalMobileDetail({
    sample,
    results,
    submissionReview = null,
    open,
    onClose,
    isLoadingSample = false,
    loadErrorMessage = null,
}: ApprovalMobileDetailProps) {
    if (!open) return null

    return (
        <Drawer open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <DrawerContent className="max-h-[85vh] flex flex-col">
                {/* Drawer Header */}
                <DrawerHeader className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 shrink-0">
                    <DrawerTitle className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {sample?.sample_id ?? 'Đang tải...'}
                    </DrawerTitle>
                    <DrawerClose asChild>
                        <button
                            className="rounded-full p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <X className="h-4 w-4 text-slate-500" />
                            <span className="sr-only">Đóng</span>
                        </button>
                    </DrawerClose>
                </DrawerHeader>

                {/* Scrollable content */}
                <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4">
                    {loadErrorMessage && (
                        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                            {loadErrorMessage}
                        </div>
                    )}

                    {/* Sample info */}
                    {sample ? (
                        <>
                            <SampleDetailPanel sample={sample} />

                            <SubmittedAssessmentReview review={submissionReview} />

                            {/* Test results */}
                            <AssignedTestsPanel
                                sampleId={sample.id}
                                userRole="manager"
                                initialResults={results}
                            />
                        </>
                    ) : (
                        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
                            Đang tải chi tiết mẫu...
                        </div>
                    )}
                </div>

                {/* Sticky footer with compact approval actions */}
                <div className="shrink-0 border-t border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-950">
                    {sample && !loadErrorMessage ? (
                        <ApprovalActions sampleId={sample.id} results={results} compact />
                    ) : (
                        <div className="text-sm text-slate-500 dark:text-slate-400">
                            {loadErrorMessage
                                ? 'Không thể phê duyệt khi dữ liệu đánh giá chưa tải được'
                                : isLoadingSample
                                  ? 'Đang tải thao tác mẫu...'
                                  : 'Chưa có mẫu được chọn'}
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    )
}
