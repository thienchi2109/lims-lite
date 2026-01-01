'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
    QCSessionMode,
    QCStatus,
    type QCSession,
    CreateQCSessionSchema,
    type CreateQCSession,
} from '@/types/qc'
import {
    startQCSession,
    endQCSession,
} from '@/app/actions/qc-operations'
import { getQCSessions } from '@/app/actions/qc-violations'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
    Loader2,
    Play,
    Square,
    Clock,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    History,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { vi } from 'date-fns/locale'

// Session mode labels in Vietnamese
const SESSION_MODE_LABELS: Record<string, string> = {
    daily: 'Hàng ngày',
    batch: 'Theo lô',
    shift: 'Theo ca',
}

// Status configuration
const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className?: string }> = {
    pending: { icon: Clock, label: 'Chờ QC', variant: 'outline', className: '' },
    pass: { icon: CheckCircle2, label: 'Đạt', variant: 'default', className: 'bg-green-600' },
    warning: { icon: AlertTriangle, label: 'Cảnh báo', variant: 'secondary', className: 'bg-yellow-500 text-black' },
    blocked: { icon: XCircle, label: 'Bị chặn', variant: 'destructive', className: '' },
    resolved: { icon: CheckCircle2, label: 'Đã xử lý', variant: 'outline', className: 'border-green-600 text-green-600' },
}

interface AssayOption {
    id: string
    name: string
}

interface SessionWithDetails {
    id: string
    assay_id: string
    session_mode: string
    qc_status: string
    started_at: string
    started_by: string
    ended_at: string | null
    notes: string | null
    assay?: { id: string; name: string }
    started_by_user?: { full_name: string }
    ended_by_user?: { full_name: string } | null
}

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
    const [isStarting, setIsStarting] = useState(false)
    const [isEnding, setIsEnding] = useState(false)
    const [showStartDialog, setShowStartDialog] = useState(false)
    const [showEndDialog, setShowEndDialog] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [endNotes, setEndNotes] = useState('')

    // Form for starting session
    const startForm = useForm<CreateQCSession>({
        resolver: zodResolver(CreateQCSessionSchema),
        defaultValues: {
            assay_id: selectedAssayId || '',
            session_mode: 'daily',
            notes: '',
        },
    })

    // Handle start session
    const handleStartSession = async (data: CreateQCSession) => {
        setIsStarting(true)
        try {
            const result = await startQCSession(data)

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã bắt đầu phiên QC mới')
            setShowStartDialog(false)
            startForm.reset()
            onSessionChange?.()
        } catch (error) {
            toast.error('Không thể bắt đầu phiên QC')
            console.error('Start session error:', error)
        } finally {
            setIsStarting(false)
        }
    }

    // Handle end session
    const handleEndSession = async () => {
        if (!activeSession) return

        setIsEnding(true)
        try {
            const result = await endQCSession(activeSession.id, endNotes || undefined)

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã kết thúc phiên QC')
            setShowEndDialog(false)
            setEndNotes('')
            onSessionChange?.()
        } catch (error) {
            toast.error('Không thể kết thúc phiên QC')
            console.error('End session error:', error)
        } finally {
            setIsEnding(false)
        }
    }

    // Status badge component
    const StatusBadge = ({ status }: { status: string }) => {
        const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending
        const Icon = config.icon

        return (
            <Badge variant={config.variant} className={`gap-1 ${config.className || ''}`}>
                <Icon className="h-3 w-3" />
                {config.label}
            </Badge>
        )
    }

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
                                <span className="ml-2">{SESSION_MODE_LABELS[activeSession.session_mode] || activeSession.session_mode}</span>
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

                        {/* End Session Button */}
                        <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
                            <DialogTrigger asChild>
                                <Button variant="outline" className="w-full">
                                    <Square className="mr-2 h-4 w-4" />
                                    Kết thúc phiên
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Kết thúc phiên QC</DialogTitle>
                                    <DialogDescription>
                                        Xác nhận kết thúc phiên QC hiện tại. Bạn có thể thêm ghi chú.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="end-notes">Ghi chú (tùy chọn)</Label>
                                        <Textarea
                                            id="end-notes"
                                            value={endNotes}
                                            onChange={(e) => setEndNotes(e.target.value)}
                                            placeholder="Ghi chú khi kết thúc phiên..."
                                            rows={3}
                                        />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button
                                        variant="outline"
                                        onClick={() => setShowEndDialog(false)}
                                    >
                                        Hủy
                                    </Button>
                                    <Button
                                        onClick={handleEndSession}
                                        disabled={isEnding}
                                    >
                                        {isEnding ? (
                                            <>
                                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                Đang xử lý...
                                            </>
                                        ) : (
                                            'Kết thúc phiên'
                                        )}
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </div>
                ) : selectedAssayId ? (
                    <div className="rounded-lg border border-dashed p-4 text-center space-y-3">
                        <p className="text-muted-foreground">Không có phiên QC đang hoạt động</p>

                        {/* Start Session Dialog */}
                        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
                            <DialogTrigger asChild>
                                <Button>
                                    <Play className="mr-2 h-4 w-4" />
                                    Bắt đầu phiên QC
                                </Button>
                            </DialogTrigger>
                            <DialogContent>
                                <DialogHeader>
                                    <DialogTitle>Bắt đầu phiên QC mới</DialogTitle>
                                    <DialogDescription>
                                        Chọn chế độ phiên và thêm ghi chú nếu cần.
                                    </DialogDescription>
                                </DialogHeader>
                                <form onSubmit={startForm.handleSubmit(handleStartSession)}>
                                    <div className="space-y-4 py-4">
                                        <input
                                            type="hidden"
                                            {...startForm.register('assay_id')}
                                            value={selectedAssayId}
                                        />

                                        <div className="space-y-2">
                                            <Label htmlFor="session_mode">Chế độ phiên</Label>
                                            <Select
                                                value={startForm.watch('session_mode')}
                                                onValueChange={(val) => startForm.setValue('session_mode', val as any)}
                                            >
                                                <SelectTrigger id="session_mode">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="daily">
                                                        Hàng ngày - Một phiên mỗi ngày
                                                    </SelectItem>
                                                    <SelectItem value="batch">
                                                        Theo lô - Một phiên mỗi lô mẫu
                                                    </SelectItem>
                                                    <SelectItem value="shift">
                                                        Theo ca - Một phiên mỗi ca làm việc
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="start-notes">Ghi chú (tùy chọn)</Label>
                                            <Textarea
                                                id="start-notes"
                                                {...startForm.register('notes')}
                                                placeholder="Ghi chú khi bắt đầu phiên..."
                                                rows={2}
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setShowStartDialog(false)}
                                        >
                                            Hủy
                                        </Button>
                                        <Button type="submit" disabled={isStarting}>
                                            {isStarting ? (
                                                <>
                                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                                    Đang xử lý...
                                                </>
                                            ) : (
                                                'Bắt đầu phiên'
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </form>
                            </DialogContent>
                        </Dialog>
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-4">
                        Chọn xét nghiệm để quản lý phiên QC
                    </p>
                )}

                {/* Session History */}
                {showHistory && sessionHistory.length > 0 && (
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
                                    {sessionHistory.slice(0, 10).map((session) => (
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
                )}

                {showHistory && sessionHistory.length === 0 && (
                    <p className="text-center text-muted-foreground py-2">
                        Chưa có lịch sử phiên
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
