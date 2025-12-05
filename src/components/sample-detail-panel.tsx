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
    Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { useRouter } from 'next/navigation'

interface SampleDetailPanelProps {
    sample: SampleWithUser | null
}

export function SampleDetailPanel({ sample }: SampleDetailPanelProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const router = useRouter()

    if (!sample) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Chọn một mẫu để xem chi tiết</p>
            </div>
        )
    }

    const handleEditSuccess = () => {
        router.refresh()
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
