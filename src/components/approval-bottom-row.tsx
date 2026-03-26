'use client'

import { SampleWithUser, ResultWithAssay } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { ApprovalActions } from '@/components/approval-actions'
import { AlertCircle } from 'lucide-react'

interface ApprovalBottomRowProps {
    sample: SampleWithUser | null
    results: ResultWithAssay[]
    isLoadingSample?: boolean
    loadErrorMessage?: string | null
}

export function ApprovalBottomRow({
    sample,
    results,
    isLoadingSample = false,
    loadErrorMessage = null,
}: ApprovalBottomRowProps) {
    if (loadErrorMessage && !sample) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50/50 p-8 dark:border-red-900/50 dark:bg-red-950/20">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/50">
                        <AlertCircle className="h-6 w-6 text-red-500 dark:text-red-300" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-red-700 dark:text-red-200">
                        Không thể tải chi tiết mẫu
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-300">
                        {loadErrorMessage}
                    </p>
                </div>
            </div>
        )
    }

    if (!sample) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-8 dark:border-slate-800 dark:bg-slate-900/50">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
                        <AlertCircle className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
                        Chưa chọn mẫu
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Vui lòng chọn một mẫu từ danh sách bên trên để xem chi tiết và phê duyệt kết quả.
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative flex h-full min-h-0 flex-col gap-3">
            {loadErrorMessage && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-200">
                    {loadErrorMessage}
                </div>
            )}

            <div className="grid h-full min-h-0 grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="flex h-full min-h-0 flex-col overflow-hidden">
                    <div className="flex-1 min-h-0">
                        <SampleDetailPanel sample={sample} />
                    </div>
                </div>
                <div className="flex h-full min-h-0 flex-col gap-3 overflow-hidden pr-1">
                    <div className="flex-1 min-h-0 overflow-hidden">
                        <AssignedTestsPanel
                            sampleId={sample.id}
                            userRole="manager"
                            initialResults={results}
                        />
                    </div>
                    <div className="shrink-0">
                        <ApprovalActions sampleId={sample.id} results={results} />
                    </div>
                </div>
            </div>

            {isLoadingSample && (
                <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-white/60 px-4 py-8 dark:bg-slate-950/60">
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                        Đang tải chi tiết mẫu...
                    </div>
                </div>
            )}
        </div>
    )
}
