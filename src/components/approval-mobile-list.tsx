'use client'

/**
 * ApprovalMobileList
 *
 * Scrollable card list that replaces the desktop data grid at <1280px.
 * Renders ApprovalSampleCard for each sample with empty state and counter.
 */

import { ClipboardList } from 'lucide-react'
import { ApprovalSampleCard, type ApprovalCardSample } from '@/components/approval-sample-card'

interface ApprovalMobileListProps {
    samples: ApprovalCardSample[]
    selectedSampleId: string | null
    onSelectSample: (sampleId: string) => void
    tab?: 'review' | 'completed'
}

export function ApprovalMobileList({
    samples,
    selectedSampleId,
    onSelectSample,
    tab = 'review',
}: ApprovalMobileListProps) {
    if (samples.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800">
                    <ClipboardList className="h-7 w-7 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="mt-4 text-sm font-medium text-slate-500 dark:text-slate-400">
                    Không có mẫu nào trong danh sách
                </p>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Card list */}
            <div className="flex flex-col gap-2 px-1">
                {samples.map((sample) => (
                    <ApprovalSampleCard
                        key={sample.id}
                        sample={sample}
                        isSelected={sample.id === selectedSampleId}
                        onSelect={onSelectSample}
                    />
                ))}
            </div>

            {/* Summary counter */}
            <div className="mt-2 py-3 text-center">
                <span className="text-xs text-slate-400 dark:text-slate-500">
                    {samples.length} {tab === 'completed' ? 'mẫu đã phê duyệt' : 'mẫu đang chờ phê duyệt'}
                </span>
            </div>
        </div>
    )
}
