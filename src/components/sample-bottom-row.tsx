'use client'

import { SampleWithUser } from '@/types'
import { SampleDetailPanel } from '@/components/sample-detail-panel'
import { AssignedTestsPanel } from '@/components/assigned-tests-panel'

interface SampleBottomRowProps {
    sample: SampleWithUser | null
}

export function SampleBottomRow({ sample }: SampleBottomRowProps) {
    if (!sample) {
        return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
                <div className="h-full min-h-0">
                    <SampleDetailPanel sample={null} />
                </div>
                <div className="h-full min-h-0 flex items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-slate-400">
                    Chọn một mẫu để xem chi tiết và chỉ định xét nghiệm
                </div>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-full">
            <div className="h-full min-h-0">
                <SampleDetailPanel sample={sample} />
            </div>
            <div className="h-full min-h-0">
                <AssignedTestsPanel sampleId={sample.id} />
            </div>
        </div>
    )
}
