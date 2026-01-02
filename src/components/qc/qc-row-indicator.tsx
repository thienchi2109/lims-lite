'use client'

import { CheckCircle2, AlertTriangle, XCircle, Circle, Minus } from 'lucide-react'
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AssayQCStatusValue } from '@/app/actions/qc-status'

interface QCRowIndicatorProps {
    status: AssayQCStatusValue
    message?: string
    lastQCAt?: string | null
    className?: string
}

const statusConfig: Record<AssayQCStatusValue, {
    icon: typeof CheckCircle2
    colorClass: string
    bgClass: string
    label: string
}> = {
    pass: {
        icon: CheckCircle2,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-100 dark:bg-emerald-900/30',
        label: 'QC đạt',
    },
    warning: {
        icon: AlertTriangle,
        colorClass: 'text-amber-600 dark:text-amber-400',
        bgClass: 'bg-amber-100 dark:bg-amber-900/30',
        label: 'QC có cảnh báo',
    },
    blocked: {
        icon: XCircle,
        colorClass: 'text-red-600 dark:text-red-400',
        bgClass: 'bg-red-100 dark:bg-red-900/30',
        label: 'QC thất bại',
    },
    pending: {
        icon: Circle,
        colorClass: 'text-red-500 dark:text-red-400',
        bgClass: 'bg-red-50 dark:bg-red-900/20',
        label: 'Chưa nhập QC',
    },
    no_session: {
        icon: Minus,
        colorClass: 'text-slate-400 dark:text-slate-500',
        bgClass: 'bg-slate-100 dark:bg-slate-800',
        label: 'Chưa có phiên QC',
    },
}

export function QCRowIndicator({
    status,
    message,
    lastQCAt,
    className,
}: QCRowIndicatorProps) {
    const config = statusConfig[status]
    const Icon = config.icon

    const tooltipContent = (
        <div className="space-y-1 text-xs">
            <div className="font-medium">{message || config.label}</div>
            {lastQCAt && (
                <div className="text-slate-400">
                    Lần cuối: {new Date(lastQCAt).toLocaleString('vi-VN')}
                </div>
            )}
        </div>
    )

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span
                    className={cn(
                        'inline-flex h-5 w-5 items-center justify-center rounded-full',
                        config.bgClass,
                        className
                    )}
                >
                    <Icon className={cn('h-3 w-3', config.colorClass)} />
                </span>
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-[200px]">
                {tooltipContent}
            </TooltipContent>
        </Tooltip>
    )
}
