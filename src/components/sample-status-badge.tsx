'use client'

import { Badge } from '@/components/ui/badge'
import { type SampleStatus } from '@/types'

interface SampleStatusBadgeProps {
    status: SampleStatus
}

const statusConfig: Record<
    SampleStatus,
    { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
    received: { label: 'Received', variant: 'secondary' },
    assigned: { label: 'Assigned', variant: 'default' },
    in_progress: { label: 'In Progress', variant: 'outline' },
    review: { label: 'Review', variant: 'outline' },
    completed: { label: 'Completed', variant: 'default' },
}

export function SampleStatusBadge({ status }: SampleStatusBadgeProps) {
    const config = statusConfig[status]

    return (
        <Badge variant={config.variant} className="capitalize">
            {config.label}
        </Badge>
    )
}
