'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteAssayDefinitionClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { Loader2, AlertTriangle } from 'lucide-react'

type AssayDefinition = {
    id: string
    name: string
}

type Props = {
    open: boolean
    onOpenChange: (open: boolean) => void
    assay: AssayDefinition
    onDeleted?: (id: string) => void
}

export function DeleteAssayDialog({ open, onOpenChange, assay, onDeleted }: Props) {
    const [isPending, startTransition] = useTransition()
    const router = useRouter()

    const handleDelete = () => {
        startTransition(async () => {
            try {
                await deleteAssayDefinitionClient(assay.id)
                onDeleted?.(assay.id)
                toast.success('Đã xóa chỉ tiêu xét nghiệm thành công')
                onOpenChange(false)
                router.refresh()
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Đã xảy ra lỗi không mong muốn'
                toast.error(message)
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
                            <DialogTitle>Xác nhận xóa chỉ tiêu</DialogTitle>
                        </div>
                    </div>
                    <DialogDescription className="pt-4">
                        Bạn có chắc chắn muốn xóa chỉ tiêu <strong>{assay.name}</strong>?
                        <br />
                        <br />
                        <span className="text-red-600 dark:text-red-500">
                            Lưu ý: Không thể xóa chỉ tiêu đang được sử dụng trong kết quả xét nghiệm.
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
