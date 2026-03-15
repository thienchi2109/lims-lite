'use client'

/**
 * ApprovalSampleCard
 *
 * Touch-friendly card for the mobile approval queue.
 * Displays sample ID, client name, status, progress, and CoA badge.
 * Used by ApprovalMobileList to replace the desktop data grid at <1280px.
 */

import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { SampleStatus, CoAReportStatus } from '@/types'

/** Data shape for a single approval card */
export interface ApprovalCardSample {
    id: string
    sample_id: string
    status: SampleStatus
    client_name: string | null
    total_tests: number
    entered_count: number
    approved_count: number
    pending_count: number
    updated_at: string | null
    coa_reports?: Array<{ status: CoAReportStatus }> | null
}

interface ApprovalSampleCardProps {
    sample: ApprovalCardSample
    isSelected?: boolean
    onSelect: (sampleId: string) => void
}

/** Vietnamese status label map */
const STATUS_LABEL: Record<string, string> = {
    received: 'Đã nhận',
    in_progress: 'Đang thực hiện',
    review: 'Chờ Duyệt',
    completed: 'Hoàn thành',
    rejected: 'Từ chối',
    voided: 'Đã hủy',
}

/** Status badge color map */
const STATUS_COLOR: Record<string, string> = {
    received: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    review: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    voided: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500',
}

export function ApprovalSampleCard({
    sample,
    isSelected = false,
    onSelect,
}: ApprovalSampleCardProps) {
    const statusLabel = STATUS_LABEL[sample.status] ?? sample.status
    const statusColor = STATUS_COLOR[sample.status] ?? STATUS_COLOR.received

    return (
        <button
            type="button"
            onClick={() => onSelect(sample.id)}
            className={cn(
                'w-full text-left rounded-xl border bg-white p-4 transition-all duration-150',
                'active:scale-[0.98] hover:shadow-md',
                'dark:bg-slate-900 dark:border-slate-800',
                isSelected
                    ? 'border-sky-500 shadow-sm shadow-sky-500/10 bg-sky-50/50 dark:bg-sky-950/20'
                    : 'border-slate-200 dark:border-slate-800',
            )}
        >
            <div className="flex items-start justify-between gap-3">
                {/* Left content */}
                <div className="flex-1 min-w-0">
                    {/* Sample ID */}
                    <p className="font-mono text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {sample.sample_id}
                    </p>

                    {/* Client name */}
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 truncate">
                        {sample.client_name ?? 'Không có tên'}
                    </p>

                    {/* Progress + Status row */}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Badge
                            className={cn(
                                'text-[11px] font-medium px-2 py-0.5 border-0',
                                statusColor,
                            )}
                        >
                            {statusLabel}
                        </Badge>

                        <span className="text-xs text-slate-400 dark:text-slate-500">
                            {sample.entered_count + sample.approved_count}/{sample.total_tests} xét nghiệm
                            {sample.approved_count > 0 && ` · ${sample.approved_count} đã duyệt`}
                        </span>
                    </div>
                </div>

                {/* Right chevron */}
                <ChevronRight className="h-5 w-5 text-slate-300 dark:text-slate-600 mt-2 shrink-0" />
            </div>
        </button>
    )
}
