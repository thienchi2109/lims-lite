'use client'

import type { Client, SampleWithUser, SampleStatus } from '@/types'
import { formatDate } from '@/lib/utils-lims'
import { useClient } from '@/hooks/use-client'
import {
    FileText,
    AlertCircle,
    Loader2,
    Pencil,
    User,
    ChevronRight,
    Copy,
    Barcode,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { SampleEditDialog } from '@/components/sample-edit-dialog'
import { SampleActivityFeed } from '@/components/sample-activity-feed'
import { useQueryClient } from '@tanstack/react-query'
import { markLocalSamplesMutation } from '@/lib/samples-realtime'
import { sampleKeys, clientKeys } from '@/types/query-keys'
import { cn } from '@/lib/utils'
import { printSampleBarcodeLabel } from '@/lib/sample-label-print-client'
import { SampleLabelPrintDialog } from '@/components/sample-label-print-dialog'
import type { SampleLabelPreset } from '@/lib/sample-label-template'
import { formatSampleQuality } from '@/lib/sample-quality-display'

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface SampleDetailPanelProps {
    sample: SampleDetailPanelSample | null
}

type SampleDetailPanelSample = SampleWithUser & {
    client?: Client | null
}

/* ------------------------------------------------------------------ */
/*  Status Stepper Config                                              */
/* ------------------------------------------------------------------ */

const STEPS = [
    { id: 'received', label: 'Đã nhận' },
    { id: 'assigned', label: 'Đã chỉ định' },
    { id: 'in_progress', label: 'Đang thực hiện' },
    { id: 'completed', label: 'Hoàn thành' },
] as const

const STATUS_INDEX: Record<string, number> = {
    received: 0,
    assigned: 1,
    in_progress: 2,
    review: 2,
    completed: 3,
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function getEmbeddedClient(sample: SampleDetailPanelSample | null) {
    return sample?.client ?? null
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

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export function SampleDetailPanel({ sample }: SampleDetailPanelProps) {
    const [editDialogOpen, setEditDialogOpen] = useState(false)
    const [activeTab, setActiveTab] = useState<'details' | 'activity'>('details')
    const [copied, setCopied] = useState(false)
    const [labelPrintDialogOpen, setLabelPrintDialogOpen] = useState(false)
    const queryClient = useQueryClient()
    const embeddedClient = getEmbeddedClient(sample)

    const {
        data: client,
        isLoading: isClientLoading,
        error: clientError,
    } = useClient({
        clientId: sample?.client_id ?? null,
        placeholderData: embeddedClient ?? undefined,
    })

    const sampleId = sample?.sample_id
    const handleCopySampleId = () => {
        if (!sampleId) return
        navigator.clipboard.writeText(sampleId).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
        })
    }

    if (!sample) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 rounded-lg bg-slate-50/50 dark:bg-slate-900/50">
                <FileText className="h-12 w-12 mb-4 opacity-20" />
                <p className="text-sm font-medium">Chọn một mẫu để xem chi tiết</p>
            </div>
        )
    }

    const handlePrintBarcodeLabel = () => {
        setLabelPrintDialogOpen(true)
    }

    const handleConfirmPrintBarcodeLabel = (preset: SampleLabelPreset) => {
        void printSampleBarcodeLabel(sample.id, { preset })
    }

    const handleEditSuccess = () => {
        markLocalSamplesMutation(sample.id)
        queryClient.invalidateQueries({ queryKey: sampleKeys.all })
        queryClient.invalidateQueries({ queryKey: sampleKeys.detail(sample.id) })
        queryClient.invalidateQueries({ queryKey: sampleKeys.selectionCore(sample.id) })
        if (sample.client_id) {
            queryClient.invalidateQueries({ queryKey: clientKeys.detail(sample.client_id) })
        }
    }

    const resolvedClient = client ?? embeddedClient ?? null
    const displayedClientName =
        resolvedClient?.name || sample.client_name || 'N/A'

    return (
        <div
            id="tour-sample-detail"
            className="h-full min-h-0 flex flex-col overflow-hidden rounded-lg bg-white shadow-sm dark:bg-slate-950"
        >
            {/* ── Header: Sample ID + Edit ── */}
            <div className="px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                    <div className="flex flex-col min-w-0">
                        <span className="text-[0.6875rem] font-medium text-slate-500 uppercase tracking-wider">
                            Mã mẫu xét nghiệm
                        </span>
                        <div className="flex items-center gap-2 mt-0.5">
                            <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate">
                                {sample.sample_id}
                            </h3>
                            <button
                                onClick={handleCopySampleId}
                                className="text-slate-400 hover:text-sky-600 transition-colors duration-200 cursor-pointer shrink-0"
                                title={copied ? 'Đã sao chép!' : 'Sao chép mã mẫu'}
                            >
                                <Copy className="h-3.5 w-3.5" />
                                <span className="sr-only">{copied ? 'Đã sao chép!' : 'Sao chép mã mẫu'}</span>
                            </button>
                            <button
                                onClick={handlePrintBarcodeLabel}
                                className="text-slate-400 hover:text-sky-600 transition-colors duration-200 cursor-pointer shrink-0"
                                title="In nhãn barcode"
                                aria-label="In nhãn barcode"
                            >
                                <Barcode className="h-3.5 w-3.5" />
                            </button>
                        </div>
                    </div>
                    {['received', 'assigned'].includes(sample.status) && (
                        <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditDialogOpen(true)}
                            title="Chỉnh sửa thông tin"
                            className="h-8 w-8 rounded-lg text-sky-600 hover:bg-slate-200/50 transition-all duration-200 cursor-pointer shrink-0"
                        >
                            <Pencil className="h-3.5 w-3.5" />
                        </Button>
                    )}
                </div>

                {/* ── Tab Navigation ── */}
                <nav className="flex items-center border-b border-slate-200/50 dark:border-slate-800/50">
                    <button
                        onClick={() => setActiveTab('details')}
                        className={cn(
                            "px-4 py-2 text-[0.6875rem] font-medium uppercase tracking-wider transition-all duration-200 cursor-pointer",
                            activeTab === 'details'
                                ? "text-sky-700 dark:text-sky-300 font-bold border-b-2 border-sky-600"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                    >
                        Thông tin
                    </button>
                    <button
                        onClick={() => setActiveTab('activity')}
                        className={cn(
                            "px-4 py-2 text-[0.6875rem] font-medium uppercase tracking-wider transition-all duration-200 cursor-pointer",
                            activeTab === 'activity'
                                ? "text-sky-700 dark:text-sky-300 font-bold border-b-2 border-sky-600"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                        )}
                    >
                        Lịch sử cập nhật
                    </button>
                </nav>
            </div>

            {/* ── Tab Content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 flex flex-col gap-5">
                {activeTab === 'details' ? (
                    <>
                        {/* Rejection Alert */}
                        {sample.rejection_reason && ['in_progress', 'discarded'].includes(sample.status) && (
                            <div className={cn(
                                "rounded-lg p-3",
                                sample.status === 'discarded'
                                    ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                                    : 'bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300',
                            )}>
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
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

                        {/* Status Progress Bar */}
                        <StatusProgressBar status={sample.status} />

                        {/* Patient Information Grid */}
                        <section>
                            <div className="flex items-center justify-between mb-3 border-b border-slate-100 dark:border-slate-800 pb-1">
                                <h4 className="text-[0.6875rem] font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                                    Thông tin bệnh nhân
                                </h4>
                                <User className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            </div>

                            {sample.client_id ? (
                                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                    {isClientLoading && (
                                        <div className="col-span-2 flex items-center gap-1.5 text-[11px] text-muted-foreground py-1">
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                            Đang tải thông tin khách hàng...
                                        </div>
                                    )}
                                    {clientError && (
                                        <div className="col-span-2 text-[11px] text-red-600 dark:text-red-400 py-1">
                                            {clientError.message}
                                        </div>
                                    )}
                                    {resolvedClient && (
                                        <>
                                            <InfoCell label="Họ tên" value={displayedClientName} bold colSpan={2} />
                                            <InfoCell label="Số CCCD" value={resolvedClient.id_card_num} />
                                            <InfoCell label="Ngày sinh" value={formatDateOnly(resolvedClient.date_of_birth)} />
                                            <InfoCell label="Giới tính" value={resolvedClient.gender} />
                                            <InfoCell label="Điện thoại" value={resolvedClient.phone} />
                                            <InfoCell label="Địa chỉ" value={resolvedClient.address || 'N/A'} colSpan={2} />
                                            <InfoCell label="Mã BHYT" value={resolvedClient.health_insurance_num || 'N/A'} />
                                            <InfoCell label="Hạn BHYT" value={resolvedClient.expiry_date ? formatDateOnly(resolvedClient.expiry_date) : 'N/A'} />
                                        </>
                                    )}
                                </div>
                            ) : (
                                <div className="text-[11px] text-muted-foreground">
                                    Mẫu chưa được liên kết với khách hàng
                                </div>
                            )}
                        </section>

                        {/* Metadata Footer */}
                        <section className="mt-auto pt-4 border-t border-slate-100 dark:border-slate-800">
                            <div className="flex flex-col gap-2 bg-slate-100/50 dark:bg-slate-800/30 p-3 rounded-lg">
                                <MetaRow label="Thời điểm nhận" value={formatDate(sample.received_at)} />
                                <MetaRow label="Người nhận mẫu" value={sample.received_by_name || 'N/A'} />
                                <MetaRow
                                    label="Chất lượng mẫu"
                                    value={formatSampleQuality(sample.sample_quality)}
                                />
                                <MetaRow label="Cập nhật cuối" value={formatDate(sample.updated_at)} />
                            </div>
                        </section>
                    </>
                ) : (
                    <div className="px-0 py-0">
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
            <SampleLabelPrintDialog
                open={labelPrintDialogOpen}
                onOpenChange={setLabelPrintDialogOpen}
                onPrint={handleConfirmPrintBarcodeLabel}
            />
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Status Progress Bar                                                */
/* ------------------------------------------------------------------ */

function StatusProgressBar({ status }: { status: SampleStatus }) {
    if (status === 'discarded') {
        return (
            <section className="rounded-xl p-3 bg-red-50 dark:bg-red-900/10">
                <div className="flex items-center justify-center">
                    <span className="text-[0.6875rem] font-bold text-red-700 dark:text-red-400 uppercase tracking-wider">
                        Đã loại bỏ
                    </span>
                </div>
            </section>
        )
    }

    const activeIndex = STATUS_INDEX[status] ?? 0

    return (
        <section className="bg-white dark:bg-slate-900 rounded-xl p-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)] border border-slate-100/80 dark:border-slate-800/50">
            <div className="flex items-center justify-between w-full gap-1">
                {STEPS.map((step, index) => {
                    const isCompleted = index < activeIndex
                    const isCurrent = index === activeIndex
                    const isPending = index > activeIndex
                    const isLast = index === STEPS.length - 1

                    return (
                        <div key={step.id} className="flex items-center flex-1 min-w-0">
                            <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
                                {/* Bar */}
                                <div className={cn(
                                    "w-full h-1.5 rounded-full overflow-hidden",
                                    isCompleted && "bg-sky-600",
                                    isPending && "bg-slate-100 dark:bg-slate-800",
                                    isCurrent && "bg-sky-100 dark:bg-sky-900/30 relative",
                                )}>
                                    {isCurrent && (
                                        <div className="absolute inset-y-0 left-0 w-1/2 bg-sky-400 rounded-full" />
                                    )}
                                </div>
                                {/* Label */}
                                <span className={cn(
                                    "text-[0.625rem] font-medium text-center whitespace-nowrap",
                                    isCompleted && "text-sky-700 dark:text-sky-400 font-bold",
                                    isCurrent && "text-sky-600 dark:text-sky-400 font-semibold",
                                    isPending && "text-slate-400 dark:text-slate-500",
                                )}>
                                    {step.label}
                                </span>
                            </div>
                            {/* Chevron separator */}
                            {!isLast && (
                                <div className="px-0.5 shrink-0">
                                    <ChevronRight className="h-3 w-3 text-slate-300 dark:text-slate-600" />
                                </div>
                            )}
                        </div>
                    )
                })}
            </div>
        </section>
    )
}

/* ------------------------------------------------------------------ */
/*  Info Cell (2-col grid item: label stacked above value)             */
/* ------------------------------------------------------------------ */

function InfoCell({
    label,
    value,
    bold,
    colSpan,
}: {
    label: string
    value: string
    bold?: boolean
    colSpan?: 2
}) {
    const isNA = value === 'N/A'

    return (
        <div className={cn("flex flex-col", colSpan === 2 && "col-span-2")}>
            <span className="text-[0.6875rem] text-slate-500 dark:text-slate-400 uppercase tracking-tight">
                {label}
            </span>
            <span className={cn(
                "text-sm font-medium",
                bold && "font-semibold text-slate-900 dark:text-slate-100",
                isNA && "text-slate-400 italic",
                !bold && !isNA && "text-slate-900 dark:text-slate-200",
            )}>
                {value}
            </span>
        </div>
    )
}

/* ------------------------------------------------------------------ */
/*  Metadata Row (key-value inline row in footer card)                 */
/* ------------------------------------------------------------------ */

function MetaRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex justify-between items-center text-xs">
            <span className="text-slate-500 dark:text-slate-400">{label}</span>
            <span className="text-slate-900 dark:text-slate-200 font-medium">{value}</span>
        </div>
    )
}
