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
        label: 'Received',
        className:
            'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700',
    },
    assigned: {
        label: 'Assigned',
        className:
            'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-200 dark:border-indigo-700',
    },
    in_progress: {
        label: 'In Progress',
        className:
            'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-200 dark:border-amber-700',
    },
    review: {
        label: 'Review',
        className:
            'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-200 dark:border-blue-700',
    },
    completed: {
        label: 'Completed',
        className:
            'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-200 dark:border-emerald-700',
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
