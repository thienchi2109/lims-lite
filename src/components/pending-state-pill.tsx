'use client'

import { Loader2 } from 'lucide-react'

interface PendingStatePillProps {
    label: string
    className?: string
}

export function PendingStatePill({ label, className }: PendingStatePillProps) {
    return (
        <div
            className={
                className ??
                'flex items-center gap-1.5 rounded-full border border-sky-100 bg-white px-3 py-1.5 text-xs font-medium text-sky-700 shadow-sm'
            }
        >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            <span>{label}</span>
        </div>
    )
}
