'use client'

import { SampleWithUser, ResultWithAssay } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { ApprovalActions } from '@/components/approval-actions'
import { AlertCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface ApprovalBottomRowProps {
    sample: SampleWithUser | null
    results: ResultWithAssay[]
}

export function ApprovalBottomRow({ sample, results }: ApprovalBottomRowProps) {
    const router = useRouter()

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="h-full min-h-0 overflow-y-auto">
                <SampleDetailPanel sample={sample} />
            </div>
            <div className="h-full min-h-0 overflow-y-auto flex flex-col gap-4 pr-1">
                <AssignedTestsPanel sampleId={sample.id} />
                <ApprovalActions sampleId={sample.id} results={results} />
            </div>
        </div>
    )
}
