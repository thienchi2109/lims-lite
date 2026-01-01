'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CreateQCSessionSchema, type CreateQCSession } from '@/types/qc'
import { startQCSession } from '@/app/actions/qc-operations'
import { Button } from '@/components/ui/button'
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
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Loader2, Play } from 'lucide-react'
import { toast } from 'sonner'

interface StartSessionDialogProps {
    selectedAssayId: string
    onSuccess?: () => void
}

export function StartSessionDialog({
    selectedAssayId,
    onSuccess,
}: StartSessionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const form = useForm<CreateQCSession>({
        resolver: zodResolver(CreateQCSessionSchema),
        defaultValues: {
            assay_id: selectedAssayId,
            session_mode: 'daily',
            notes: '',
        },
    })

    const handleSubmit = async (data: CreateQCSession) => {
        setIsSubmitting(true)
        try {
            const result = await startQCSession({
                ...data,
                assay_id: selectedAssayId,
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã bắt đầu phiên QC mới')
            setIsOpen(false)
            form.reset()
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể bắt đầu phiên QC')
            console.error('Start session error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
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
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="session_mode">Chế độ phiên</Label>
                            <Select
                                value={form.watch('session_mode')}
                                onValueChange={(val) => form.setValue('session_mode', val as CreateQCSession['session_mode'])}
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
                                {...form.register('notes')}
                                placeholder="Ghi chú khi bắt đầu phiên..."
                                rows={2}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsOpen(false)}
                        >
                            Hủy
                        </Button>
                        <Button type="submit" disabled={isSubmitting}>
                            {isSubmitting ? (
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
    )
}
