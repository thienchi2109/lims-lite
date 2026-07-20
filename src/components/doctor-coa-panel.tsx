'use client'

import { useEffect, useState } from 'react'
import { FileSearch, Loader2 } from 'lucide-react'
import { getCoAStatus } from '@/app/actions/coa'
import { Button } from '@/components/ui/button'
import { CoAPreviewDialog } from '@/components/coa-preview-dialog'
import { CoAStatusBadge } from '@/components/coa-status-badge'
import type { CoAReportStatus } from '@/types'

interface DoctorCoAPanelProps {
    sampleId: string
    sampleDisplayId?: string | null
}

export function DoctorCoAPanel({ sampleId, sampleDisplayId }: DoctorCoAPanelProps) {
    const [status, setStatus] = useState<CoAReportStatus | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [previewOpen, setPreviewOpen] = useState(false)

    useEffect(() => {
        let cancelled = false

        async function loadCoAStatus() {
            setIsLoading(true)
            setError(null)

            try {
                const result = await getCoAStatus(sampleId)
                if (cancelled) return
                setStatus(result.status)
                setError(result.error ?? null)
            } catch (loadError) {
                if (cancelled) return
                console.error('Doctor CoA status load failed:', loadError)
                setStatus(null)
                setError('Không thể tải trạng thái CoA')
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        void loadCoAStatus()

        return () => {
            cancelled = true
        }
    }, [sampleId])

    return (
        <div className="flex h-full min-h-0 flex-col rounded-lg bg-white shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
                <div>
                    <p className="text-xs font-medium uppercase text-slate-500">Phiếu kết quả</p>
                    <h3 className="mt-1 text-base font-semibold text-slate-900">
                        {sampleDisplayId || sampleId}
                    </h3>
                </div>
                {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                    <CoAStatusBadge status={status} />
                )}
            </div>

            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
                <FileSearch className="h-12 w-12 text-slate-300" />
                {error ? (
                    <p className="text-sm text-red-600">{error}</p>
                ) : status === 'ready' ? (
                    <>
                        <p className="max-w-sm text-sm text-slate-600">
                            CoA đã sẵn sàng cho mẫu đã hoàn thành này.
                        </p>
                        <Button onClick={() => setPreviewOpen(true)} className="gap-2">
                            <FileSearch className="h-4 w-4" />
                            Xem CoA
                        </Button>
                    </>
                ) : (
                    <p className="max-w-sm text-sm text-slate-600">
                        Chưa có CoA sẵn sàng cho mẫu này.
                    </p>
                )}
            </div>

            <CoAPreviewDialog
                open={previewOpen}
                onOpenChange={setPreviewOpen}
                sampleId={sampleId}
                title="Phiếu Kết Quả Phân Tích"
                route="staff"
                pdfEndpoint="/api/coa/view/pdf"
            />
        </div>
    )
}
