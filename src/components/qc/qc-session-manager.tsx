'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card'
import { Clock, History } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

import {
    SESSION_MODE_LABELS,
    STATUS_CONFIG,
    type AssayOption,
    type SessionWithDetails,
} from './qc-session-types'
import { StartSessionDialog } from './start-session-dialog'
import { EndSessionDialog } from './end-session-dialog'
import { SessionHistoryTable } from './session-history-table'

interface QCSessionManagerProps {
    /** Available assays for session creation */
    assays: AssayOption[]
    /** Active session for selected assay (if any) */
    activeSession?: SessionWithDetails | null
    /** Session history */
    sessionHistory?: SessionWithDetails[]
    /** Currently selected assay ID */
    selectedAssayId?: string
    /** Callback when assay selection changes */
    onAssayChange?: (assayId: string) => void
    /** Callback when session state changes */
    onSessionChange?: () => void
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

/**
 * QC Session Manager component for managing QC sessions
 * Manager only - allows starting/ending sessions and viewing history
 */
export function QCSessionManager({
    assays,
    activeSession,
    sessionHistory = [],
    selectedAssayId,
    onAssayChange,
    onSessionChange,
}: QCSessionManagerProps) {
    const [showHistory, setShowHistory] = useState(false)

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Clock className="h-5 w-5" />
                            Quản lý phiên QC
                        </CardTitle>
                        <CardDescription>
                            Bắt đầu và kết thúc phiên kiểm soát chất lượng
                        </CardDescription>
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowHistory(!showHistory)}
                    >
                        <History className="mr-2 h-4 w-4" />
                        Lịch sử
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Assay Selection */}
                <div className="space-y-2">
                    <Label>Xét nghiệm</Label>
                    <Select
                        value={selectedAssayId}
                        onValueChange={onAssayChange}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Chọn xét nghiệm..." />
                        </SelectTrigger>
                        <SelectContent>
                            {assays.map((assay) => (
                                <SelectItem key={assay.id} value={assay.id}>
                                    {assay.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* Active Session Display */}
                {activeSession ? (
                    <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <span className="font-medium">Phiên đang hoạt động</span>
                            <StatusBadge status={activeSession.qc_status} />
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div>
                                <span className="text-muted-foreground">Chế độ:</span>
                                <span className="ml-2">
                                    {SESSION_MODE_LABELS[activeSession.session_mode] || activeSession.session_mode}
                                </span>
                            </div>
                            <div>
                                <span className="text-muted-foreground">Bắt đầu:</span>
                                <span className="ml-2">
                                    {formatDistanceToNow(new Date(activeSession.started_at), {
                                        addSuffix: true,
                                        locale: vi,
                                    })}
                                </span>
                            </div>
                            {activeSession.started_by_user && (
                                <div className="col-span-2">
                                    <span className="text-muted-foreground">Người bắt đầu:</span>
                                    <span className="ml-2">{activeSession.started_by_user.full_name}</span>
                                </div>
                            )}
                        </div>

                        <EndSessionDialog
                            sessionId={activeSession.id}
                            onSuccess={onSessionChange}
                        />
                    </div>
                ) : selectedAssayId ? (
                    <div className="rounded-lg border border-dashed p-4 text-center space-y-3">
                        <p className="text-muted-foreground">Không có phiên QC đang hoạt động</p>
                        <StartSessionDialog
                            selectedAssayId={selectedAssayId}
                            onSuccess={onSessionChange}
                        />
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-4">
                        Chọn xét nghiệm để quản lý phiên QC
                    </p>
                )}

                {/* Session History */}
                {showHistory && (
                    <SessionHistoryTable sessions={sessionHistory} />
                )}
            </CardContent>
        </Card>
    )
}
