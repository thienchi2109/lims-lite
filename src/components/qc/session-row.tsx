'use client'

import { format } from 'date-fns'
import { vi } from 'date-fns/locale'
import {
    Activity,
    AlertTriangle,
    CheckCircle2,
    Clock,
    XCircle,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { TableCell, TableRow } from '@/components/ui/table'
import { EndSessionDialog } from './end-session-dialog'
import type { QCSessionRow } from '@/types/qc'

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<string, {
    icon: typeof CheckCircle2
    label: string
    variant: 'default' | 'secondary' | 'destructive' | 'outline'
    className?: string
}> = {
    pending: { icon: Clock, label: 'Chờ QC', variant: 'outline' },
    pass: { icon: CheckCircle2, label: 'Đạt', variant: 'default', className: 'bg-green-600' },
    warning: { icon: AlertTriangle, label: 'Cảnh báo', variant: 'secondary', className: 'bg-yellow-500 text-black' },
    blocked: { icon: XCircle, label: 'Bị chặn', variant: 'destructive' },
    resolved: { icon: CheckCircle2, label: 'Đã xử lý', variant: 'outline', className: 'border-green-600 text-green-600' },
}

export const SESSION_MODE_LABELS: Record<string, string> = {
    daily: 'Hàng ngày',
    batch: 'Theo lô',
    shift: 'Theo ca',
}

// ============================================================================
// SESSION ROW COMPONENT
// ============================================================================

interface SessionRowProps {
    session: QCSessionRow
    isSelected: boolean
    onToggleSelect: (id: string) => void
    onSessionEnded: () => void
}

export function SessionRow({
    session,
    isSelected,
    onToggleSelect,
    onSessionEnded,
}: SessionRowProps) {
    const statusConfig = STATUS_CONFIG[session.qc_status] || STATUS_CONFIG.pending
    const StatusIcon = statusConfig.icon
    const isActive = !session.ended_at

    return (
        <TableRow>
            <TableCell className="w-10">
                {isActive && (
                    <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => onToggleSelect(session.id)}
                        aria-label={`Chọn phiên ${session.assay_name}`}
                    />
                )}
            </TableCell>
            <TableCell>
                <div>
                    <div className="font-medium">{session.assay_name}</div>
                    {session.specialty_name && (
                        <div className="text-xs text-muted-foreground">{session.specialty_name}</div>
                    )}
                </div>
            </TableCell>
            <TableCell>
                <Badge variant="outline">
                    {SESSION_MODE_LABELS[session.session_mode] || session.session_mode}
                </Badge>
            </TableCell>
            <TableCell>
                <Badge variant={statusConfig.variant} className={`gap-1 ${statusConfig.className || ''}`}>
                    <StatusIcon className="h-3 w-3" />
                    {statusConfig.label}
                </Badge>
            </TableCell>
            <TableCell>
                <div className="text-sm">
                    {format(new Date(session.started_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                </div>
                {session.started_by_name && (
                    <div className="text-xs text-muted-foreground">{session.started_by_name}</div>
                )}
            </TableCell>
            <TableCell>
                {session.ended_at ? (
                    <div className="text-sm">
                        {format(new Date(session.ended_at), 'dd/MM/yyyy HH:mm', { locale: vi })}
                    </div>
                ) : (
                    <Badge variant="outline" className="text-green-600 border-green-600">
                        <Activity className="h-3 w-3 mr-1" />
                        Đang hoạt động
                    </Badge>
                )}
            </TableCell>
            <TableCell className="text-center">
                <span className="font-medium">{session.results_count}</span>
            </TableCell>
            <TableCell className="text-center">
                {session.violations_count > 0 ? (
                    <Badge variant="destructive">{session.violations_count}</Badge>
                ) : (
                    <span className="text-muted-foreground">0</span>
                )}
            </TableCell>
            <TableCell className="text-right">
                {isActive && (
                    <EndSessionDialog
                        sessionId={session.id}
                        onSuccess={onSessionEnded}
                    />
                )}
            </TableCell>
        </TableRow>
    )
}
