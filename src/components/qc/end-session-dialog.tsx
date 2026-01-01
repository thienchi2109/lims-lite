'use client'

import { useState } from 'react'
import { endQCSession } from '@/app/actions/qc-operations'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Square } from 'lucide-react'
import { toast } from 'sonner'

interface EndSessionDialogProps {
    sessionId: string
    onSuccess?: () => void
}

export function EndSessionDialog({
    sessionId,
    onSuccess,
}: EndSessionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [notes, setNotes] = useState('')

    const handleEndSession = async () => {
        setIsSubmitting(true)
        try {
            const result = await endQCSession(sessionId, notes || undefined)

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã kết thúc phiên QC')
            setIsOpen(false)
            setNotes('')
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể kết thúc phiên QC')
            console.error('End session error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Ghi chú khi kết thúc phiên..."
                            rows={3}
                        />
                    </div>
                </div>
                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => setIsOpen(false)}
                    >
                        Hủy
                    </Button>
                    <Button
                        onClick={handleEndSession}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? (
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
    )
}
