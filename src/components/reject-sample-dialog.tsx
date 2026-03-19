'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateSampleQueries, approvalKeys, rejectionKeys } from '@/types/query-keys'
import { rejectSampleClient } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface RejectSampleDialogProps {
    sampleId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RejectSampleDialog({ sampleId, open, onOpenChange }: RejectSampleDialogProps) {
    const router = useRouter()
    const queryClient = useQueryClient()
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleReject = async () => {
        if (!reason.trim()) {
            toast.error('Vui lòng nhập lý do từ chối')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await rejectSampleClient({ sampleId, reason })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã từ chối mẫu')

                // Invalidate queries
                await invalidateSampleQueries(queryClient, sampleId)
                queryClient.invalidateQueries({ queryKey: approvalKeys.count })
                queryClient.invalidateQueries({ queryKey: rejectionKeys.count })

                router.refresh()
                onOpenChange(false)
                setReason('')
            }
        } catch (error) {
            toast.error('Có lỗi xảy ra')
            console.error(error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Từ chối mẫu</DialogTitle>
                    <DialogDescription>
                        Mẫu sẽ được trả lại trạng thái "Đang thực hiện" để Analyst chỉnh sửa.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                        Lý do từ chối <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Nhập lý do từ chối..."
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Hủy
                    </Button>
                    <Button variant="destructive" onClick={handleReject} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            'Từ chối mẫu'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
