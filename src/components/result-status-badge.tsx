'use client'

import { motion } from 'motion/react'
import { ResultStatus } from '@/types'
import { Badge } from '@/components/ui/badge'
import { Clock, Edit, CheckCircle } from 'lucide-react'
import { statusBadgePulse } from '@/lib/motion'

interface ResultStatusBadgeProps {
    status: ResultStatus
}

export function ResultStatusBadge({ status }: ResultStatusBadgeProps) {
    const variants: Record<
        ResultStatus,
        {
            className: string
            icon: React.ReactNode
            label: string
        }
    > = {
        pending: {
            className:
                'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200',
            icon: <Clock className="h-3 w-3" />,
            label: 'Pending',
        },
        entered: {
            className:
                'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border-blue-200',
            icon: <Edit className="h-3 w-3" />,
            label: 'Entered',
        },
        approved: {
            className:
                'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border-green-200',
            icon: <CheckCircle className="h-3 w-3" />,
            label: 'Approved',
        },
    }

    const variant = variants[status]

    return (
        <motion.div
            key={status}
            animate={statusBadgePulse}
            style={{ display: 'inline-flex' }}
        >
            <Badge variant="outline" className={`${variant.className} gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-250`}>
                {variant.icon}
                <span>{variant.label}</span>
            </Badge>
        </motion.div>
    )
}
