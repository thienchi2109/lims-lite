'use client'

import { useState, useEffect } from 'react'
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
import { Loader2, Play, Plus } from 'lucide-react'
import { toast } from 'sonner'

interface AssayOption {
    id: string
    name: string
}

interface StartSessionDialogProps {
    /** Pre-selected assay ID (optional - if not provided, user can select) */
    selectedAssayId?: string
    /** List of assays for selection (required if selectedAssayId is not provided) */
    assays?: AssayOption[]
    /** Callback when session is successfully started */
    onSuccess?: () => void
    /** Custom trigger button */
    trigger?: React.ReactNode
}

export function StartSessionDialog({
    selectedAssayId,
    assays = [],
    onSuccess,
    trigger,
}: StartSessionDialogProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [chosenAssayId, setChosenAssayId] = useState(selectedAssayId || '')

    const form = useForm<CreateQCSession>({
        resolver: zodResolver(CreateQCSessionSchema),
        defaultValues: {
            assay_id: selectedAssayId || '',
            session_mode: 'daily',
            notes: '',
        },
    })

    // Update form when selectedAssayId changes
    useEffect(() => {
        if (selectedAssayId) {
            setChosenAssayId(selectedAssayId)
            form.setValue('assay_id', selectedAssayId)
        }
    }, [selectedAssayId, form])

    // Update form when chosenAssayId changes
    useEffect(() => {
        if (chosenAssayId) {
            form.setValue('assay_id', chosenAssayId)
        }
    }, [chosenAssayId, form])

    const handleSubmit = async (data: CreateQCSession) => {
        const assayId = chosenAssayId || selectedAssayId
        if (!assayId) {
            toast.error('Vui lòng chọn xét nghiệm')
            return
        }

        setIsSubmitting(true)
        try {
            const result = await startQCSession({
                ...data,
                assay_id: assayId,
            })

            if ('error' in result) {
                toast.error(result.error)
                return
            }

            toast.success('Đã bắt đầu phiên QC mới')
            setIsOpen(false)
            form.reset()
            setChosenAssayId(selectedAssayId || '')
            onSuccess?.()
        } catch (error) {
            toast.error('Không thể bắt đầu phiên QC')
            console.error('Start session error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const showAssaySelect = !selectedAssayId && assays.length > 0

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                {trigger || (
                    <Button>
                        {showAssaySelect ? (
                            <Plus className="mr-2 h-4 w-4" />
                        ) : (
                            <Play className="mr-2 h-4 w-4" />
                        )}
                        Bắt đầu phiên QC
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bắt đầu phiên QC mới</DialogTitle>
                    <DialogDescription>
                        {showAssaySelect
                            ? 'Chọn xét nghiệm, chế độ phiên và thêm ghi chú nếu cần.'
                            : 'Chọn chế độ phiên và thêm ghi chú nếu cần.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={form.handleSubmit(handleSubmit)}>
                    <div className="space-y-4 py-4">
                        {showAssaySelect && (
                            <div className="space-y-2">
                                <Label htmlFor="assay_id">Xét nghiệm</Label>
                                <Select
                                    value={chosenAssayId}
                                    onValueChange={setChosenAssayId}
                                >
                                    <SelectTrigger id="assay_id">
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
                        )}

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
                        <Button
                            type="submit"
                            disabled={isSubmitting || (showAssaySelect && !chosenAssayId)}
                        >
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
