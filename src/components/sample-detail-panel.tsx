'use client'

import { SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import {
    FileText,
    Calendar,
    User,
    Hash,
    Building2,
    Clock,
    Pencil
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
            <div className="px-6 py-4 border-b bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                        <FileText className="h-4 w-4" />
                    </div>
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            Chi tiết mẫu
                        </h3>
                        <p className="text-xs text-muted-foreground">
                            {sample.sample_id}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <SampleStatusBadge status={sample.status} />
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setEditDialogOpen(true)}
                        title="Chỉnh sửa thông tin"
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-1 gap-6">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <Hash className="h-3.5 w-3.5" />
                            Mã mẫu
                        </div>
                        <div className="font-mono font-medium text-base pl-6">{sample.sample_id}</div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <Building2 className="h-3.5 w-3.5" />
                            Khách hàng
                        </div>
                        <div className="font-medium pl-6">{sample.client_name || 'N/A'}</div>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                <Calendar className="h-3.5 w-3.5" />
                                Ngày nhận
                            </div>
                            <div className="pl-6 text-sm">{formatDate(sample.received_at)}</div>
                        </div>

                        <div className="space-y-1">
                            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                                <User className="h-3.5 w-3.5" />
                                Người nhận
                            </div>
                            <div className="pl-6 text-sm">{sample.received_by_name || 'N/A'}</div>
                        </div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <Clock className="h-3.5 w-3.5" />
                            Cập nhật cuối
                        </div>
                        <div className="pl-6 text-sm text-muted-foreground">{formatDate(sample.updated_at)}</div>
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
