'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/utils'

type DashboardAlertVariant = 'warning' | 'error'

interface DashboardAlertBannerProps {
    count: number
    variant: DashboardAlertVariant
    message: string
    linkText: string
    linkHref: string
    className?: string
}

const alertVariantMap: Record<DashboardAlertVariant, 'warning' | 'destructive'> = {
    warning: 'warning',
    error: 'destructive',
}

export function DashboardAlertBanner({
    count,
    variant,
    message,
    linkText,
    linkHref,
    className,
}: DashboardAlertBannerProps) {
    if (count <= 0) {
        return null
    }

    const accentClassName =
        variant === 'warning' ? 'border-l-amber-500' : 'border-l-rose-500'

    return (
        <Alert
            variant={alertVariantMap[variant]}
            className={cn(
                'mt-6 rounded-2xl border-l-4 px-5 py-4 shadow-sm',
                accentClassName,
                className,
            )}
        >
            <AlertTriangle className="h-5 w-5" />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                    <AlertTitle className="mb-0 text-sm font-semibold">
                        {variant === 'warning'
                            ? 'Có thông báo cần xử lý'
                            : 'Có mẫu bị từ chối'}
                    </AlertTitle>
                    <AlertDescription className="text-sm">
                        {message.split('{count}').join(String(count))}
                    </AlertDescription>
                </div>
                <Link
                    href={linkHref}
                    className="inline-flex items-center text-sm font-semibold underline-offset-4 hover:underline"
                >
                    {linkText}
                </Link>
            </div>
        </Alert>
    )
}
