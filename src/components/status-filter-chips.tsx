'use client'

import { useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SampleStatus } from '@/types'

// All sample statuses in display order
const ALL_STATUSES: SampleStatus[] = [
    'received',
    'assigned',
    'in_progress',
    'review',
    'completed',
    'discarded',
]

// Vietnamese status labels
const statusLabels: Record<SampleStatus, string> = {
    received: 'Đã nhận',
    assigned: 'Đã chỉ định',
    in_progress: 'Đang thực hiện',
    review: 'Chờ duyệt',
    completed: 'Hoàn thành',
    discarded: 'Loại bỏ',
}

// Status colors for visual distinction (hex values for charts, Tailwind classes for chips)
export const statusHexColors: Record<SampleStatus, string> = {
    received: '#3b82f6',    // blue-500
    assigned: '#a855f7',    // purple-500
    in_progress: '#eab308', // yellow-500
    review: '#f97316',      // orange-500
    completed: '#22c55e',   // green-500
    discarded: '#64748b',   // slate-500
}

// Tailwind class variants for chip styling
const statusChipColors: Record<SampleStatus, { bg: string; border: string; text: string }> = {
    received: { bg: 'bg-blue-500', border: 'border-blue-500', text: 'text-blue-700' },
    assigned: { bg: 'bg-purple-500', border: 'border-purple-500', text: 'text-purple-700' },
    in_progress: { bg: 'bg-yellow-500', border: 'border-yellow-500', text: 'text-yellow-700' },
    review: { bg: 'bg-orange-500', border: 'border-orange-500', text: 'text-orange-700' },
    completed: { bg: 'bg-green-500', border: 'border-green-500', text: 'text-green-700' },
    discarded: { bg: 'bg-gray-500', border: 'border-gray-500', text: 'text-gray-700' },
}

type StatusFilterChipsProps = {
    selectedStatuses: SampleStatus[]
}

/**
 * Toggle chips for filtering by sample status.
 * Updates URL params for shareable, bookmark-able filter state.
 * Used by Reports page for specialty sample chart filtering.
 */
export function StatusFilterChips({
    selectedStatuses,
}: StatusFilterChipsProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const searchParamsString = useMemo(() => searchParams.toString(), [searchParams])

    const allSelected = selectedStatuses.length === ALL_STATUSES.length

    const updateStatuses = (newStatuses: SampleStatus[]) => {
        const params = new URLSearchParams(searchParamsString)

        if (newStatuses.length === ALL_STATUSES.length || newStatuses.length === 0) {
            // Default = all, cleaner URL; or none selected = clear param
            params.delete('statuses')
        } else {
            params.set('statuses', newStatuses.join(','))
        }

        const query = params.toString()
        router.push(query ? `${pathname}?${query}` : pathname)
    }

    const toggleStatus = (status: SampleStatus) => {
        const isSelected = selectedStatuses.includes(status)
        const newStatuses = isSelected
            ? selectedStatuses.filter((s) => s !== status)
            : [...selectedStatuses, status]
        updateStatuses(newStatuses)
    }

    const toggleAll = () => {
        // Toggle between all selected and none selected
        updateStatuses(allSelected ? [] : ALL_STATUSES)
    }

    return (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Lọc theo trạng thái mẫu">
            {/* "Tất cả" chip */}
            <button
                type="button"
                onClick={toggleAll}
                aria-pressed={allSelected}
                className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                    'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1',
                    allSelected
                        ? 'border-sky-500 bg-sky-500 text-white hover:bg-sky-600'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                )}
            >
                {allSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                <span>Tất cả</span>
            </button>

            {/* Individual status chips */}
            {ALL_STATUSES.map((status) => {
                const isSelected = selectedStatuses.includes(status)
                const colors = statusChipColors[status]

                return (
                    <button
                        key={status}
                        type="button"
                        onClick={() => toggleStatus(status)}
                        aria-pressed={isSelected}
                        className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all',
                            'focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-1',
                            isSelected
                                ? `${colors.border} ${colors.bg} text-white hover:opacity-90`
                                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                        )}
                    >
                        {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                        <span>{statusLabels[status]}</span>
                    </button>
                )
            })}
        </div>
    )
}

// Export for use in other components
export { ALL_STATUSES, statusLabels }
