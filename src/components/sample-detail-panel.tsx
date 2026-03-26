'use client'

import type { SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { SampleLifecycleChevron } from '@/components/sample-lifecycle-stepper'
import { useClient } from '@/hooks/use-client'
import {
    FileText,
    AlertCircle,
    Activity,
    Loader2,
    Pencil,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { SampleActivityFeed } from '@/components/sample-activity-feed'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys, clientKeys } from '@/types/query-keys'
import { cn } from '@/lib/utils'

interface SampleDetailPanelProps {
    sample: SampleWithUser | null
}

export function SampleDetailPanel({ sample }: SampleDetailPanelProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')
    const queryClient = useQueryClient()

    const {
        data: client,
        isLoading: isClientLoading,
        error: clientError,
    } = useClient({ clientId: sample?.client_id ?? null })

    if (!sample) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 border rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Chọn một mẫu để xem chi tiết</p>
            </div>
        )
    }

    const handleEditSuccess = () => {
        queryClient.invalidateQueries({ queryKey: sampleKeys.all })
        if (sample.client_id) {
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(sample.client_id) })
        }
    }

    const displayedClientName = client?.name || sample.client_name || 'N/A'

    return (
        <div id="tour-sample-detail" className="h-full min-h-0 flex flex-col overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-slate-950">
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-slate-50/50 px-2.5 py-1 dark:bg-slate-900/50">
                <div className="flex items-center gap-1.5 overflow-hidden">
                    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 dark:bg-sky-900/20 dark:text-sky-400">
                        <FileText className="h-3 w-3" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="truncate font-mono text-xs font-semibold text-slate-900 dark:text-slate-100">
                            {sample.sample_id}
                        </h3>
                        <p className="truncate text-[11px] text-muted-foreground">
                            Chi tiết mẫu
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    <SampleLifecycleChevron status={sample.status} className="hidden sm:flex" />
                    {['received', 'assigned'].includes(sample.status) && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditDialogOpen(true)}
                            title="Chỉnh sửa thông tin"
                            className="h-7 w-7 text-slate-500 hover:text-sky-600 hover:bg-sky-50"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                <button
                    onClick={() => setActiveTab('details')}
                    className={cn(
                        "relative flex-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                        activeTab === 'details'
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                >
                    <div className="flex items-center justify-center gap-1">
                        <FileText className="h-3 w-3" />
                        <span>Thông tin</span>
                    </div>
                    {activeTab === 'details' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 dark:bg-sky-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={cn(
                        "relative flex-1 px-2.5 py-1 text-[11px] font-medium transition-colors",
                        activeTab === 'activity'
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                >
                    <div className="flex items-center justify-center gap-1">
                        <Activity className="h-3 w-3" />
                        <span>Lịch sử cập nhật</span>
                    </div>
                    {activeTab === 'activity' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 dark:bg-sky-400" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {activeTab === 'details' ? (
                    <div className="p-2.5 text-xs space-y-2.5">
                        {/* Rejection Alert */}
                        {sample.rejection_reason && ['in_progress', 'discarded'].includes(sample.status) && (
                            <div className={`rounded-md border p-2.5 ${sample.status === 'discarded'
                                ? 'bg-red-50 border-red-200 text-red-800 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300'
                                : 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-900/20 dark:border-orange-800 dark:text-orange-300'
                                }`}>
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                    <div className="flex-1 text-xs">
                                        <h4 className="mb-0.5 font-semibold">
                                            {sample.status === 'discarded' ? 'Mẫu đã bị loại bỏ' : 'Mẫu đã bị từ chối'}
                                        </h4>
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
                        )}

                        {/* Client Info Section */}
                        <div>
                            <h4 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                                Thông tin bệnh nhân
                            </h4>
                            {sample.client_id ? (
                                <div className="rounded-md bg-slate-50/60 dark:bg-slate-900/30 p-2">
                                    {isClientLoading && (
                                        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Đang tải...
                                        </div>
                                    )}
                                    {!isClientLoading && clientError && (
                                        <div className="text-[11px] text-red-600 dark:text-red-400 py-1">
                                            {clientError.message}
                                        </div>
                                    )}
                                    {client && (
                                        <>
                                            <InfoRow label="Họ tên" value={displayedClientName} bold />
                                            <InfoRow label="Số CCCD" value={client.id_card_num} />
                                            <InfoRow label="Ngày sinh" value={formatDateOnly(client.date_of_birth)} />
                                            <InfoRow label="Giới tính" value={client.gender} />
                                            <InfoRow label="Điện thoại" value={client.phone} />
                                            <InfoRow label="Địa chỉ" value={client.address || 'N/A'} />
                                            <InfoRow label="Mã BHYT" value={client.health_insurance_num || 'N/A'} />
                                            <InfoRow label="Hạn BHYT" value={client.expiry_date ? formatDateOnly(client.expiry_date) : 'N/A'} />
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-[11px] text-muted-foreground">
                                    Mẫu chưa được liên kết với khách hàng
                                </div>
                            )}
                        </div>

                        {/* Reception Metadata Footer */}
                        <div className="border-t border-slate-100 dark:border-slate-800 pt-2">
                            <InfoRow label="Thời điểm nhận" value={formatDate(sample.received_at)} />
                            <InfoRow label="Người nhận mẫu" value={sample.received_by_name || 'N/A'} />
                            <InfoRow label="Cập nhật cuối" value={formatDate(sample.updated_at)} muted />
                        </div>
                    </div>
                ) : (
                    <div className="p-1.5">
                        <SampleActivityFeed sampleId={sample.id} />
                    </div>
                )}
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

function InfoRow({
    label,
    value,
    bold,
    muted,
}: {
    label: string
    value: string
    bold?: boolean
    muted?: boolean
}) {
    return (
        <div className="flex items-baseline justify-between py-0.5">
            <span className="text-[11px] text-slate-400 shrink-0 mr-3">{label}</span>
            <span className={cn(
                "text-xs text-right truncate",
                bold && "font-medium text-slate-900 dark:text-slate-100",
                muted && "text-muted-foreground",
                !bold && !muted && "text-slate-700 dark:text-slate-300",
            )}>{value}</span>
        </div>
    )
}

function formatDateOnly(dateString: string): string {
    if (!dateString) return ''
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).format(date)
}
