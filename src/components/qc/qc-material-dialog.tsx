'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { QCMaterialForm } from './qc-material-form'
import type { QCMaterial } from './qc-materials-table'

interface QCMaterialDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    mode: 'create' | 'edit'
    material?: QCMaterial
}

export function QCMaterialDialog({
    open,
    onOpenChange,
    mode,
    material,
}: QCMaterialDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>
                        {mode === 'create' ? 'Thêm vật liệu QC mới' : 'Sửa vật liệu QC'}
                    </DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Thêm vật liệu kiểm soát chất lượng mới vào hệ thống.'
                            : 'Cập nhật thông tin vật liệu kiểm soát chất lượng.'}
                    </DialogDescription>
                </DialogHeader>
                <QCMaterialForm
                    material={material}
                    onSuccess={() => {
                        onOpenChange(false)
                        window.location.reload()
                    }}
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    )
}
