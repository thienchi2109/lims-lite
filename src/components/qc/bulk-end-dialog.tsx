'use client'

import { useState } from 'react'
import { bulkEndQCSessions, type BulkEndResult } from '@/app/actions/qc-bulk-operations'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { AlertCircle, CheckCircle2, Loader2, Square } from 'lucide-react'
import { toast } from 'sonner'

interface SessionInfo {
    id: string
    assay_name: string
}

interface BulkEndSessionDialogProps {
    sessions: SessionInfo[]
    onSuccess?: () => void
    onClear?: () => void
    trigger?: React.ReactNode
}

export function BulkEndSessionDialog({
    sessions,
    onSuccess,
    onClear,
    trigger,
}: BulkEndSessionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [notes, setNotes] = useState('')
    const [result, setResult] = useState<BulkEndResult | null>(null)

    const handleSubmit = async () => {
        if (sessions.length === 0) {
            toast.error('Không có phiên nào được chọn')
            return
        }

        setIsSubmitting(true)
        setResult(null)

        try {
            const response = await bulkEndQCSessions({
                session_ids: sessions.map(s => s.id),
                notes: notes || undefined,
            })

            if ('error' in response && response.error) {
                toast.error(response.error)
                return
            }

            if (response.data) {
                setResult(response.data)
                const { success, failed } = response.data

                if (success.length > 0 && failed.length === 0) {
                    toast.success(`Đã kết thúc ${success.length} phiên QC`)
                    handleClose()
                    onSuccess?.()
                } else if (success.length > 0 && failed.length > 0) {
                    toast.warning(`${success.length} thành công, ${failed.length} thất bại`)
                } else {
                    toast.error(`Không thể kết thúc ${failed.length} phiên`)
                }
            }
        } catch (error) {
            toast.error('Không thể kết thúc các phiên QC')
            console.error('Bulk end error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleClose = () => {
        setIsOpen(false)
        setNotes('')
        setResult(null)
        onClear?.()
    }

    // Build session name lookup from props
    const sessionNameMap = new Map(sessions.map(s => [s.id, s.assay_name]))

    return (
        <Dialog open={isOpen} onOpenChange={open => open ? setIsOpen(true) : handleClose()}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button variant="outline" disabled={sessions.length === 0}>
                        <Square className="mr-2 h-4 w-4" />
                        Kết thúc {sessions.length} phiên
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Kết thúc nhiều phiên QC</DialogTitle>
                    <DialogDescription>
                        Xác nhận kết thúc {sessions.length} phiên QC đã chọn.
                    </DialogDescription>
                </DialogHeader>

                {result ? (
                    <ResultSummary
                        result={result}
                        sessionNameMap={sessionNameMap}
                        onClose={handleClose}
                        onSuccess={onSuccess}
                    />
                ) : (
                    <>
                        <div className="space-y-4 py-2">
                            {/* Selected Sessions */}
                            <div className="space-y-2">
                                <Label>Phiên đã chọn ({sessions.length})</Label>
                                <ScrollArea className="h-32 rounded-md border p-2">
                                    <div className="space-y-1">
                                        {sessions.map(session => (
                                            <p key={session.id} className="text-sm py-0.5">
                                                {session.assay_name}
                                            </p>
                                        ))}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <Label>Ghi chú (tùy chọn)</Label>
                                <Textarea
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    placeholder="Ghi chú kết thúc phiên..."
                                    rows={2}
                                />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button variant="outline" onClick={handleClose}>
                                Hủy
                            </Button>
                            <Button
                                onClick={handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    `Kết thúc ${sessions.length} phiên`
                                )}
                            </Button>
                        </DialogFooter>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}

function ResultSummary({
    result,
    sessionNameMap,
    onClose,
    onSuccess,
}: {
    result: BulkEndResult
    sessionNameMap: Map<string, string>
    onClose: () => void
    onSuccess?: () => void
}) {
    const handleDone = () => {
        onClose()
        onSuccess?.()
    }

    return (
        <div className="space-y-4 py-2">
            {result.success.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="font-medium">Đã kết thúc ({result.success.length})</span>
                    </div>
                    <ScrollArea className="h-24 rounded-md border p-2">
                        {result.success.map(s => (
                            <p key={s.session_id} className="text-sm py-0.5">
                                {sessionNameMap.get(s.session_id) || s.session_id}
                            </p>
                        ))}
                    </ScrollArea>
                </div>
            )}

            {result.failed.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4" />
                        <span className="font-medium">Thất bại ({result.failed.length})</span>
                    </div>
                    <ScrollArea className="h-24 rounded-md border p-2">
                        {result.failed.map(f => (
                            <p key={f.session_id} className="text-sm py-0.5">
                                {sessionNameMap.get(f.session_id) || f.session_id}: {f.error}
                            </p>
                        ))}
                    </ScrollArea>
                </div>
            )}

            <DialogFooter>
                <Button onClick={handleDone}>Hoàn tất</Button>
            </DialogFooter>
        </div>
    )
}
