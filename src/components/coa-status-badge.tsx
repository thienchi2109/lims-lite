'use client'

import { Badge } from '@/components/ui/badge'
import { type CoAReportStatus } from '@/types'
import { CheckCircle2, Clock, XCircle } from 'lucide-react'

interface CoAStatusBadgeProps {
    status: CoAReportStatus | null | undefined
}

const statusConfig: Record<
    CoAReportStatus,
    {
        label: string
        icon: React.ComponentType<{ className?: string }>
        className: string
    }
> = {
    pending: {
        label: 'Đang tạo',
        icon: Clock,
        className:
            'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    },
    ready: {
        label: 'Sẵn sàng',
        icon: CheckCircle2,
        className:
            'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    },
    failed: {
        label: 'Lỗi',
        icon: XCircle,
        className:
            'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    },
}

export function CoAStatusBadge({ status }: CoAStatusBadgeProps) {
    if (!status) {
        return (
            <Badge
                variant="outline"
                className="capitalize rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800"
            >
                Chưa tạo
            </Badge>
        )
    }

    const config = statusConfig[status]
    const Icon = config.icon

    return (
        <Badge
            variant="outline"
            className={`capitalize rounded-full px-2.5 py-0.5 text-[11px] font-medium shadow-sm flex items-center gap-1 ${config.className}`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    )
}
