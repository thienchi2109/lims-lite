'use client'

import { CreateClient, type Client } from '@/types'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { ClientForm } from '@/components/client-form'

interface ClientFormDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    initialData?: Partial<CreateClient>
    onSuccess: (client: Client) => void
}

export function ClientFormDialog({
    open,
    onOpenChange,
    initialData,
    onSuccess
}: ClientFormDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-950 rounded-xl shadow-2xl border-0">
                <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                        {initialData?.name ? 'Cập nhật thông tin khách hàng' : 'Thêm khách hàng mới'}
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Nhập thông tin khách hàng. Các trường có dấu * là bắt buộc.
                    </DialogDescription>
                </DialogHeader>

                <ClientForm
                    initialData={initialData}
                    onSuccess={(client) => {
                        onSuccess(client)
                        onOpenChange(false)
                    }}
                    onCancel={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    )
}

