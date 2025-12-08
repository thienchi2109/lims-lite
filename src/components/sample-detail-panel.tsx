'use client'

import { SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import {
    FileText,
    Calendar,
    User,
    Building2,
    Clock,
    Pencil,
    AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys } from '@/types/query-keys'

interface SampleDetailPanelProps {
    sample: SampleWithUser | null
}

export function SampleDetailPanel({ sample }: SampleDetailPanelProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const queryClient = useQueryClient()

    if (!sample) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Chọn một mẫu để xem chi tiết</p>
            </div>
        )
    }

    const handleEditSuccess = () => {
        // Invalidate sample queries to refetch fresh data
        queryClient.invalidateQueries({ queryKey: sampleKeys.all })
    }

    return (
        <div className="h-full flex flex-col bg-white dark:bg-slate-950 border rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-2 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="h-8 w-8 rounded-full bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate font-mono">
                            {sample.sample_id}
                        </h3>
                        <p className="text-xs text-muted-foreground truncate">
                            Chi tiết mẫu
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <SampleStatusBadge status={sample.status} />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditDialogOpen(true)}
                        title="Chỉnh sửa thông tin"
                        className="h-8 w-8 text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
                {sample.rejection_reason && (
                    <div className={`mb-4 p-3 rounded-md border ${sample.status === 'discarded'
                        ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                        : 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300'
                        }`}>
                        <div className="flex items-start gap-3">
                            <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                            <div className="flex-1 text-sm">
                                <h4 className="font-semibold mb-1">
                                    {sample.status === 'discarded' ? 'Mẫu đã bị loại bỏ' : 'Mẫu đã bị từ chối'}
                                </h4>
                                <div className="space-y-1 opacity-90">
                                    <p><span className="font-medium">Lý do:</span> {sample.rejection_reason}</p>
                                    {sample.rejected_at && (
                                        <p><span className="font-medium">Thời gian:</span> {new Date(sample.rejected_at).toLocaleString('vi-VN')}</p>
                                    )}
                                    {sample.rejected_by_name && (
                                        <p><span className="font-medium">Người thực hiện:</span> {sample.rejected_by_name}</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <Building2 className="h-3.5 w-3.5" />
                            Khách hàng
                        </div>
                        <div className="font-medium text-sm truncate" title={sample.client_name || ''}>
                            {sample.client_name || 'N/A'}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <Calendar className="h-3.5 w-3.5" />
                            Ngày nhận
                        </div>
                        <div className="text-sm">
                            {formatDate(sample.received_at)}
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                            <User className="h-3.5 w-3.5" />
                            Người nhận
                        </div>
                        <div className="text-sm truncate" title={sample.received_by_name || ''}>
                            {sample.received_by_name || 'N/A'}
                        </div>
                    </div>

                    <div className="col-span-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>Cập nhật: {formatDate(sample.updated_at)}</span>
                        </div>
                    </div>
                </div>
            </div>

            <SampleEditDialog
                sample={sample}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
                onSuccess={handleEditSuccess}
            />
        </div>
    )
}
