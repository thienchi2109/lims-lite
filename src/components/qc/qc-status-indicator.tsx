'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Alert,
    AlertDescription,
    AlertTitle,
} from '@/components/ui/alert'
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    XCircle,
    ShieldCheck,
    ExternalLink,
} from 'lucide-react'
import Link from 'next/link'
import type { QCStatus } from '@/types/qc'

// ============================================================================
// STATUS CONFIGURATION
// ============================================================================

const STATUS_CONFIG: Record<QCStatus, {
    icon: typeof CheckCircle2
    label: string
    description: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    alertVariant: 'default' | 'destructive'
    canApprove: boolean
}> = {
    pending: {
        icon: Clock,
        label: 'Chờ QC',
        description: 'Phiên QC chưa có kết quả',
        variant: 'outline',
        alertVariant: 'default',
        canApprove: false,
    },
    pass: {
        icon: CheckCircle2,
        label: 'QC Đạt',
        description: 'Kiểm soát chất lượng đạt yêu cầu',
        variant: 'default',
        alertVariant: 'default',
        canApprove: true,
    },
    warning: {
        icon: AlertTriangle,
        label: 'Cảnh báo',
        description: 'QC có cảnh báo nhưng vẫn có thể phê duyệt',
        variant: 'secondary',
        alertVariant: 'default',
        canApprove: true,
    },
    blocked: {
        icon: XCircle,
        label: 'Bị chặn',
        description: 'QC thất bại - không thể phê duyệt cho đến khi xử lý vi phạm',
        variant: 'destructive',
        alertVariant: 'destructive',
        canApprove: false,
    },
    resolved: {
        icon: ShieldCheck,
        label: 'Đã xử lý',
        description: 'Vi phạm đã được xử lý - có thể phê duyệt',
        variant: 'outline',
        alertVariant: 'default',
        canApprove: true,
    },
}

// ============================================================================
// TYPES
// ============================================================================

interface QCStatusIndicatorProps {
    /** Current QC session status */
    status: QCStatus | null
    /** Session ID for linking to resolution */
    sessionId?: string | null
    /** Assay name for context */
    assayName?: string
    /** Number of unresolved violations */
    unresolvedViolations?: number
    /** Show as compact badge only */
    compact?: boolean
    /** Show link to QC management page */
    showLink?: boolean
}

// ============================================================================
// COMPONENTS
// ============================================================================

/**
 * Compact badge for inline status display
 */
export function QCStatusBadge({ status }: { status: QCStatus | null }) {
    if (!status) {
        return (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                Không có QC
            </Badge>
        )
    }

    const config = STATUS_CONFIG[status]
    const Icon = config.icon

    return (
        <Badge
            variant={config.variant}
            className={`gap-1 ${status === 'pass' ? 'bg-green-600' : ''} ${status === 'warning' ? 'bg-yellow-500 text-black' : ''}`}
        >
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    )
}

/**
 * Full status indicator with alert for approval dialogs
 */
export function QCStatusIndicator({
    status,
    sessionId,
    assayName,
    unresolvedViolations = 0,
    compact = false,
    showLink = true,
}: QCStatusIndicatorProps) {
    // Compact mode - just show badge
    if (compact) {
        return <QCStatusBadge status={status} />
    }

    // No session - pre-QC era, allow approval
    if (!status || !sessionId) {
        return (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Không có phiên QC (cho phép phê duyệt)</span>
            </div>
        )
    }

    const config = STATUS_CONFIG[status]
    const Icon = config.icon

    return (
        <Alert variant={config.alertVariant}>
            <Icon className="h-4 w-4" />
            <AlertTitle className="flex items-center gap-2">
                Trạng thái QC: {config.label}
                {assayName && (
                    <span className="font-normal text-muted-foreground">
                        ({assayName})
                    </span>
                )}
            </AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
                <p>{config.description}</p>

                {/* Show violation count for blocked status */}
                {status === 'blocked' && unresolvedViolations > 0 && (
                    <p className="font-medium text-destructive">
                        {unresolvedViolations} vi phạm chưa xử lý
                    </p>
                )}

                {/* Approval status message */}
                <p className={config.canApprove ? 'text-green-600' : 'text-destructive'}>
                    {config.canApprove
                        ? '✓ Có thể phê duyệt kết quả'
                        : '✗ Không thể phê duyệt - cần xử lý vi phạm QC trước'}
                </p>

                {/* Link to QC management for blocked status */}
                {showLink && status === 'blocked' && (
                    <Button variant="outline" size="sm" asChild className="mt-2">
                        <Link href="/manager/quality-control">
                            <ExternalLink className="mr-2 h-4 w-4" />
                            Xử lý vi phạm QC
                        </Link>
                    </Button>
                )}
            </AlertDescription>
        </Alert>
    )
}

/**
 * Hook-friendly function to check if approval is allowed
 */
export function canApproveWithQCStatus(status: QCStatus | null): boolean {
    // No QC session = pre-QC era, allow approval
    if (!status) return true
    return STATUS_CONFIG[status]?.canApprove ?? false
}
