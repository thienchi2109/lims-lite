'use client'

import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    SESSION_MODE_LABELS,
    STATUS_CONFIG,
    type SessionWithDetails,
} from './qc-session-types'

interface SessionHistoryTableProps {
    sessions: SessionWithDetails[]
    maxItems?: number
}

function StatusBadge({ status }: { status: string }) {
    const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
    const Icon = config.icon

    return (
        <Badge variant={config.variant} className={`gap-1 ${config.className || ''}`}>
            <Icon className="h-3 w-3" />
            {config.label}
        </Badge>
    )
}

export function SessionHistoryTable({
    sessions,
    maxItems = 10,
}: SessionHistoryTableProps) {
    if (sessions.length === 0) {
        return (
            <p className="text-center text-muted-foreground py-2">
                Chưa có lịch sử phiên
            </p>
        )
    }

    return (
        <div className="space-y-2">
            <h4 className="font-medium">Lịch sử phiên</h4>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Thời gian</TableHead>
                            <TableHead>Chế độ</TableHead>
                            <TableHead>Trạng thái</TableHead>
                            <TableHead>Người bắt đầu</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sessions.slice(0, maxItems).map((session) => (
                            <TableRow key={session.id}>
                                <TableCell className="text-sm">
                                    {new Date(session.started_at).toLocaleDateString('vi-VN')}
                                </TableCell>
                                <TableCell>
                                    {SESSION_MODE_LABELS[session.session_mode] || session.session_mode}
                                </TableCell>
                                <TableCell>
                                    <StatusBadge status={session.qc_status} />
                                </TableCell>
                                <TableCell className="text-sm">
                                    {session.started_by_user?.full_name || '-'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
