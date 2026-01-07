'use client'

import { useTransition } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteQCMaterial } from '@/app/actions/qc-setup'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'
import type { QCMaterial } from './qc-materials-table'

interface DeleteQCMaterialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    material: QCMaterial
}

export function DeleteQCMaterialDialog({
    open,
    onOpenChange,
    material,
}: DeleteQCMaterialDialogProps) {
    const [isPending, startTransition] = useTransition()

    const handleDelete = () => {
        startTransition(async () => {
            try {
                const result = await deleteQCMaterial(material.id)

                if ('error' in result) {
                    toast.error(result.error)
                    return
                }

                toast.success('Đã xóa vật liệu QC')
                onOpenChange(false)
                window.location.reload()
            } catch (error) {
                toast.error('Đã xảy ra lỗi không mong muốn')
            }
        })
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
                            <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-500" />
                        </div>
                        <div>
                            <DialogTitle>Xác nhận xóa vật liệu QC</DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="pt-4">
                        Bạn có chắc chắn muốn xóa vật liệu{' '}
                        <strong>{material.name}</strong> (Lô: {material.lot_number})?
                        <br />
                        <br />
                        <span className="text-red-600 dark:text-red-500">
                            Lưu ý: Không thể xóa vật liệu đang được sử dụng trong giới hạn kiểm soát (QC Definitions).
                        </span>
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => onOpenChange(false)}
                        disabled={isPending}
                    >
                        Hủy
                    </Button>
                    <Button
                        type="button"
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Xóa
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
