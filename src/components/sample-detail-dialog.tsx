'use client'

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { SampleStatusBadge } from '@/components/sample-status-badge'

interface SampleDetailDialogProps {
    sample: SampleWithUser
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function SampleDetailDialog({
    sample,
    open,
    onOpenChange,
}: SampleDetailDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Chi tiết mẫu</DialogTitle>
                    <DialogDescription>
                        Thông tin chi tiết về mẫu {sample.sample_id}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Mã mẫu:</span>
                        <span className="col-span-3 font-mono">{sample.sample_id}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Khách hàng:</span>
                        <span className="col-span-3">{sample.client_name || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Trạng thái:</span>
                        <div className="col-span-3">
                            <SampleStatusBadge status={sample.status} />
                        </div>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Ngày nhận:</span>
                        <span className="col-span-3">{formatDate(sample.received_at)}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Người nhận:</span>
                        <span className="col-span-3">{sample.received_by_name || 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Ngày tạo:</span>
                        <span className="col-span-3">{formatDate(sample.created_at)}</span>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <span className="font-medium">Cập nhật cuối:</span>
                        <span className="col-span-3">{formatDate(sample.updated_at)}</span>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
