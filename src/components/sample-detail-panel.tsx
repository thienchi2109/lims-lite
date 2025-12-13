'use client'

import type { Client, SampleWithUser } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { SampleStatusBadge } from '@/components/sample-status-badge'
import { getClientClient } from '@/lib/api-client'
import {
    FileText,
    Calendar,
    User,
    Building2,
    Clock,
    Pencil,
    AlertCircle,
    Activity,
    Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useEffect, useState } from 'react'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { SampleActivityFeed } from '@/components/sample-activity-feed'
import { useQueryClient } from '@tanstack/react-query'
import { sampleKeys } from '@/types/query-keys'
import { cn } from '@/lib/utils'

interface SampleDetailPanelProps {
    sample: SampleWithUser | null
}

export function SampleDetailPanel({ sample }: SampleDetailPanelProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')
    const [client, setClient] = useState<Client | null>(null)
    const [isClientLoading, setIsClientLoading] = useState(false)
    const [clientLoadError, setClientLoadError] = useState<string | null>(null)
    const queryClient = useQueryClient()

    useEffect(() => {
        setClient(null)
        setClientLoadError(null)

        if (!sample?.client_id) return

        let cancelled = false

        const run = async () => {
            setIsClientLoading(true)
            try {
                const result = await getClientClient(sample.client_id as string)
                if (cancelled) return

                if ('data' in result && result.data) {
                    setClient(result.data as Client)
                    return
                }

                setClientLoadError('Không thể tải thông tin khách hàng')
            } catch (error) {
                if (cancelled) return
                setClientLoadError(
                    error instanceof Error ? error.message : 'Không thể tải thông tin khách hàng'
                )
            } finally {
                if (!cancelled) setIsClientLoading(false)
            }
        }

        run()

        return () => {
            cancelled = true
        }
    }, [sample?.client_id])

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

    const displayedClientName = client?.name || sample.client_name || 'N/A'

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

            {/* Tab Navigation */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/30">
                <button
                    onClick={() => setActiveTab('details')}
                    className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium transition-colors relative",
                        activeTab === 'details'
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span>Thông tin</span>
                    </div>
                    {activeTab === 'details' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 dark:bg-sky-400" />
                    )}
                </button>
                <button
                    onClick={() => setActiveTab('activity')}
                    className={cn(
                        "flex-1 px-4 py-2 text-sm font-medium transition-colors relative",
                        activeTab === 'activity'
                            ? "text-sky-600 dark:text-sky-400"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
                    )}
                >
                    <div className="flex items-center justify-center gap-2">
                        <Activity className="h-4 w-4" />
                        <span>Lịch sử cập nhật</span>
                    </div>
                    {activeTab === 'activity' && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-sky-600 dark:bg-sky-400" />
                    )}
                </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto">
                {activeTab === 'details' ? (
                    <div className="p-3">
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
                                <div className="font-medium text-sm truncate" title={displayedClientName}>
                                    {displayedClientName}
                                </div>

                                {sample.client_id ? (
                                    <div className="mt-2 space-y-2">
                                        {isClientLoading && (
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                                Đang tải thông tin khách hàng...
                                            </div>
                                        )}

                                        {!isClientLoading && clientLoadError && (
                                            <div className="text-xs text-red-600 dark:text-red-400">
                                                {clientLoadError}
                                            </div>
                                        )}

                                        {client && (
                                            <div className="grid grid-cols-2 gap-3 rounded-md border border-slate-100 bg-slate-50/40 p-3 text-sm dark:border-slate-800 dark:bg-slate-900/30">
                                                <DetailItem label="CCCD/CMND" value={client.id_card_num} />
                                                <DetailItem label="Ngày sinh" value={formatDateOnly(client.date_of_birth)} />
                                                <DetailItem label="Giới tính" value={client.gender} />
                                                <DetailItem label="Số điện thoại" value={client.phone} />
                                                <DetailItem
                                                    className="col-span-2"
                                                    label="Địa chỉ"
                                                    value={client.address || 'N/A'}
                                                />
                                                <DetailItem
                                                    label="BHYT"
                                                    value={client.health_insurance_num || 'N/A'}
                                                />
                                                <DetailItem
                                                    label="Hạn CCCD/CMND"
                                                    value={client.expiry_date ? formatDateOnly(client.expiry_date) : 'N/A'}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="mt-1 text-xs text-muted-foreground">
                                        Mẫu chưa được liên kết với khách hàng
                                    </div>
                                )}
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
                ) : (
                    <div className="p-3">
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

function DetailItem({
    label,
    value,
    className,
}: {
    label: string
    value: string
    className?: string
}) {
    return (
        <div className={cn('space-y-1.5', className)}>
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {label}
            </div>
            <div className="text-sm break-words">{value}</div>
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
