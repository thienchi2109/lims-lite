'use client'

import { Badge } from '@/components/ui/badge'
import { type SampleStatus } from '@/types'

interface SampleStatusBadgeProps {
    status: SampleStatus
}

const statusConfig: Record<
    SampleStatus,
    {
        label: string
        className: string
    }
> = {
    received: {
        label: 'Đã nhận',
        className:
            'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800',
    },
    assigned: {
        label: 'Đã chỉ định',
        className:
            'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/20 dark:text-sky-400 dark:border-sky-800',
    },
    in_progress: {
        label: 'Đang thực hiện',
        className:
            'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800',
    },
    review: {
        label: 'Chờ duyệt',
        className:
            'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800',
    },
    completed: {
        label: 'Hoàn thành',
        className:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    },
    discarded: {
        label: 'Loại bỏ',
        className:
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    },
}

export function SampleStatusBadge({ status }: SampleStatusBadgeProps) {
    const config = statusConfig[status]

    return (
        <Badge
            variant="outline"
            className={`capitalize rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm ${config.className}`}
        >
            {config.label}
        </Badge>
    )
}
