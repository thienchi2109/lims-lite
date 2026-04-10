'use client'

import { AlertCircle } from 'lucide-react'
import { ApprovalActions } from '@/components/approval-actions'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { StickyPanelShell } from '@/components/ui/sticky-panel-shell'
import type { ResultWithAssay, SampleWithUser } from '@/types'

interface ApprovalInspectorColumnProps {
    sample: SampleWithUser | null
    results: ResultWithAssay[]
    isLoadingSample?: boolean
    loadErrorMessage?: string | null
}

function EmptyPanelMessage({ message }: { message: string }) {
    return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-slate-500">
            {message}
        </div>
    )
}

export function ApprovalInspectorColumn({
    sample,
    results,
    isLoadingSample = false,
    loadErrorMessage = null,
}: ApprovalInspectorColumnProps) {
    if (loadErrorMessage && !sample) {
        return (
            <div className="flex h-full items-center justify-center rounded-lg border border-red-200 bg-red-50/60 p-8">
                <div className="text-center">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-6 w-6 text-red-500" />
                    </div>
                    <h3 className="mb-1 text-lg font-semibold text-red-700">
                        Không thể tải chi tiết mẫu
                    </h3>
                    <p className="text-sm text-red-600">{loadErrorMessage}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(0,1fr)] gap-2">
            <StickyPanelShell header="Thông tin mẫu" bodyClassName="min-h-0 p-0">
                {sample ? (
                    <div className="h-full min-h-0">
                        <SampleDetailPanel sample={sample} />
                    </div>
                ) : (
                    <EmptyPanelMessage message="Chọn một mẫu để xem thông tin chi tiết." />
                )}
            </StickyPanelShell>

            <StickyPanelShell header="Xét nghiệm và phê duyệt" bodyClassName="min-h-0 p-0">
                {sample ? (
                    <div className="flex h-full min-h-0 flex-col">
                        {loadErrorMessage && (
                            <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                                {loadErrorMessage}
                            </div>
                        )}

                        <div className="min-h-0 flex-1">
                            <AssignedTestsPanel
                                sampleId={sample.id}
                                userRole="manager"
                                initialResults={results}
                            />
                        </div>

                        <div className="border-t border-slate-200 bg-white px-4 py-3">
                            <ApprovalActions sampleId={sample.id} results={results} compact />
                        </div>
                    </div>
                ) : (
                    <EmptyPanelMessage message="Chọn một mẫu để xem xét nghiệm và thao tác phê duyệt." />
                )}
            </StickyPanelShell>

            {isLoadingSample && sample && (
                <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-white/60 px-4 py-8">
                    <div className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                        Đang tải chi tiết mẫu...
                    </div>
                </div>
            )}
        </div>
    )
}
