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
            'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-200 dark:border-yellow-800',
    },
    assigned: {
        label: 'Đã chỉ định',
        className:
            'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-200 dark:border-green-800',
    },
    in_progress: {
        label: 'Đang thực hiện',
        className:
            'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800',
    },
    review: {
        label: 'Chờ duyệt',
        className:
            'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/30 dark:text-sky-200 dark:border-sky-800',
    },
    completed: {
        label: 'Hoàn thành',
        className:
            'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
    },
}

export function SampleStatusBadge({ status }: SampleStatusBadgeProps) {
    const config = statusConfig[status]

    return (
        <Badge
            variant="outline"
            className={`capitalize rounded-full px-3 py-1 text-xs font-semibold ${config.className}`}
        >
            {config.label}
        </Badge>
    )
}
