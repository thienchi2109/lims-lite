'use client'

import { useState } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { invalidateSampleQueries, approvalKeys, rejectionKeys } from '@/types/query-keys'
import { discardSampleClient } from '@/lib/api-client'
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface DiscardSampleDialogProps {
    sampleId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function DiscardSampleDialog({ sampleId, open, onOpenChange }: DiscardSampleDialogProps) {
    const router = useRouter()
    const searchParams = useSearchParams()
    const pathname = usePathname()
    const queryClient = useQueryClient()
    const [reason, setReason] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const handleDiscard = async () => {
        if (!reason.trim()) {
            toast.error('Vui lòng nhập lý do loại bỏ')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await discardSampleClient({ sampleId, reason })
            if (result.error) {
                toast.error(result.error)
            } else {
                toast.success('Đã loại bỏ mẫu')

                // Update URL params to sort by updated_at DESC and navigate to page 1
                const params = new URLSearchParams(searchParams?.toString() ?? '')
                params.set('sortBy', 'updated_at')
                params.set('sortOrder', 'desc')
                params.set('sampleId', sampleId)
                params.set('page', '1')
                router.push(`${pathname}?${params.toString()}`)

                // Invalidate queries to trigger refetch
                await invalidateSampleQueries(queryClient, sampleId)
                queryClient.invalidateQueries({ queryKey: approvalKeys.count })
                queryClient.invalidateQueries({ queryKey: rejectionKeys.count })

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
                    <DialogTitle>Loại bỏ mẫu</DialogTitle>
                    <DialogDescription>
                        Mẫu sẽ chuyển sang trạng thái "Loại bỏ" và không thể tiếp tục xử lý. Hành động này không thể hoàn tác.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                        Lý do loại bỏ <span className="text-red-500">*</span>
                    </label>
                    <Textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Nhập lý do loại bỏ..."
                        rows={4}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Hủy
                    </Button>
                    <Button variant="destructive" onClick={handleDiscard} disabled={isSubmitting}>
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Đang xử lý...
                            </>
                        ) : (
                            'Xác nhận loại bỏ'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
